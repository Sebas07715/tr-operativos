const express = require("express");
const { requerirPerfil } = require("../middlewares/auth");
const { consultarCatalogoNucleo, consultarAnimalM1 } = require("../services/nucleoClient");
const { enviarError } = require("../middlewares/validaciones");

const router = express.Router();

router.get("/salud", (req, res) => {
  res.json({
    modulo: "M2 - Operativos de esterilización y chipeo",
    estado: "ok",
    timestamp: new Date().toISOString()
  });
});

router.get("/sesion", requerirPerfil(), (req, res) => {
  res.json({
    usuario: req.usuario
  });
});

router.get("/catalogos/:tipo", requerirPerfil(), async (req, res) => {
  try {
    const datos = await consultarCatalogoNucleo(req.params.tipo);
    res.json({ datos });
  } catch (err) {
    return enviarError(res, 502, "ERROR_CATALOGO", err.message);
  }
});

router.get("/m1/animales/:animalId", requerirPerfil(), async (req, res) => {
  try {
    const resultado = await consultarAnimalM1(req.params.animalId, req.headers.authorization);
    if (!resultado.ok) {
      return enviarError(
        res,
        resultado.status === 404 ? 404 : 502,
        "CONSULTA_M1_FALLIDA",
        "No se pudo obtener el animal desde el M1"
      );
    }
    res.json({ datos: resultado.data });
  } catch {
    return enviarError(res, 502, "ERROR_M1", "Error al consultar el M1");
  }
});

module.exports = router;