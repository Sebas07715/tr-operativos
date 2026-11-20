const { validarSesionNucleo } = require("../services/nucleoClient");

function requerirPerfil(perfilesPermitidos = []) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: { codigo: "NO_AUTORIZADO", mensaje: "Token de sesión requerido" }
      });
    }

    try {
      const sesion = await validarSesionNucleo(authHeader);
      if (!sesion.ok || !sesion.data) {
        return res.status(401).json({
          error: { codigo: "TOKEN_INVALIDO", mensaje: "Token inválido o expirado" }
        });
      }

      req.usuario = sesion.data;

      if (perfilesPermitidos.length > 0 && !perfilesPermitidos.includes(sesion.data.perfil)) {
        return res.status(403).json({
          error: { codigo: "PERFIL_NO_AUTORIZADO", mensaje: "No tiene permisos para este recurso" }
        });
      }

      return next();
    } catch {
      return res.status(502).json({
        error: { codigo: "ERROR_NUCLEO", mensaje: "No se pudo consultar el núcleo" }
      });
    }
  };
}

module.exports = { requerirPerfil };