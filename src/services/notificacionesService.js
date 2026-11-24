// HU-03 — Servicio de notificaciones — Responsable: Tamara Tarque
const mongoose = require("mongoose");
const Notificacion = require("../models/Notificacion");

const notificacionesMemoria = [];

function dbConectada() {
  return mongoose.connection.readyState === 1;
}

// Registra una notificación para el tutor responsable (llamada desde inscripción, cancelación, asistencia o inasistencia)
async function crearNotificacion({
  tutorRut,
  operativoId = "",
  inscripcionId = "",
  animalId = "",
  tipoEvento = "cambio_estado",
  mensaje
}) {
  if (!tutorRut || !mensaje) return null;

  const payload = {
    tutorRut: String(tutorRut).trim(),
    operativoId: String(operativoId || ""),
    inscripcionId: String(inscripcionId || ""),
    animalId: String(animalId || ""),
    tipoEvento: String(tipoEvento || "cambio_estado"),
    mensaje: String(mensaje).trim(),
    leida: false
  };

  if (dbConectada()) {
    return Notificacion.create(payload);
  }

  const creada = {
    _id: `noti_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    ...payload,
    createdAt: new Date().toISOString()
  };
  notificacionesMemoria.unshift(creada);
  return creada;
}

// Lista las notificaciones del usuario autenticado con paginación
async function listarMisNotificaciones({ tutorRut, skip = 0, limit = 20 }) {
  if (dbConectada()) {
    const filtro = { tutorRut };
    const [datos, total] = await Promise.all([
      Notificacion.find(filtro).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notificacion.countDocuments(filtro)
    ]);
    return { datos, total };
  }

  const filtradas = notificacionesMemoria.filter((n) => n.tutorRut === tutorRut);
  return {
    datos: filtradas.slice(skip, skip + limit),
    total: filtradas.length
  };
}

// Marca una notificación como leída si pertenece al tutor
async function marcarNotificacionLeida({ notiId, tutorRut }) {
  if (dbConectada()) {
    if (!mongoose.Types.ObjectId.isValid(notiId)) {
      return { ok: false, status: 404, codigo: "NOTIFICACION_NO_ENCONTRADA", mensaje: "Notificación no encontrada" };
    }

    const actualizada = await Notificacion.findOneAndUpdate(
      { _id: notiId, tutorRut },
      { $set: { leida: true } },
      { new: true }
    );

    if (!actualizada) {
      return { ok: false, status: 404, codigo: "NOTIFICACION_NO_ENCONTRADA", mensaje: "Notificación no encontrada" };
    }

    return { ok: true, datos: actualizada };
  }

  const encontrada = notificacionesMemoria.find((n) => n._id === notiId && n.tutorRut === tutorRut);
  if (!encontrada) {
    return { ok: false, status: 404, codigo: "NOTIFICACION_NO_ENCONTRADA", mensaje: "Notificación no encontrada" };
  }

  encontrada.leida = true;
  return { ok: true, datos: encontrada };
}

module.exports = {
  crearNotificacion,
  listarMisNotificaciones,
  marcarNotificacionLeida
};