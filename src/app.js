const express = require("express");
const cors = require("cors");
const saludRoutes = require("./routes/salud.routes");
const { enviarError } = require("./middlewares/validaciones");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/operativos", saludRoutes);

app.use((req, res) => {
  return enviarError(res, 404, "NO_ENCONTRADO", "Ruta o recurso no encontrado");
});

app.use((err, req, res, next) => {
  console.error(err);
  return enviarError(res, 500, "ERROR_INTERNO", "Error interno del servidor");
});

module.exports = app;