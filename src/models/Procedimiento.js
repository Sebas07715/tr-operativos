// Modelo de procedimiento clínico (HU-04 y HU-10) — Responsable: Jorge Vallejos
const mongoose = require("mongoose");

const procedimientoSchema = new mongoose.Schema(
  {
    operativoId: { type: String, required: true, index: true },
    inscripcionId: { type: String, required: true, index: true },
    animalId: { type: String, required: true, trim: true },
    tipo: {
      type: String,
      enum: ["esterilizacion", "chipeo", "control_postoperatorio"],
      required: true
    },
    asistio: { type: Boolean, default: true },
    veterinarioRut: { type: String, required: true },
    veterinarioNombre: { type: String, default: "" },
    observaciones: { type: String, default: "", trim: true },
    detalleClinico: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    altaMedica: { type: Boolean, default: false },
    fechaAtencion: { type: String, required: true } // ISO 8601 UTC
  },
  { timestamps: true }
);

module.exports = mongoose.model("Procedimiento", procedimientoSchema);