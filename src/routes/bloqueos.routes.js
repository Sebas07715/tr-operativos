// HU-09 — Ruta de consulta de bloqueo por RUT — Responsable: Elian Tapia
const express = require("express");
const { requerirPerfil } = require("../middlewares/auth");
const { consultarBloqueo } = require("../services/bloqueoService");
const { enviarError } = require("../middlewares/validaciones");

const router = express.Router();

// Consultar si un tutor está bloqueado por faltas reiteradas
router.get("/bloqueos/:rut", requerirPerfil(), async (req, res) => {
  try {
    const rutSolicitado = String(req.params.rut || "").trim();

    // Un vecino o comunitario solo puede consultar su propio RUT
    if (["vecino", "comunitario"].includes(req.usuario.perfil) && req.usuario.rut !== rutSolicitado) {
      return enviarError(res, 403, "SIN_PERMISO", "Solo puedes consultar el estado de bloqueo de tu propio RUT");
    }

    const estado = await consultarBloqueo(rutSolicitado);
    return res.status(200).json(estado);
  } catch {
    return enviarError(res, 500, "ERROR_CONSULTAR_BLOQUEO", "No se pudo verificar el bloqueo del responsable");
  }
});

module.exports = router;