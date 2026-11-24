// Prueba rápida de integración contra servidor local — Responsable: Tamara Tarque
const BASE = process.env.API_URL || "http://localhost:3000/api/operativos";

async function probarFlujo() {
  console.log(`Probando servidor en: ${BASE}`);

  const resSalud = await fetch(`${BASE}/salud`);
  const salud = await resSalud.json();
  if (resSalud.status !== 200 || salud.estado !== "ok") {
    throw new Error("Falló /salud");
  }
  console.log("1. /salud OK:", salud.modulo);

  // Si se pasa TOKEN_PRUEBA en .env, verifica listado de operativos autenticados
  if (process.env.TOKEN_PRUEBA) {
    const resOps = await fetch(BASE, {
      headers: { Authorization: `Bearer ${process.env.TOKEN_PRUEBA}` }
    });
    const ops = await resOps.json();
    console.log("2. GET /operativos status:", resOps.status, "total:", ops.paginacion?.total ?? 0);
  } else {
    console.log("2. Define TOKEN_PRUEBA en .env para probar rutas protegidas.");
  }

  console.log("Prueba finalizada correctamente.");
}

probarFlujo().catch((err) => {
  console.error("Error en probar.js:", err.message);
  process.exit(1);
});