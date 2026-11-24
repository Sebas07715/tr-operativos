// Ruta de registro de inasistencias — Responsable: Elian Tapia
const express = require("express");
const { requerirPerfil } = require("../middlewares/auth");
const { registrarInasistencia } = require("../services/inasistenciasService");
const { enviarError } = require("../middlewares/validaciones");

const router = express.Router({ mergeParams: true });

// Marcar inasistencia de una inscripción (funcionario o veterinario)
router.patch(
  "/:inscId/inasistencia",
  requerirPerfil(["funcionario", "veterinario"]),
  async (req, res) => {
    try {
      const resultado = await registrarInasistencia({
        operativoId: req.params.id,
        inscId: req.params.inscId
      });

      if (!resultado.ok) {
        return enviarError(res, resultado.status, resultado.codigo, resultado.mensaje);
      }

      return res.status(200).json({
        id: resultado.datos._id,
        datos: resultado.datos,
        bloqueo: resultado.bloqueo
      });
    } catch {
      return enviarError(res, 500, "ERROR_INASISTENCIA", "No se pudo registrar la inasistencia");
    }
  }
);

module.exports = router;