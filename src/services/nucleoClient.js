const NUCLEO_URL = process.env.NUCLEO_URL || "https://nucleo-tr.onrender.com";
const M1_URL = process.env.M1_URL || NUCLEO_URL;

async function validarSesionNucleo(authHeader) {
  const resp = await fetch(`${NUCLEO_URL}/api/nucleo/sesiones/actual`, {
    method: "GET",
    headers: { Authorization: authHeader }
  });

  const data = await resp.json().catch(() => null);
  return { ok: resp.ok, status: resp.status, data };
}

async function consultarCatalogoNucleo(tipo, queryString = "") {
  const sufijo = queryString ? `?${queryString}` : "";
  const resp = await fetch(`${NUCLEO_URL}/api/nucleo/catalogos/${encodeURIComponent(tipo)}${sufijo}`, {
    method: "GET"
  });

  if (!resp.ok) {
    throw new Error(`Error al consultar el catálogo '${tipo}' en el núcleo`);
  }

  return resp.json();
}

async function consultarAnimalM1(animalId, authHeader = "") {
  const headers = {};
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  const resp = await fetch(`${M1_URL}/api/registro/animales/${encodeURIComponent(animalId)}`, {
    method: "GET",
    headers
  });

  const data = await resp.json().catch(() => null);
  return { ok: resp.ok, status: resp.status, data };
}

async function consultarTutorM1(rut, authHeader = "") {
  const headers = {};
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  const resp = await fetch(`${M1_URL}/api/registro/tutores/${encodeURIComponent(rut)}`, {
    method: "GET",
    headers
  });

  const data = await resp.json().catch(() => null);
  return { ok: resp.ok, status: resp.status, data };
}

module.exports = {
  validarSesionNucleo,
  consultarCatalogoNucleo,
  consultarAnimalM1,
  consultarTutorM1
};