const Inscripcion = require("../models/Inscripcion");

async function asignarCupoOEspera({
  dbActiva,
  operativoId,
  operativoDoc,
  inscripcionesMemoria
}) {
  let estado = "inscrito";
  let posicionEspera = null;

  if (dbActiva && operativoDoc) {
    if (operativoDoc.cuposDisponibles > 0) {
      operativoDoc.cuposDisponibles -= 1;
      if (operativoDoc.cuposDisponibles === 0) {
        operativoDoc.estado = "lleno";
      }
      await operativoDoc.save();
    } else {
      estado = "lista_espera";
      const cantidadEspera = await Inscripcion.countDocuments({
        operativoId,
        estado: "lista_espera"
      });
      posicionEspera = cantidadEspera + 1;
    }

    return { estado, posicionEspera };
  }

  const esperaActual = inscripcionesMemoria.filter(
    (ins) => ins.operativoId === operativoId && ins.estado === "lista_espera"
  ).length;
  const inscritosActuales = inscripcionesMemoria.filter(
    (ins) => ins.operativoId === operativoId && ins.estado === "inscrito"
  ).length;

  const cupoMaximoLocal = operativoDoc ? operativoDoc.cuposTotales : 20;
  if (inscritosActuales >= cupoMaximoLocal) {
    estado = "lista_espera";
    posicionEspera = esperaActual + 1;
  }

  return { estado, posicionEspera };
}

module.exports = { asignarCupoOEspera };