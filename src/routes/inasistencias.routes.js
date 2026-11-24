// HU-12 — Ruta para marcar inasistencia — Responsable: Sebastián Brito
const router = require("express").Router();
const { permitirPerfiles } = require("../middlewares/auth");
const { asincrono } = require("../middlewares/validaciones");
const { registrarInasistencia } = require("../services/inasistenciasService");

router.patch(
  "/:operativoId/inscripciones/:inscripcionId/inasistencia",
  permitirPerfiles("funcionario", "veterinario"),
  asincrono(async (req, res) => {
    res.json(await registrarInasistencia(req.params.operativoId, req.params.inscripcionId));
  })
);

module.exports = router;