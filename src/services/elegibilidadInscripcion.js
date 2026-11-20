const { consultarAnimalM1, consultarTutorM1 } = require("./nucleoClient");

function tieneMicrochipValido(animal) {
  if (!animal) return false;
  const chip = animal.microchip ? String(animal.microchip).trim() : "";
  return /^\d{15}$/.test(chip) || animal.estado === "con_microchip" || chip.length > 0;
}

async function validarElegibilidadAnimal({
  animalId,
  tipoProcedimiento,
  tutorRutSolicitado,
  usuarioRut,
  authHeader
}) {
  const respAnimal = await consultarAnimalM1(animalId, authHeader);
  if (!respAnimal.ok || !respAnimal.data) {
    return {
      ok: false,
      status: respAnimal.status === 404 ? 404 : 502,
      codigo: "ANIMAL_NO_ENCONTRADO",
      mensaje: "No se encontró el animal en el registro (M1)"
    };
  }

  const animal = respAnimal.data;
  if (animal.estado === "fallecido") {
    return {
      ok: false,
      status: 409,
      codigo: "ANIMAL_FALLECIDO",
      mensaje: "No se puede inscribir un animal registrado como fallecido"
    };
  }

  const rutTutor = String(
    tutorRutSolicitado || animal.tutorRut || animal.responsableRut || usuarioRut || ""
  ).trim();

  if (rutTutor) {
    try {
      const respTutor = await consultarTutorM1(rutTutor, authHeader);
      if (respTutor.ok && respTutor.data?.prohibicionTenencia) {
        return {
          ok: false,
          status: 409,
          codigo: "PROHIBICION_TENENCIA",
          mensaje: "El tutor o responsable registra prohibición de tenencia (RN-04)"
        };
      }
    } catch {
      // Si el endpoint de tutor no responde, no bloquea el flujo local
    }
  }

  // HU-11 (RN-07): Evitar repetir chipeo si ya tiene microchip
  const solicitaChipeo = tipoProcedimiento === "chipeo" || tipoProcedimiento === "ambos";
  if (solicitaChipeo && tieneMicrochipValido(animal)) {
    return {
      ok: false,
      status: 409,
      codigo: "CHIP_YA_REGISTRADO",
      mensaje: "El animal ya cuenta con microchip registrado y no puede inscribirse a chipeo (RN-07)"
    };
  }

  return { ok: true, animal, rutTutor };
}

module.exports = { validarElegibilidadAnimal };