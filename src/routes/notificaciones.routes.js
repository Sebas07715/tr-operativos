// HU-03 — Rutas de notificaciones — Responsable: Tamara Tarque
const express = require("express");
const { requerirPerfil } = require("../middlewares/auth");
const {
  crearNotificacion,
  listarMisNotificaciones,
  marcarNotificacionLeida
} = require("../services/notificacionesService");
const {
  enviarError,
  obtenerPaginacion,
  validarCamposRequeridos
} = require("../middlewares/validaciones");

const router = express.Router();

// Consultar mis notificaciones (vecino, comunitario, funcionario, veterinario, jefatura, admin)
router.get("/notificaciones", requerirPerfil(), async (req, res) => {
  try {
    const { page, limit, skip } = obtenerPaginacion(req.query);
    const { datos, total } = await listarMisNotificaciones({
      tutorRut: req.usuario.rut,
      skip,
      limit
    });

    return res.status(200).json({
      page,
      limit,
      total,
      totalPaginas: Math.ceil(total / limit) || 1,
      datos
    });
  } catch {
    return enviarError(res, 500, "ERROR_NOTIFICACIONES", "No se pudieron obtener las notificaciones");
  }
});

// Crear notificación manual/interna desde prueba o gestión
router.post(
  "/notificaciones",
  requerirPerfil(["funcionario", "veterinario", "admin"]),
  async (req, res) => {
    try {
      const faltantes = validarCamposRequeridos(req.body, ["tutorRut", "mensaje"]);
      if (faltantes.length > 0) {
        return enviarError(res, 400, "DATOS_INVALIDOS", "Los campos tutorRut y mensaje son obligatorios");
      }

      const creada = await crearNotificacion(req.body);
      return res.status(201).json({ id: creada._id, datos: creada });
    } catch {
      return enviarError(res, 500, "ERROR_CREAR_NOTIFICACION", "No se pudo registrar la notificación");
    }
  }
);

// Marcar notificación como leída
router.patch("/notificaciones/:notiId/leer", requerirPerfil(), async (req, res) => {
  try {
    const resultado = await marcarNotificacionLeida({
      notiId: req.params.notiId,
      tutorRut: req.usuario.rut
    });

    if (!resultado.ok) {
      return enviarError(res, resultado.status, resultado.codigo, resultado.mensaje);
    }

    return res.status(200).json({ id: resultado.datos._id, datos: resultado.datos });
  } catch {
    return enviarError(res, 500, "ERROR_ACTUALIZAR_NOTIFICACION", "No se pudo actualizar la notificación");
  }
});

module.exports = router;