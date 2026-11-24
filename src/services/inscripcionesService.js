const mongoose = require("mongoose");
const Operativo = require("../models/Operativo");
const Inscripcion = require("../models/Inscripcion");

// Revisa si el operativo tiene al menos 24 horas de anticipación
function cumplePlazo24Horas(operativoDoc) {
  if (!operativoDoc || !operativoDoc.fechaInicio) return true;
  const horasRestantes = (new Date(operativoDoc.fechaInicio).getTime() - Date.now()) / (1000 * 60 * 60);
  return horasRestantes >= 24;
}

async function cancelarInscripcion({ dbActiva, operativoId, inscId, usuario, inscripcionesMemoria }) {
  // --- MODO MONGODB ---
  if (dbActiva) {
    if (!mongoose.Types.ObjectId.isValid(operativoId) || !mongoose.Types.ObjectId.isValid(inscId)) {
      return { ok: false, status: 404, codigo: "NO_ENCONTRADO", mensaje: "Operativo o inscripción no encontrados" };
    }

    const [operativoDoc, inscripcion] = await Promise.all([
      Operativo.findById(operativoId),
      Inscripcion.findOne({ _id: inscId, operativoId })
    ]);

    if (!inscripcion) {
      return { ok: false, status: 404, codigo: "INSCRIPCION_NO_ENCONTRADA", mensaje: "La inscripción no existe" };
    }

    // Vecino o comunitario solo pueden cancelar sus propias inscripciones
    if (["vecino", "comunitario"].includes(usuario.perfil) && inscripcion.tutorRut !== usuario.rut) {
      return { ok: false, status: 403, codigo: "SIN_PERMISO", mensaje: "No puedes cancelar una inscripción de otro tutor" };
    }

    if (!["confirmada", "en_espera"].includes(inscripcion.estado)) {
      return {
        ok: false,
        status: 409,
        codigo: "ESTADO_INVALIDO",
        mensaje: "Solo se pueden cancelar inscripciones confirmadas o en espera"
      };
    }

    if (!cumplePlazo24Horas(operativoDoc)) {
      return {
        ok: false,
        status: 409,
        codigo: "FUERA_DE_PLAZO",
        mensaje: "La cancelación debe realizarse con al menos 24 horas de anticipación"
      };
    }

    const eraConfirmada = inscripcion.estado === "confirmada";
    inscripcion.estado = "cancelada";
    inscripcion.posicionEspera = null;
    inscripcion.fechaCancelacion = new Date();
    await inscripcion.save();

    let promovida = null;

    // Si estaba confirmada, promueve al primero en lista de espera o libera cupo en el operativo
    if (eraConfirmada) {
      promovida = await Inscripcion.findOneAndUpdate(
        { operativoId, estado: "en_espera" },
        { $set: { estado: "confirmada", posicionEspera: null } },
        { sort: { createdAt: 1 }, new: true }
      );

      if (!promovida && operativoDoc && typeof operativoDoc.cuposDisponibles === "number") {
        operativoDoc.cuposDisponibles += 1;
        await operativoDoc.save();
      }
    }

    return { ok: true, datos: inscripcion, promovida };
  }

  // --- MODO MEMORIA (respaldo sin MongoDB) ---
  const inscripcion = inscripcionesMemoria.find(
    (ins) => ins._id === inscId && ins.operativoId === operativoId
  );

  if (!inscripcion) {
    return { ok: false, status: 404, codigo: "INSCRIPCION_NO_ENCONTRADA", mensaje: "La inscripción no existe" };
  }

  if (["vecino", "comunitario"].includes(usuario.perfil) && inscripcion.tutorRut !== usuario.rut) {
    return { ok: false, status: 403, codigo: "SIN_PERMISO", mensaje: "No puedes cancelar una inscripción de otro tutor" };
  }

  if (!["confirmada", "en_espera"].includes(inscripcion.estado)) {
    return {
      ok: false,
      status: 409,
      codigo: "ESTADO_INVALIDO",
      mensaje: "Solo se pueden cancelar inscripciones confirmadas o en espera"
    };
  }

  const eraConfirmada = inscripcion.estado === "confirmada";
  inscripcion.estado = "cancelada";
  inscripcion.posicionEspera = null;
  inscripcion.fechaCancelacion = new Date().toISOString();

  let promovida = null;
  if (eraConfirmada) {
    promovida = inscripcionesMemoria.find(
      (ins) => ins.operativoId === operativoId && ins.estado === "en_espera"
    ) || null;

    if (promovida) {
      promovida.estado = "confirmada";
      promovida.posicionEspera = null;
    }
  }

  return { ok: true, datos: inscripcion, promovida };
}

module.exports = { cancelarInscripcion };