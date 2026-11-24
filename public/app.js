// Interfaz web del Módulo 2 (sesión, operativos, inscripciones y notificaciones) — Responsable: Elian Tapia
const API = "/api/operativos";

const estado = {
  token: localStorage.getItem("tokenOp") || "",
  usuario: JSON.parse(localStorage.getItem("usuarioOp") || "null"),
  operativoActual: null
};

const $ = (id) => document.getElementById(id);

function mostrarMensaje(texto, esError = false) {
  const msg = $("mensaje");
  msg.textContent = texto || "";
  msg.className = esError ? "error" : "ok";
}

async function pedirApi(ruta, opciones = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (estado.token) {
    headers.Authorization = `Bearer ${estado.token}`;
  }

  const resp = await fetch(`${API}${ruta}`, { ...opciones, headers });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.mensaje || data.error || "Error en la consulta");
  }
  return data;
}

function ajustarPorPerfil() {
  const perfil = estado.usuario?.perfil || "";
  document.querySelectorAll("[data-perfiles]").forEach((sec) => {
    const permitidos = sec.getAttribute("data-perfiles").split(/\s+/);
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
    const data = await pedirApi("/sesiones", {
      method: "POST",
      body: JSON.stringify({
        rut: $("rut").value.trim(),
        clave: $("clave").value
      })
    });
    estado.token = data.token;
    estado.usuario = data.usuario;
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
  localStorage.removeItem("tokenOp");
  localStorage.removeItem("usuarioOp");
  mostrarMensaje("Sesión cerrada");
  refrescarPantalla();
});

// Operativos e inscripciones (HU-07 / HU-08)
async function cargarOperativos() {
  const ul = $("listaOperativos");
  ul.innerHTML = "";

  try {
    const data = await pedirApi("");
    const lista = data.datos || data.operativos || [];
    const perfil = estado.usuario?.perfil || "";

    lista.forEach((op) => {
      const opId = op._id || op.id;
      const li = document.createElement("li");
      li.innerHTML = `<span>${op.titulo || op.nombre || opId} · Estado: ${op.estado || "abierto"} · Cupos: ${op.cuposDisponibles ?? op.cuposTotales ?? "-"}</span>`;

      if (["vecino", "comunitario", "funcionario"].includes(perfil)) {
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
  const animalId = $("animalId").value.trim();
  const tipoProcedimiento = $("tipo").value;
  if (!animalId) {
    return mostrarMensaje("Ingresa el ID del animal", true);
  }

  try {
    const data = await pedirApi(`/${operativoId}/inscripciones`, {
      method: "POST",
      body: JSON.stringify({ animalId, tipoProcedimiento })
    });
    mostrarMensaje(`Inscripción ${data.datos?.estado || "registrada"}`);
    cargarOperativos();
    cargarMisInscripciones();
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
    const ops = opsData.datos || opsData.operativos || [];

    for (const op of ops) {
      const opId = op._id || op.id;
      const insData = await pedirApi(`/${opId}/inscripciones`);
      const mias = (insData.datos || []).filter((i) => i.tutorRut === estado.usuario.rut);

      mias.forEach((ins) => {
        const li = document.createElement("li");
        li.innerHTML = `<span>Operativo ${opId} · Animal ${ins.animalId} · Estado: ${ins.estado}</span>`;

        if (["confirmada", "en_espera"].includes(ins.estado)) {
          const btnCancel = document.createElement("button");
          btnCancel.type = "button";
          btnCancel.textContent = "Cancelar";
          btnCancel.addEventListener("click", () => cancelar(opId, ins._id || ins.id));
          li.appendChild(btnCancel);
        }

        ul.appendChild(li);
      });
    }
  } catch {
    // Sin inscripciones aún
  }
}

async function cancelar(operativoId, inscId) {
  try {
    await pedirApi(`/${operativoId}/inscripciones/${inscId}/cancelar`, {
      method: "PATCH"
    });
    mostrarMensaje("Inscripción cancelada");
    cargarMisInscripciones();
    cargarNotificaciones();
  } catch (err) {
    mostrarMensaje(err.message, true);
  }
}

// Notificaciones (HU-03)
async function cargarNotificaciones() {
  const ul = $("listaNotificaciones");
  ul.innerHTML = "";

  try {
    const data = await pedirApi("/notificaciones");
    (data.datos || []).forEach((n) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${n.mensaje} ${n.leida ? "(leída)" : ""}</span>`;
      if (!n.leida) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "Marcar leída";
        btn.addEventListener("click", async () => {
          await pedirApi(`/notificaciones/${n._id || n.id}/leer`, { method: "PATCH" });
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
  if (estado.usuario?.perfil !== "funcionario") return;
  try {
    const data = await pedirApi("/catalogos");
    const sedes = data.sedes || data.datos?.sedes || [];
    const especies = data.especies || data.datos?.especies || ["canino", "felino"];

    $("sedeId").innerHTML = sedes.map((s) => `<option value="${s.id || s._id}">${s.nombre || s.id}</option>`).join("");
    $("especies").innerHTML = especies.map((e) => `<option value="${e}">${e}</option>`).join("");
  } catch {
    if (!$("especies").options.length) {
      $("especies").innerHTML = `<option value="canino">canino</option><option value="felino">felino</option>`;
    }
  }
}

$("formOperativo").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const especies = Array.from($("especies").selectedOptions).map((o) => o.value);
    const bloquesHorarios = $("bloques").value.split(",").map((b) => b.trim()).filter(Boolean);

    await pedirApi("", {
      method: "POST",
      body: JSON.stringify({
        sedeId: $("sedeId").value,
        especies,
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

// Listado de inscripciones para gestión y clínica
async function cargarInscripcionesOperativo(operativoId) {
  estado.operativoActual = operativoId;
  $("tituloInscripciones").textContent = `Inscripciones del operativo ${operativoId}`;
  const ul = $("listaInscripciones");
  ul.innerHTML = "";

  try {
    const data = await pedirApi(`/${operativoId}/inscripciones`);
    const perfil = estado.usuario?.perfil || "";

    (data.datos || []).forEach((ins) => {
      const inscId = ins._id || ins.id;
      const li = document.createElement("li");
      li.innerHTML = `<span>${inscId} · Animal: ${ins.animalId} · Tutor: ${ins.tutorRut} · Estado: ${ins.estado}</span>`;

      if (["funcionario", "veterinario", "admin"].includes(perfil)) {
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