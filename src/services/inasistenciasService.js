// Servicio de registro de inasistencias y evaluación de bloqueo (HU-09 / HU-12) — Responsable: Elian Tapia
const mongoose = require("mongoose");
const Inscripcion = require("../models/Inscripcion");
const { consultarBloqueo } = require("./bloqueoService");

// Avisa al tutor si el servicio de notificaciones ya está disponible
async function notificarTutor(datos) {
  try {
    const { crearNotificacion } = require("./notificacionesService");
    if (typeof crearNotificacion === "function") {
      await crearNotificacion(datos);
    }
  } catch {
    // Si aún no está cargado el servicio de notificaciones, continúa sin fallar
  }
}

// Marca una inscripción como "no_asistio" y devuelve el estado de bloqueo actualizado
async function registrarInasistencia({ operativoId, inscId }) {
  if (mongoose.connection.readyState !== 1) {
    return { ok: false, status: 503, codigo: "DB_NO_DISPONIBLE", mensaje: "Base de datos no disponible" };
  }

  if (!mongoose.Types.ObjectId.isValid(operativoId) || !mongoose.Types.ObjectId.isValid(inscId)) {
    return { ok: false, status: 404, codigo: "NO_ENCONTRADO", mensaje: "Operativo o inscripción no encontrados" };
  }

  const inscripcion = await Inscripcion.findOne({ _id: inscId, operativoId });
  if (!inscripcion) {
    return { ok: false, status: 404, codigo: "INSCRIPCION_NO_ENCONTRADA", mensaje: "La inscripción no existe" };
  }

  if (["cancelado", "cancelada", "atendido", "asistio"].includes(inscripcion.estado)) {
    return {
      ok: false,
      status: 409,
      codigo: "ESTADO_INVALIDO",
      mensaje: "No se puede marcar inasistencia en este estado"
    };
  }

  inscripcion.estado = "no_asistio";
  await inscripcion.save();

  const bloqueo = await consultarBloqueo(inscripcion.tutorRut);

  await notificarTutor({
    tutorRut: inscripcion.tutorRut,
    operativoId: String(operativoId),
    inscripcionId: String(inscripcion._id),
    animalId: inscripcion.animalId,
    tipoEvento: "inasistencia",
    mensaje: bloqueo.bloqueado
      ? `Se registró inasistencia para ${inscripcion.animalId}. Tutor bloqueado hasta ${bloqueo.hasta}`
      : `Se registró inasistencia para ${inscripcion.animalId}`
  });

  return { ok: true, datos: inscripcion, bloqueo };
}

module.exports = { registrarInasistencia };