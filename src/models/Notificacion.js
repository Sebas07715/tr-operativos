// HU-03 — Modelo de notificación — Responsable: Tamara Tarque
const mongoose = require("mongoose");

const notificacionSchema = new mongoose.Schema(
  {
    tutorRut: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    operativoId: {
      type: String,
      default: ""
    },
    inscripcionId: {
      type: String,
      default: ""
    },
    animalId: {
      type: String,
      default: ""
    },
    tipoEvento: {
      type: String,
      default: "cambio_estado"
    },
    mensaje: {
      type: String,
      required: true,
      trim: true
    },
    leida: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Notificacion", notificacionSchema);