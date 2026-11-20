const express = require("express");
const mongoose = require("mongoose");
const Inscripcion = require("../models/Inscripcion");
const Procedimiento = require("../models/Procedimiento");
const { requerirPerfil } = require("../middlewares/auth");
const { ProcedimientoFactory } = require("../services/procedimientoFactory");
const { enviarError, validarCamposRequeridos } = require("../middlewares/validaciones");

const router = express.Router({ mergeParams: true });

const procedimientosMemoria = [];

function dbConectada() {
  return mongoose.connection.readyState === 1;
}

// Consultar procedimiento clínico de una inscripción
router.get("/", requerirPerfil(), async (req, res) => {
  try {
    const { id, inscId } = req.params;

    if (dbConectada()) {
      const registro = await Procedimiento.findOne({
        operativoId: id,
        inscripcionId: inscId
      }).lean();

      if (!registro) {
        return enviarError(res, 404, "PROCEDIMIENTO_NO_ENCONTRADO", "No existe registro clínico para esta inscripción");
      }
      return res.status(200).json({ datos: registro });
    }

    const local = procedimientosMemoria.find(
      (p) => p.operativoId === id && p.inscripcionId === inscId
    );
    if (!local) {
      return enviarError(res, 404, "PROCEDIMIENTO_NO_ENCONTRADO", "No existe registro clínico para esta inscripción");
    }
    return res.status(200).json({ datos: local });
  } catch {
    return enviarError(res, 500, "ERROR_CONSULTAR_PROCEDIMIENTO", "No se pudo obtener el procedimiento");
  }
});

// HU-04: Registrar asistencia y procedimiento clínico (solo veterinario/admin)
router.post("/", requerirPerfil(["veterinario", "admin"]), async (req, res) => {
  try {
    const { id, inscId } = req.params;
    const faltantes = validarCamposRequeridos(req.body, ["tipo"]);
    if (faltantes.length > 0) {
      return enviarError(res, 400, "DATOS_INVALIDOS", "El campo 'tipo' es obligatorio (esterilizacion o chipeo)");
    }

    let animalId = String(req.body.animalId || "").trim();

    if (dbConectada()) {
      if (!mongoose.Types.ObjectId.isValid(inscId)) {
        return enviarError(res, 404, "INSCRIPCION_NO_ENCONTRADA", "La inscripción indicada no existe");
      }

      const inscripcion = await Inscripcion.findOne({ _id: inscId, operativoId: id });
      if (!inscripcion) {
        return enviarError(res, 404, "INSCRIPCION_NO_ENCONTRADA", "La inscripción no pertenece a este operativo");
      }
      if (inscripcion.estado === "cancelado") {
        return enviarError(res, 409, "INSCRIPCION_CANCELADA", "No se puede atender una inscripción cancelada");
      }
      if (inscripcion.estado === "atendido") {
        return enviarError(res, 409, "PROCEDIMIENTO_YA_REGISTRADO", "Esta inscripción ya tiene atención registrada");
      }

      animalId = inscripcion.animalId;

      const instancia = ProcedimientoFactory.crear(req.body.tipo, {
        operativoId: id,
        inscripcionId: inscId,
        animalId,
        veterinario: req.usuario,
        observaciones: req.body.observaciones,
        datosClinicos: req.body.datosClinicos || {}
      });

      const creado = await Procedimiento.create(instancia.construirRegistro());
      inscripcion.estado = "atendido";
      await inscripcion.save();

      return res.status(201).json({
        id: creado._id,
        datos: creado
      });
    }

    // Respaldo en memoria para pruebas locales sin MongoDB
    if (!animalId) {
      return enviarError(res, 400, "DATOS_INVALIDOS", "En modo memoria local debe incluir animalId");
    }

    const yaExisteLocal = procedimientosMemoria.some(
      (p) => p.operativoId === id && p.inscripcionId === inscId
    );
    if (yaExisteLocal) {
      return enviarError(res, 409, "PROCEDIMIENTO_YA_REGISTRADO", "Esta inscripción ya tiene atención registrada");
    }

    const instancia = ProcedimientoFactory.crear(req.body.tipo, {
      operativoId: id,
      inscripcionId: inscId,
      animalId,
      veterinario: req.usuario,
      observaciones: req.body.observaciones,
      datosClinicos: req.body.datosClinicos || {}
    });

    const creadoLocal = {
      _id: `proc_${Date.now()}`,
      ...instancia.construirRegistro(),
      createdAt: new Date().toISOString()
    };
    procedimientosMemoria.push(creadoLocal);

    return res.status(201).json({
      id: creadoLocal._id,
      datos: creadoLocal
    });
  } catch (err) {
    if (err.status) {
      return enviarError(res, err.status, err.codigo || "DATOS_INVALIDOS", err.message);
    }
    return enviarError(res, 500, "ERROR_REGISTRAR_PROCEDIMIENTO", "No se pudo registrar el procedimiento clínico");
  }
});

module.exports = router;