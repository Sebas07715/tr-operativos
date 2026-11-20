const express = require("express");
const cors = require("cors");
const saludRoutes = require("./routes/salud.routes");
const operativosRoutes = require("./routes/operativos.routes");
const inscripcionesRoutes = require("./routes/inscripciones.routes");
const animalesRoutes = require("./routes/animales.routes");
const procedimientosRoutes = require("./routes/procedimientos.routes");
const { enviarError } = require("./middlewares/validaciones");

const app = express();

app.use(cors());
app.use(express.json());

// Rutas base (salud, sesión, catálogos) y consulta en tiempo real M1 (HU-01)
app.use("/api/operativos", saludRoutes);
app.use("/api/operativos", animalesRoutes);

// Gestión de operativos (HU-06)
app.use("/api/operativos", operativosRoutes);

// Inscripciones, validación de microchip y lista de espera (HU-07 / HU-02 + HU-11)
app.use("/api/operativos/:id/inscripciones", inscripcionesRoutes);

// Asistencia y registro clínico con Factory Method (HU-04)
app.use("/api/operativos/:id/inscripciones/:inscId/procedimiento", procedimientosRoutes);

app.use((req, res) => {
  return enviarError(res, 404, "NO_ENCONTRADO", "Ruta o recurso no encontrado");
});

app.use((err, req, res, next) => {
  console.error(err);
  return enviarError(res, 500, "ERROR_INTERNO", "Error interno del servidor");
});

module.exports = app;