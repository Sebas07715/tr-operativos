// Interfaz web del Módulo 2 (sesión, operativos, inscripciones y notificaciones) — Responsable: Elian Tapia
const API = "/api/operativos";
const NUCLEO_BASE = (window.NUCLEO_URL || "https://nucleo-tr.onrender.com").replace(/\/+$/, "");

const estado = {
  token: localStorage.getItem("tokenOp") || "",
  usuario: JSON.parse(localStorage.getItem("usuarioOp") || "null"),
  operativoActual: null,
  inscripcionesPorOperativo: {}
};

const $ = (id) => document.getElementById(id);

function mostrarMensaje(texto, esError = false) {
  const msg = $("mensaje");
  if (!msg) return;
  msg.textContent = texto || "";
  msg.className = esError ? "error" : "ok";
}

function normalizarRut(rut = "") {
  return String(rut).replace(/\./g, "").replace(/\s+/g, "").trim().toLowerCase();
}

async function pedirApi(ruta, opciones = {}, silenciar404 = false) {
  const headers = {
    "Content-Type": "application/json",
    ...(opciones.headers || {})
  };
  if (estado.token) {
    headers.Authorization = `Bearer ${estado.token}`;
  }

  const resp = await fetch(`${API}${ruta}`, { ...opciones, headers });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    if (silenciar404 && resp.status === 404) {
      return null;
    }
    const err = new Error(data.error?.mensaje || data.mensaje || "Error en la consulta");
    err.status = resp.status;
    throw err;
  }
  return data;
}

function ajustarPorPerfil() {
  const perfil = estado.usuario?.perfil || "";
  document.querySelectorAll("[data-perfiles]").forEach((sec) => {
    const permitidos = sec.getAttribute("data-perfiles").split(/\s+/).filter(Boolean);
    if (
      perfil === "admin" &&
      sec.id &&
      ["formOperativo", "seccionOperativo", "crearOperativo"].some((k) => sec.id.toLowerCase().includes(k))
    ) {
      sec.hidden = false;
      return;
    }
    sec.hidden = !permitidos.includes(perfil);
  });
}

function refrescarPantalla() {
  const activo = Boolean(estado.token && estado.usuario);
  $("login").hidden = activo;
  $("app").hidden = !activo;
  $("salir").hidden = !activo;

  if (activo) {
    $("quien").textContent = `${estado.usuario.nombre || estado.usuario.rut} (${estado.usuario.perfil})`;
    ajustarPorPerfil();
    cargarPantalla();
  } else {
    $("quien").textContent = "";
  }
}

// Inicio y cierre de sesión
$("formLogin").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const resp = await fetch(`${NUCLEO_BASE}/api/nucleo/sesiones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rut: $("rut").value.trim(),
        clave: $("clave").value
      })
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data.error?.mensaje || data.mensaje || "Error al iniciar sesión");
    }

    estado.token = data.token;
    estado.usuario = data.usuario || {
      rut: data.rut,
      perfil: data.perfil,
      nombre: data.nombre
    };
    localStorage.setItem("tokenOp", estado.token);
    localStorage.setItem("usuarioOp", JSON.stringify(estado.usuario));
    mostrarMensaje("Sesión iniciada");
    refrescarPantalla();
  } catch (err) {
    mostrarMensaje(err.message, true);
  }
});

$("salir").addEventListener("click", () => {
  estado.token = "";
  estado.usuario = null;
  estado.operativoActual = null;
  estado.inscripcionesPorOperativo = {};
  localStorage.removeItem("tokenOp");
  localStorage.removeItem("usuarioOp");
  mostrarMensaje("Sesión cerrada");
  refrescarPantalla();
});

function animalYaInscritoEnOperativo(operativoId, animalId) {
  const inscs = estado.inscripcionesPorOperativo[operativoId] || [];
  return inscs.some(
    (i) =>
      String(i.animalId || "").trim().toLowerCase() === String(animalId || "").trim().toLowerCase() &&
      ["inscrito", "lista_espera"].includes(String(i.estado || "").toLowerCase())
  );
}

// Operativos e inscripciones (HU-07 / HU-08)
async function cargarOperativos() {
  const ul = $("listaOperativos");
  ul.innerHTML = "";

  try {
    const data = await pedirApi("");
    const lista = data.datos || data.items || data.operativos || [];
    const perfil = estado.usuario?.perfil || "";

    lista.forEach((op) => {
      const opId = op._id || op.id;
      const li = document.createElement("li");
      li.innerHTML = `<span>${op.titulo || op.nombre || op.sede || opId} · Estado: ${op.estado || "abierto"} · Cupos: ${op.cuposDisponibles ?? op.cuposTotales ?? "-"}</span>`;

      if (["vecino", "comunitario"].includes(perfil)) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "Inscribir";
        btn.addEventListener("click", () => inscribir(opId));
        li.appendChild(btn);
      }

      if (["funcionario", "veterinario", "jefatura", "admin"].includes(perfil)) {
        const btnVer = document.createElement("button");
        btnVer.type = "button";
        btnVer.textContent = "Ver inscripciones";
        btnVer.addEventListener("click", () => cargarInscripcionesOperativo(opId));
        li.appendChild(btnVer);
      }

      ul.appendChild(li);
    });
  } catch (err) {
    mostrarMensaje(err.message, true);
  }
}

async function inscribir(operativoId) {
  const perfil = estado.usuario?.perfil || "";
  if (!["vecino", "comunitario"].includes(perfil)) {
    return mostrarMensaje("Tu rol no tiene permiso para inscribir animales", true);
  }

  const animalId = $("animalId").value.trim();
  const tipoProcedimiento = $("tipo").value;
  if (!animalId) {
    return mostrarMensaje("Ingresa el SIM del animal", true);
  }

  if (animalYaInscritoEnOperativo(operativoId, animalId)) {
    return mostrarMensaje(`El animal ${animalId} ya está inscrito en este operativo`, true);
  }

  try {
    const data = await pedirApi(`/${operativoId}/inscripciones`, {
      method: "POST",
      body: JSON.stringify({ animalId, tipoProcedimiento })
    });
    mostrarMensaje(`Inscripción ${data.datos?.estado || "registrada"}`);
    await cargarMisInscripciones();
    await cargarOperativos();
    await cargarNotificaciones();
  } catch (err) {
    mostrarMensaje(err.message, true);
  }
}

async function cargarMisInscripciones() {
  if (!["vecino", "comunitario"].includes(estado.usuario?.perfil || "")) return;
  const ul = $("listaMias");
  ul.innerHTML = "";

  try {
    const opsData = await pedirApi("");
    const ops = opsData.datos || opsData.items || opsData.operativos || [];
    const miRut = normalizarRut(estado.usuario.rut);

    for (const op of ops) {
      const opId = op._id || op.id;
      const insData = await pedirApi(`/${opId}/inscripciones`, {}, true);
      const listaIns = insData?.datos || insData?.items || insData?.inscripciones || [];
      const mias = listaIns.filter((i) => normalizarRut(i.tutorRut) === miRut);
      estado.inscripcionesPorOperativo[opId] = mias;

      mias.forEach((ins) => {
        const li = document.createElement("li");
        li.innerHTML = `<span>Operativo ${opId} · Animal ${ins.animalId} · Estado: ${ins.estado}</span>`;

        if (["inscrito", "lista_espera"].includes(ins.estado)) {
          const btnCancel = document.createElement("button");
          btnCancel.type = "button";
          btnCancel.textContent = "Cancelar";
          btnCancel.addEventListener("click", () => cancelar(opId, ins._id || ins.id, ins.tutorRut));
          li.appendChild(btnCancel);
        }

        ul.appendChild(li);
      });
    }
  } catch {
    // Sin inscripciones aún
  }
}

async function cancelar(operativoId, inscId, tutorRut = "") {
  const perfil = estado.usuario?.perfil || "";
  const esDuenio = tutorRut && normalizarRut(tutorRut) === normalizarRut(estado.usuario?.rut || "");

  if (["vecino", "comunitario"].includes(perfil) && !esDuenio) {
    return mostrarMensaje("Solo puedes cancelar inscripciones de tu propio animal", true);
  }
  if (!["vecino", "comunitario", "admin"].includes(perfil)) {
    return mostrarMensaje("Tu rol no tiene permiso para cancelar inscripciones", true);
  }

  try {
    await pedirApi(`/${operativoId}/inscripciones/${inscId}/cancelar`, {
      method: "PATCH"
    });
    mostrarMensaje("Inscripción cancelada");
    if (["vecino", "comunitario"].includes(perfil)) {
      await cargarMisInscripciones();
    }
    if (estado.operativoActual) {
      await cargarInscripcionesOperativo(estado.operativoActual);
    }
    await cargarOperativos();
    await cargarNotificaciones();
  } catch (err) {
    mostrarMensaje(err.message || "No se pudo cancelar la inscripción", true);
  }
}

// Notificaciones (HU-03)
async function cargarNotificaciones() {
  if (!["vecino", "comunitario"].includes(estado.usuario?.perfil || "")) return;
  const ul = $("listaNotificaciones");
  if (!ul) return;
  ul.innerHTML = "";

  try {
    const data = await pedirApi("/notificaciones", {}, true);
    if (!data) return;
    const listaNotif = data.datos || data.items || data.notificaciones || [];
    listaNotif.forEach((n) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${n.mensaje} ${n.leida ? "(leída)" : ""}</span>`;
      if (!n.leida) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "Marcar leída";
        btn.addEventListener("click", async () => {
          await pedirApi(`/notificaciones/${n._id || n.id}/leer`, { method: "PATCH" }, true);
          cargarNotificaciones();
        });
        li.appendChild(btn);
      }
      ul.appendChild(li);
    });
  } catch {
    // Sin notificaciones aún
  }
}

// Catálogos y creación de operativo
async function cargarCatalogos() {
  if (!["funcionario", "admin"].includes(estado.usuario?.perfil || "")) return;
  try {
    const data = await pedirApi("/catalogos", {}, true);
    if (!data) return;
    const sedes = data.sedes || data.datos?.sedes || [];
    const especies = data.especies || data.datos?.especies || ["canino", "felino"];

    if ($("sedeId") && sedes.length > 0) {
      $("sedeId").innerHTML = sedes.map((s) => `<option value="${s.id || s._id}">${s.nombre || s.id}</option>`).join("");
    }
    if ($("especies")) {
      $("especies").innerHTML = especies.map((e) => `<option value="${e}">${e}</option>`).join("");
    }
  } catch {
    if ($("especies") && !$("especies").options.length) {
      $("especies").innerHTML = `<option value="canino">canino</option><option value="felino">felino</option>`;
    }
  }
}

$("formOperativo").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!["funcionario", "admin"].includes(estado.usuario?.perfil || "")) {
    return mostrarMensaje("Solo el perfil funcionario o admin puede crear operativos", true);
  }
  try {
    const especies = Array.from($("especies").selectedOptions).map((o) => o.value);
    const bloquesHorarios = $("bloques").value.split(",").map((b) => b.trim()).filter(Boolean);

    await pedirApi("", {
      method: "POST",
      body: JSON.stringify({
        sede: $("sedeId")?.value || "Sede Central",
        sedeId: $("sedeId")?.value,
        especies,
        especiesAtendidas: especies,
        fechaInicio: $("fechaInicio").value,
        fechaTermino: $("fechaTermino").value,
        cuposTotales: Number($("cupos").value),
        bloquesHorarios
      })
    });
    mostrarMensaje("Operativo creado");
    $("formOperativo").reset();
    cargarOperativos();
  } catch (err) {
    mostrarMensaje(err.message, true);
  }
});

// Listado de inscripciones para gestión, supervisión y clínica
async function cargarInscripcionesOperativo(operativoId) {
  const perfil = estado.usuario?.perfil || "";
  if (["vecino", "comunitario"].includes(perfil)) {
    return cargarMisInscripciones();
  }

  estado.operativoActual = operativoId;
  $("tituloInscripciones").textContent = `Inscripciones del operativo ${operativoId}`;
  const ul = $("listaInscripciones");
  ul.innerHTML = "";

  try {
    const data = await pedirApi(`/${operativoId}/inscripciones`);
    const listaIns = data.datos || data.items || data.inscripciones || [];

    listaIns.forEach((ins) => {
      const inscId = ins._id || ins.id;
      const li = document.createElement("li");
      li.innerHTML = `<span>${inscId} · Animal: ${ins.animalId} · Tutor: ${ins.tutorRut} · Estado: ${ins.estado}</span>`;

      if (["funcionario", "veterinario"].includes(perfil)) {
        const btnAsistio = document.createElement("button");
        btnAsistio.type = "button";
        btnAsistio.textContent = "Asistió";
        btnAsistio.addEventListener("click", () => marcarAsistencia(operativoId, inscId));
        li.appendChild(btnAsistio);

        const btnFalta = document.createElement("button");
        btnFalta.type = "button";
        btnFalta.textContent = "No asistió";
        btnFalta.addEventListener("click", () => marcarInasistencia(operativoId, inscId));
        li.appendChild(btnFalta);
      }

      if (perfil === "admin" && ["inscrito", "lista_espera"].includes(ins.estado)) {
        const btnCancelarAdmin = document.createElement("button");
        btnCancelarAdmin.type = "button";
        btnCancelarAdmin.textContent = "Cancelar";
        btnCancelarAdmin.addEventListener("click", () => cancelar(operativoId, inscId, ins.tutorRut));
        li.appendChild(btnCancelarAdmin);
      }

      if (perfil === "veterinario") {
        const btnUsar = document.createElement("button");
        btnUsar.type = "button";
        btnUsar.textContent = "Usar en clínica";
        btnUsar.addEventListener("click", () => {
          $("procInscripcion").value = inscId;
        });
        li.appendChild(btnUsar);
      }

      ul.appendChild(li);
    });
  } catch (err) {
    mostrarMensaje(err.message, true);
  }
}

async function marcarAsistencia(operativoId, inscId) {
  try {
    await pedirApi(`/${operativoId}/inscripciones/${inscId}/procedimiento/asistencia`, { method: "PATCH" });
    mostrarMensaje("Asistencia confirmada");
    cargarInscripcionesOperativo(operativoId);
  } catch (err) {
    mostrarMensaje(err.message, true);
  }
}

async function marcarInasistencia(operativoId, inscId) {
  try {
    await pedirApi(`/${operativoId}/inscripciones/${inscId}/inasistencia`, { method: "PATCH" });
    mostrarMensaje("Inasistencia registrada");
    cargarInscripcionesOperativo(operativoId);
  } catch (err) {
    mostrarMensaje(err.message, true);
  }
}

// Registro de procedimiento clínico (HU-10)
$("formProcedimiento").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (estado.usuario?.perfil !== "veterinario") {
    return mostrarMensaje("Solo el perfil veterinario puede registrar procedimientos", true);
  }
  if (!estado.operativoActual) {
    return mostrarMensaje("Selecciona primero un operativo con 'Ver inscripciones'", true);
  }

  try {
    await pedirApi(`/${estado.operativoActual}/inscripciones/${$("procInscripcion").value.trim()}/procedimiento`, {
      method: "POST",
      body: JSON.stringify({
        tipo: $("procTipo").value,
        observaciones: $("procObs").value.trim(),
        altaMedica: $("procAlta").checked,
        datosClinicos: {
          pesoKg: Number($("procPeso").value) || undefined,
          tipoAnestesia: $("procAnestesia").value.trim() || undefined,
          numeroMicrochip: $("procChip").value.trim() || undefined,
          zonaImplante: $("procUbicacion").value.trim() || undefined,
          altaMedica: $("procAlta").checked
        }
      })
    });
    mostrarMensaje("Procedimiento registrado");
    $("formProcedimiento").reset();
    cargarInscripcionesOperativo(estado.operativoActual);
  } catch (err) {
    mostrarMensaje(err.message, true);
  }
});

function cargarPantalla() {
  cargarCatalogos();
  cargarOperativos();
  cargarMisInscripciones();
  cargarNotificaciones();
}

refrescarPantalla();