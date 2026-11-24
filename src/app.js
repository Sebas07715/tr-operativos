const path = require("path");
const express = require("express");
const cors = require("cors");

const saludRoutes = require("./routes/salud.routes");
const operativosRoutes = require("./routes/operativos.routes");
const inscripcionesRoutes = require("./routes/inscripciones.routes");
const animalesRoutes = require("./routes/animales.routes");
const procedimientosRoutes = require("./routes/procedimientos.routes");
const inasistenciasRoutes = require("./routes/inasistencias.routes");
const { enviarError } = require("./middlewares/validaciones");

const app = express();

// Seguridad básica y cabeceras simples sin romper localhost
app.disable("x-powered-by");
app.use(cors());
app.use(express.json());

// Interfaz estática del módulo
app.use(express.static(path.join(__dirname, "..", "public")));

// 1. Rutas base / fijas primero (salud, consulta M1 HU-01)
app.use("/api/operativos", saludRoutes);
app.use("/api/operativos", animalesRoutes);

// 2. Gestión de operativos (HU-06)
app.use("/api/operativos", operativosRoutes);

// 3. Inscripciones, validación de microchip y lista de espera (HU-07 / HU-02 + HU-11)
app.use("/api/operativos/:id/inscripciones", inscripcionesRoutes);

// 4. Inasistencias (HU-12) y registro clínico / procedimientos (HU-04 / HU-10)
app.use("/api/operativos", inasistenciasRoutes);
app.use("/api/operativos/:id/inscripciones/:inscId/procedimiento", procedimientosRoutes);

// 5. Manejo de 404 y errores al final
app.use((req, res) => {
  return enviarError(res, 404, "NO_ENCONTRADO", "Ruta o recurso no encontrado");
});

app.use((err, req, res, next) => {
  console.error(err);
  return enviarError(res, 500, "ERROR_INTERNO", "Error interno del servidor");
});

module.exports = app;