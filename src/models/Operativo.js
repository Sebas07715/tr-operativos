const mongoose = require("mongoose");

const operativoSchema = new mongoose.Schema(
  {
    sede: { type: String, required: true, trim: true },
    fechaInicio: { type: String, required: true }, // ISO 8601 UTC
    fechaTermino: { type: String, required: true }, // ISO 8601 UTC
    especiesAtendidas: {
      type: [String],
      required: true,
      validate: [(arr) => Array.isArray(arr) && arr.length > 0, "Debe incluir al menos una especie"]
    },
    bloquesHorarios: {
      type: [String],
      default: []
    },
    funcionarioResponsable: { type: String, required: true },
    cuposTotales: { type: Number, required: true, min: 1 },
    cuposDisponibles: { type: Number, required: true, min: 0 },
    estado: {
      type: String,
      enum: ["disponible", "lleno", "cerrado"],
      default: "disponible"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Operativo", operativoSchema);