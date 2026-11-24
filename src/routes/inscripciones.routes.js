const express = require("express");
const mongoose = require("mongoose");
const Operativo = require("../models/Operativo");
const Inscripcion = require("../models/Inscripcion");
const { requerirPerfil } = require("../middlewares/auth");
const { validarElegibilidadAnimal } = require("../services/elegibilidadInscripcion");
const { asignarCupoOEspera } = require("../services/cupoService");
const { cancelarInscripcion } = require("../services/inscripcionesService");
const {
  enviarError,
  obtenerPaginacion,
  validarCamposRequeridos
} = require("../middlewares/validaciones");

const router = express.Router({ mergeParams: true });

const inscripcionesMemoria = [];

function dbConectada() {
  return mongoose.connection.readyState === 1;
}

router.get("/", requerirPerfil(), async (req, res) => {
  try {
    const { id } = req.params;
    const { page, limit, skip } = obtenerPaginacion(req.query);

    if (dbConectada()) {
      const [items, total] = await Promise.all([
        Inscripcion.find({ operativoId: id }).sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
        Inscripcion.countDocuments({ operativoId: id })
      ]);

      return res.status(200).json({
        page,
        limit,
        total,
        totalPaginas: Math.ceil(total / limit) || 1,
        datos: items
      });
    }

    const filtradas = inscripcionesMemoria.filter((ins) => ins.operativoId === id);
    const total = filtradas.length;
    const datos = filtradas.slice(skip, skip + limit);

    return res.status(200).json({
      page,
      limit,
      total,
      totalPaginas: Math.ceil(total / limit) || 1,
      datos
    });
  } catch {
    return enviarError(res, 500, "ERROR_LISTAR_INSCRIPCIONES", "No se pudieron obtener las inscripciones");
  }
});

router.post(
  "/",
  requerirPerfil(["vecino", "comunitario", "funcionario", "admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const faltantes = validarCamposRequeridos(req.body, ["animalId"]);
      if (faltantes.length > 0) {
        return enviarError(res, 400, "DATOS_INVALIDOS", "El campo animalId es obligatorio");
      }

      const animalId = String(req.body.animalId).trim();
      const tipoProcedimiento = req.body.tipoProcedimiento || "esterilizacion";
      if (!["esterilizacion", "chipeo", "ambos"].includes(tipoProcedimiento)) {
        return enviarError(
          res,
          400,
          "PROCEDIMIENTO_INVALIDO",
          "tipoProcedimiento debe ser esterilizacion, chipeo o ambos"
        );
      }

      let operativoDoc = null;
      if (dbConectada()) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          return enviarError(res, 404, "OPERATIVO_NO_ENCONTRADO", "El operativo indicado no existe");
        }
        operativoDoc = await Operativo.findById(id);
        if (!operativoDoc) {
          return enviarError(res, 404, "OPERATIVO_NO_ENCONTRADO", "El operativo indicado no existe");
        }
        if (operativoDoc.estado === "cerrado") {
          return enviarError(res, 409, "OPERATIVO_CERRADO", "El operativo está cerrado para inscripciones");
        }
      }

      const elegibilidad = await validarElegibilidadAnimal({
        animalId,
        tipoProcedimiento,
        tutorRutSolicitado: req.body.tutorRut,
        usuarioRut: req.usuario.rut,
        authHeader: req.headers.authorization
      });

      if (!elegibilidad.ok) {
        return enviarError(res, elegibilidad.status, elegibilidad.codigo, elegibilidad.mensaje);
      }

      const dbActiva = dbConectada();
      const { estado, posicionEspera } = await asignarCupoOEspera({
        dbActiva,
        operativoId: id,
        operativoDoc,
        inscripcionesMemoria
      });

      const payload = {
        operativoId: id,
        animalId,
        tutorRut: elegibilidad.rutTutor,
        tipoProcedimiento,
        bloqueHorario: req.body.bloqueHorario ? String(req.body.bloqueHorario).trim() : "",
        estado,
        posicionEspera,
        registradoPor: req.usuario.rut || req.usuario.nombre || "usuario"
      };

      if (dbActiva) {
        const creada = await Inscripcion.create(payload);
        return res.status(201).json({ id: creada._id, datos: creada });
      }

      const creadaLocal = {
        _id: `insc_${Date.now()}`,
        ...payload,
        createdAt: new Date().toISOString()
      };
      inscripcionesMemoria.push(creadaLocal);

      return res.status(201).json({ id: creadaLocal._id, datos: creadaLocal });
    } catch {
      return enviarError(res, 500, "ERROR_INSCRIBIR", "No se pudo procesar la inscripción");
    }
  }
);

// HU-08: Cancelar inscripción (vecino/comunitario dueño o funcionario/admin)
router.patch(
  "/:inscId/cancelar",
  requerirPerfil(["vecino", "comunitario", "funcionario", "admin"]),
  async (req, res) => {
    try {
      const resultado = await cancelarInscripcion({
        dbActiva: dbConectada(),
        operativoId: req.params.id,
        inscId: req.params.inscId,
        usuario: req.usuario,
        inscripcionesMemoria
      });

      if (!resultado.ok) {
        return enviarError(res, resultado.status, resultado.codigo, resultado.mensaje);
      }

      return res.status(200).json({
        id: resultado.datos._id,
        datos: resultado.datos,
        promovida: resultado.promovida
      });
    } catch {
      return enviarError(res, 500, "ERROR_CANCELAR_INSCRIPCION", "No se pudo cancelar la inscripción");
    }
  }
);

module.exports = router;