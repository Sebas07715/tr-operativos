// Pruebas de reglas y endpoints del Módulo 2 — Responsable: Tamara Tarque
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../src/app");

let servidor;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    servidor = app.listen(0, () => {
      const { port } = servidor.address();
      baseUrl = `http://127.0.0.1:${port}/api/operativos`;
      resolve();
    });
  });
});

test.after(async () => {
  if (servidor) {
    await new Promise((resolve) => servidor.close(resolve));
  }
});

test("GET /salud responde estado ok", async () => {
  const res = await fetch(`${baseUrl}/salud`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.estado, "ok");
});

test("GET / sin autorización devuelve 401", async () => {
  const res = await fetch(baseUrl);
  assert.equal(res.status, 401);
});

test("GET /ruta/inexistente devuelve 404 con estructura estándar", async () => {
  const res = await fetch(`${baseUrl}/ruta/inexistente`);
  const data = await res.json();
  assert.equal(res.status, 404);
  const codigo = data.codigo || data.error?.codigo;
  assert.equal(codigo, "NO_ENCONTRADO");
});