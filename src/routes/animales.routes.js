const express = require("express");
const { requerirPerfil } = require("../middlewares/auth");
const { obtenerEstadoTiempoRealAnimal } = require("../services/estadoAnimalService");
const { enviarError } = require("../middlewares/validaciones");

const router = express.Router();

// HU-01: Consultar estado en tiempo real de un animal desde el M1
router.get(
  "/animales/:animalId/estado",
  requerirPerfil(["funcionario", "veterinario", "jefatura", "admin"]),
  async (req, res) => {
    try {
      const animalId = String(req.params.animalId || "").trim();
      if (!animalId) {
        return enviarError(res, 400, "DATOS_INVALIDOS", "Debe indicar un animalId válido");
      }

      const resultado = await obtenerEstadoTiempoRealAnimal(animalId, req.headers.authorization);
      if (!resultado.ok) {
        return enviarError(res, resultado.status, resultado.codigo, resultado.mensaje);
      }

      return res.status(200).json({ datos: resultado.datos });
    } catch {
      return enviarError(res, 502, "ERROR_CONSULTA_ANIMAL", "Error al consultar el estado del animal en el M1");
    }
  }
);

module.exports = router;