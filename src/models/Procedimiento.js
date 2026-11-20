const mongoose = require("mongoose");

const procedimientoSchema = new mongoose.Schema(
  {
    operativoId: { type: String, required: true, index: true },
    inscripcionId: { type: String, required: true, unique: true },
    animalId: { type: String, required: true, trim: true },
    tipo: {
      type: String,
      enum: ["esterilizacion", "chipeo"],
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
    fechaAtencion: { type: String, required: true } // ISO 8601 UTC
  },
  { timestamps: true }
);

module.exports = mongoose.model("Procedimiento", procedimientoSchema);