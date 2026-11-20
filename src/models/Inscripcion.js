const mongoose = require("mongoose");

const inscripcionSchema = new mongoose.Schema(
  {
    operativoId: { type: String, required: true, index: true },
    animalId: { type: String, required: true, trim: true },
    tutorRut: { type: String, required: true, trim: true },
    tipoProcedimiento: {
      type: String,
      enum: ["esterilizacion", "chipeo", "ambos"],
      default: "esterilizacion"
    },
    bloqueHorario: { type: String, default: "" },
    estado: {
      type: String,
      enum: ["inscrito", "lista_espera", "atendido", "cancelado"],
      required: true
    },
    posicionEspera: { type: Number, default: null },
    registradoPor: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Inscripcion", inscripcionSchema);