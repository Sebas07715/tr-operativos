const express = require("express");
const mongoose = require("mongoose");
const Operativo = require("../models/Operativo");
const Inscripcion = require("../models/Inscripcion");
const { requerirPerfil } = require("../middlewares/auth");
const { validarElegibilidadAnimal } = require("../services/elegibilidadInscripcion");
const { asignarCupoOEspera } = require("../services/cupoService");
const { consultarBloqueo } = require("../services/bloqueoService");
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

function normalizarRut(rut = "") {
  return String(rut).replace(/\./g, "").replace(/\s+/g, "").trim().toLowerCase();
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

      // HU-09 (Elian): verifica si el tutor está bloqueado por inasistencias reiteradas
      const bloqueo = await consultarBloqueo(elegibilidad.rutTutor);
      if (bloqueo.bloqueado) {
        return enviarError(
          res,
          409,
          "RESPONSABLE_BLOQUEADO",
          `Responsable bloqueado por inasistencias reiteradas hasta ${bloqueo.hasta}`
        );
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

router.patch(
  "/:inscId/cancelar",
  requerirPerfil(["vecino", "comunitario", "admin"]),
  async (req, res) => {
    try {
      const { id, inscId } = req.params;
      const perfil = req.usuario?.perfil || "";

      if (dbConectada()) {
        if (!mongoose.Types.ObjectId.isValid(inscId)) {
          return enviarError(res, 404, "INSCRIPCION_NO_ENCONTRADA", "La inscripción no existe");
        }
        const insc = await Inscripcion.findOne({ _id: inscId, operativoId: id });
        if (!insc) {
          return enviarError(res, 404, "INSCRIPCION_NO_ENCONTRADA", "La inscripción no existe");
        }
        if (
          ["vecino", "comunitario"].includes(perfil) &&
          normalizarRut(insc.tutorRut) !== normalizarRut(req.usuario.rut)
        ) {
          return enviarError(res, 403, "PROHIBIDO", "Solo puedes cancelar inscripciones de tu propio animal");
        }
        if (!["inscrito", "lista_espera"].includes(insc.estado)) {
          return enviarError(
            res,
            409,
            "ESTADO_NO_CANCELABLE",
            "La inscripción no se puede cancelar en su estado actual"
          );
        }

        const estadoAnterior = insc.estado;
        insc.estado = "cancelado";
        await insc.save();

        if (estadoAnterior === "inscrito" && mongoose.Types.ObjectId.isValid(id)) {
          await Operativo.findByIdAndUpdate(id, { $inc: { cuposDisponibles: 1 } });
        }

        return res.status(200).json({ datos: insc });
      }

      const idx = inscripcionesMemoria.findIndex((i) => i._id === inscId && i.operativoId === id);
      if (idx === -1) {
        return enviarError(res, 404, "INSCRIPCION_NO_ENCONTRADA", "La inscripción no existe");
      }
      const insc = inscripcionesMemoria[idx];
      if (
        ["vecino", "comunitario"].includes(perfil) &&
        normalizarRut(insc.tutorRut) !== normalizarRut(req.usuario.rut)
      ) {
        return enviarError(res, 403, "PROHIBIDO", "Solo puedes cancelar inscripciones de tu propio animal");
      }
      if (!["inscrito", "lista_espera"].includes(insc.estado)) {
        return enviarError(
          res,
          409,
          "ESTADO_NO_CANCELABLE",
          "La inscripción no se puede cancelar en su estado actual"
        );
      }

      insc.estado = "cancelado";
      return res.status(200).json({ datos: insc });
    } catch {
      return enviarError(res, 500, "ERROR_CANCELAR_INSCRIPCION", "No se pudo cancelar la inscripción");
    }
  }
);

module.exports = router;