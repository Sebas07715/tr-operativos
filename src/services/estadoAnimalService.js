const { consultarAnimalM1, consultarTutorM1 } = require("./nucleoClient");

function evaluarEstadoOperativoAnimal(animal, tutor) {
  const tieneMicrochip = Boolean(animal.microchip && String(animal.microchip).trim().length > 0);
  const estaFallecido = animal.estado === "fallecido";
  const tieneProhibicion = Boolean(tutor?.prohibicionTenencia);

  const motivosBloqueo = [];
  if (estaFallecido) {
    motivosBloqueo.push("El animal figura como fallecido en el registro (M1)");
  }
  if (tieneProhibicion) {
    motivosBloqueo.push("El tutor o responsable tiene prohibición de tenencia (RN-04)");
  }

  return {
    animalId: animal.animalId,
    nombre: animal.nombre || "",
    especie: animal.especie || "",
    especieId: animal.especieId || "",
    raza: animal.raza || "",
    estadoRegistro: animal.estado || "desconocido",
    tieneMicrochip,
    microchip: animal.microchip || null,
    comunitario: Boolean(animal.comunitario),
    tutorRut: animal.tutorRut || null,
    responsableRut: animal.responsableRut || null,
    prohibicionTenencia: tieneProhibicion,
    elegibleParaOperativo: motivosBloqueo.length === 0,
    puedeChipearse: !estaFallecido && !tieneProhibicion && !tieneMicrochip,
    motivosBloqueo,
    consultadoEn: new Date().toISOString()
  };
}

async function obtenerEstadoTiempoRealAnimal(animalId, authHeader) {
  const respAnimal = await consultarAnimalM1(animalId, authHeader);
  if (!respAnimal.ok || !respAnimal.data) {
    return {
      ok: false,
      status: respAnimal.status === 404 ? 404 : 502,
      codigo: respAnimal.status === 404 ? "ANIMAL_NO_ENCONTRADO" : "ERROR_M1",
      mensaje:
        respAnimal.status === 404
          ? `No se encontró el animal '${animalId}' en el M1`
          : "No se pudo consultar el estado del animal en el M1"
    };
  }

  const animal = respAnimal.data;
  const rutReferencia = animal.tutorRut || animal.responsableRut;
  let tutorData = null;

  if (rutReferencia) {
    try {
      const respTutor = await consultarTutorM1(rutReferencia, authHeader);
      if (respTutor.ok && respTutor.data) {
        tutorData = respTutor.data;
      }
    } catch {
      // Si el endpoint de tutor no responde, se continúa con los datos del animal
    }
  }

  const evaluacion = evaluarEstadoOperativoAnimal(animal, tutorData);
  return { ok: true, datos: evaluacion };
}

module.exports = { obtenerEstadoTiempoRealAnimal };