// Carga inicial de datos de prueba (seed) — Responsable: Tamara Tarque
require("dotenv").config();
const mongoose = require("mongoose");
const Operativo = require("../src/models/Operativo");

async function ejecutarSeed() {
  if (!process.env.MONGODB_URI) {
    console.error("Falta MONGODB_URI en el archivo .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const existentes = await Operativo.countDocuments();
  if (existentes > 0) {
    console.log(`Ya existen ${existentes} operativos registrados. No se duplicaron datos.`);
    await mongoose.disconnect();
    return;
  }

  const manana = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const finManana = new Date(manana.getTime() + 6 * 60 * 60 * 1000);

  const proximaSemana = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const finProximaSemana = new Date(proximaSemana.getTime() + 6 * 60 * 60 * 1000);

  await Operativo.insertMany([
    {
      sede: "Sede Norte Antofagasta",
      fechaInicio: manana.toISOString(),
      fechaTermino: finManana.toISOString(),
      especiesAtendidas: ["canino", "felino"],
      bloquesHorarios: ["09:00-12:00", "14:00-17:00"],
      funcionarioResponsable: "11111111-1",
      cuposTotales: 20,
      cuposDisponibles: 20,
      estado: "disponible"
    },
    {
      sede: "Sede Sur Antofagasta",
      fechaInicio: proximaSemana.toISOString(),
      fechaTermino: finProximaSemana.toISOString(),
      especiesAtendidas: ["canino", "felino"],
      bloquesHorarios: ["09:30-13:30"],
      funcionarioResponsable: "11111111-1",
      cuposTotales: 15,
      cuposDisponibles: 15,
      estado: "disponible"
    }
  ]);

  console.log("Seed ejecutado correctamente: 2 operativos creados.");
  await mongoose.disconnect();
}

ejecutarSeed().catch((err) => {
  console.error("Error al ejecutar seed:", err.message);
  process.exit(1);
});