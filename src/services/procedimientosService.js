// HU-04 y HU-10 — Apoyo de asistencia y alta médica — Responsable: Jorge Vallejos
const mongoose = require("mongoose");
const Operativo = require("../models/Operativo");
const Inscripcion = require("../models/Inscripcion");

// HU-04: Confirmar asistencia del animal al operativo (funcionario, veterinario o admin)
async function confirmarAsistencia({ operativoId, inscId }) {
  if (!mongoose.Types.ObjectId.isValid(operativoId) || !mongoose.Types.ObjectId.isValid(inscId)) {
    return { ok: false, status: 404, codigo: "NO_ENCONTRADO", mensaje: "Operativo o inscripción no encontrados" };
  }

  const [operativo, inscripcion] = await Promise.all([
    Operativo.findById(operativoId),
    Inscripcion.findOne({ _id: inscId, operativoId })
  ]);

  if (!operativo || !inscripcion) {
    return { ok: false, status: 404, codigo: "NO_ENCONTRADO", mensaje: "Operativo o inscripción no encontrados" };
  }

  if (inscripcion.estado === "cancelado" || inscripcion.estado === "cancelada") {
    return { ok: false, status: 409, codigo: "INSCRIPCION_CANCELADA", mensaje: "La inscripción está cancelada" };
  }

  if (["atendido", "asistio"].includes(inscripcion.estado)) {
    return { ok: false, status: 409, codigo: "ASISTENCIA_YA_REGISTRADA", mensaje: "La asistencia ya fue registrada" };
  }

  // Verifica que los atendidos/asistidos no superen los cupos del operativo
  const totalAtendidos = await Inscripcion.countDocuments({
    operativoId,
    estado: { $in: ["atendido", "asistio"] }
  });
  if (typeof operativo.cuposTotales === "number" && totalAtendidos >= operativo.cuposTotales) {
    return { ok: false, status: 409, codigo: "CUPOS_COMPLETOS", mensaje: "El operativo ya alcanzó sus cupos" };
  }

  inscripcion.estado = "atendido";
  await inscripcion.save();

  return { ok: true, datos: inscripcion };
}

module.exports = { confirmarAsistencia };