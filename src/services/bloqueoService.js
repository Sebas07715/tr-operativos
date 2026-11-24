// HU-09 — Bloqueo temporal por faltas reiteradas — Responsable: Elian Tapia
const mongoose = require("mongoose");
const Inscripcion = require("../models/Inscripcion");

const SEIS_MESES_MS = 180 * 24 * 60 * 60 * 1000;
const TREINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;

// Revisa las inscripciones de los últimos 6 meses del tutor para ver si tiene 2 faltas seguidas
async function consultarBloqueo(tutorRut) {
  const rut = String(tutorRut || "").trim();
  if (!rut || mongoose.connection.readyState !== 1) {
    return { bloqueado: false, rut, faltasConsecutivas: 0, hasta: null };
  }

  const limite6Meses = new Date(Date.now() - SEIS_MESES_MS);

  // Busca resultados relevantes (asistencias o inasistencias) de los últimos 6 meses ordenados del más reciente al más antiguo
  const historial = await Inscripcion.find({
    tutorRut: rut,
    estado: { $in: ["no_asistio", "asistio", "atendido"] },
    updatedAt: { $gte: limite6Meses }
  })
    .sort({ updatedAt: -1 })
    .lean();

  let faltasConsecutivas = 0;
  let fechaUltimaFalta = null;

  for (const reg of historial) {
    if (reg.estado === "no_asistio") {
      faltasConsecutivas += 1;
      if (!fechaUltimaFalta) {
        fechaUltimaFalta = new Date(reg.updatedAt);
      }
      if (faltasConsecutivas >= 2) break;
    } else {
      // Si asistió entre medio, se corta la racha de faltas consecutivas
      break;
    }
  }

  if (faltasConsecutivas >= 2 && fechaUltimaFalta) {
    const hasta = new Date(fechaUltimaFalta.getTime() + TREINTA_DIAS_MS);
    if (hasta.getTime() > Date.now()) {
      return {
        bloqueado: true,
        rut,
        faltasConsecutivas,
        hasta: hasta.toISOString()
      };
    }
  }

  return {
    bloqueado: false,
    rut,
    faltasConsecutivas,
    hasta: null
  };
}

module.exports = { consultarBloqueo };