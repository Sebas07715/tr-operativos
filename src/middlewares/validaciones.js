function enviarError(res, status, codigo, mensaje) {
  return res.status(status).json({
    error: { codigo, mensaje }
  });
}

function obtenerPaginacion(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function validarCamposRequeridos(cuerpo, campos) {
  return campos.filter(
    (campo) => cuerpo[campo] === undefined || cuerpo[campo] === null || cuerpo[campo] === ""
  );
}

module.exports = {
  enviarError,
  obtenerPaginacion,
  validarCamposRequeridos
};