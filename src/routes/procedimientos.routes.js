// HU-04 y HU-10 — Rutas de asistencia y procedimientos clínicos — Responsable: Jorge Vallejos
const express = require("express");
const mongoose = require("mongoose");
const Inscripcion = require("../models/Inscripcion");
const Procedimiento = require("../models/Procedimiento");
const { requerirPerfil } = require("../middlewares/auth");
const { ProcedimientoFactory } = require("../services/procedimientoFactory");
const { confirmarAsistencia } = require("../services/procedimientosService");
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

// HU-04: Confirmar asistencia de la inscripción (funcionario, veterinario o admin)
router.patch("/asistencia", requerirPerfil(["funcionario", "veterinario", "admin"]), async (req, res) => {
  try {
    if (!dbConectada()) {
      return enviarError(res, 503, "DB_NO_DISPONIBLE", "Base de datos no disponible");
    }

    const resultado = await confirmarAsistencia({
      operativoId: req.params.id,
      inscId: req.params.inscId
    });

    if (!resultado.ok) {
      return enviarError(res, resultado.status, resultado.codigo, resultado.mensaje);
    }

    return res.status(200).json({ id: resultado.datos._id, datos: resultado.datos });
  } catch {
    return enviarError(res, 500, "ERROR_ASISTENCIA", "No se pudo confirmar la asistencia");
  }
});

// HU-04 y HU-10: Registrar atención clínica y alta médica con Factory Method (veterinario/admin)
router.post("/", requerirPerfil(["veterinario", "admin"]), async (req, res) => {
  try {
    const { id, inscId } = req.params;
    const faltantes = validarCamposRequeridos(req.body, ["tipo"]);
    if (faltantes.length > 0) {
      return enviarError(res, 400, "DATOS_INVALIDOS", "El campo 'tipo' es obligatorio (esterilizacion, chipeo o control_postoperatorio)");
    }

    let animalId = String(req.body.animalId || "").trim();
    const altaMedica = Boolean(req.body.altaMedica || req.body.datosClinicos?.altaMedica);

    if (dbConectada()) {
      if (!mongoose.Types.ObjectId.isValid(inscId)) {
        return enviarError(res, 404, "INSCRIPCION_NO_ENCONTRADA", "La inscripción indicada no existe");
      }

      const inscripcion = await Inscripcion.findOne({ _id: inscId, operativoId: id });
      if (!inscripcion) {
        return enviarError(res, 404, "INSCRIPCION_NO_ENCONTRADA", "La inscripción no pertenece a este operativo");
      }
      if (inscripcion.estado === "cancelado" || inscripcion.estado === "cancelada") {
        return enviarError(res, 409, "INSCRIPCION_CANCELADA", "No se puede atender una inscripción cancelada");
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

      const registro = typeof instancia.construirRegistro === "function"
        ? instancia.construirRegistro()
        : {
            operativoId: id,
            inscripcionId: inscId,
            animalId,
            tipo: req.body.tipo,
            asistio: true,
            veterinarioRut: req.usuario.rut,
            veterinarioNombre: req.usuario.nombre || "",
            observaciones: String(req.body.observaciones || "").trim(),
            detalleClinico: req.body.datosClinicos || req.body,
            fechaAtencion: new Date().toISOString()
          };

      const creado = await Procedimiento.create({
        ...registro,
        altaMedica
      });

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

    const instancia = ProcedimientoFactory.crear(req.body.tipo, {
      operativoId: id,
      inscripcionId: inscId,
      animalId,
      veterinario: req.usuario,
      observaciones: req.body.observaciones,
      datosClinicos: req.body.datosClinicos || {}
    });

    const registroLocal = typeof instancia.construirRegistro === "function"
      ? instancia.construirRegistro()
      : {
          operativoId: id,
          inscripcionId: inscId,
          animalId,
          tipo: req.body.tipo,
          asistio: true,
          veterinarioRut: req.usuario.rut,
          veterinarioNombre: req.usuario.nombre || "",
          observaciones: String(req.body.observaciones || "").trim(),
          detalleClinico: req.body.datosClinicos || req.body,
          fechaAtencion: new Date().toISOString()
        };

    const creadoLocal = {
      _id: `proc_${Date.now()}`,
      ...registroLocal,
      altaMedica,
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