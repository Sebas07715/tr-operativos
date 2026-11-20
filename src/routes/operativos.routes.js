const express = require("express");
const mongoose = require("mongoose");
const Operativo = require("../models/Operativo");
const { requerirPerfil } = require("../middlewares/auth");
const { consultarCatalogoNucleo } = require("../services/nucleoClient");
const {
  enviarError,
  obtenerPaginacion,
  validarCamposRequeridos
} = require("../middlewares/validaciones");

const router = express.Router();

// Respaldo en memoria si aún no se conecta MONGODB_URI en local
const operativosMemoria = [];

function dbConectada() {
  return mongoose.connection.readyState === 1;
}

// Normaliza respuesta de catálogos del núcleo (array directo o { items/datos })
function extraerListaCatalogo(respuesta) {
  if (Array.isArray(respuesta)) return respuesta;
  if (Array.isArray(respuesta?.items)) return respuesta.items;
  if (Array.isArray(respuesta?.datos)) return respuesta.datos;
  return [];
}

// HU-06: Listar operativos programados (paginado ?page&limit)
router.get("/", requerirPerfil(), async (req, res) => {
  try {
    const { page, limit, skip } = obtenerPaginacion(req.query);

    if (dbConectada()) {
      const [items, total] = await Promise.all([
        Operativo.find().sort({ fechaInicio: 1 }).skip(skip).limit(limit).lean(),
        Operativo.countDocuments()
      ]);

      return res.status(200).json({
        items,
        paginacion: {
          page,
          limit,
          total,
          totalPaginas: Math.ceil(total / limit) || 1
        }
      });
    }

    const total = operativosMemoria.length;
    const items = operativosMemoria.slice(skip, skip + limit);
    return res.status(200).json({
      items,
      paginacion: {
        page,
        limit,
        total,
        totalPaginas: Math.ceil(total / limit) || 1
      }
    });
  } catch {
    return enviarError(res, 500, "ERROR_LISTAR_OPERATIVOS", "No se pudieron listar los operativos");
  }
});

// Obtener detalle de un operativo por ID (404 si no existe)
router.get("/:id", requerirPerfil(), async (req, res) => {
  try {
    const { id } = req.params;

    if (dbConectada()) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return enviarError(res, 404, "OPERATIVO_NO_ENCONTRADO", "El operativo solicitado no existe");
      }
      const operativo = await Operativo.findById(id).lean();
      if (!operativo) {
        return enviarError(res, 404, "OPERATIVO_NO_ENCONTRADO", "El operativo solicitado no existe");
      }
      return res.status(200).json({ datos: operativo });
    }

    const operativo = operativosMemoria.find((op) => op._id === id);
    if (!operativo) {
      return enviarError(res, 404, "OPERATIVO_NO_ENCONTRADO", "El operativo solicitado no existe");
    }
    return res.status(200).json({ datos: operativo });
  } catch {
    return enviarError(res, 500, "ERROR_CONSULTAR_OPERATIVO", "No se pudo obtener el operativo");
  }
});

// HU-06: Registrar un nuevo operativo (solo perfil funcionario)
router.post("/", requerirPerfil(["funcionario"]), async (req, res) => {
  try {
    const faltantes = validarCamposRequeridos(req.body, [
      "sede",
      "fechaInicio",
      "fechaTermino",
      "especiesAtendidas",
      "cuposTotales"
    ]);

    if (
      faltantes.length > 0 ||
      !Array.isArray(req.body.especiesAtendidas) ||
      req.body.especiesAtendidas.length === 0
    ) {
      return enviarError(
        res,
        400,
        "DATOS_INVALIDOS",
        `Campos obligatorios faltantes o inválidos: ${faltantes.join(", ") || "especiesAtendidas"}`
      );
    }

    const cuposTotales = Number(req.body.cuposTotales);
    if (!Number.isInteger(cuposTotales) || cuposTotales <= 0) {
      return enviarError(res, 400, "CUPOS_INVALIDOS", "cuposTotales debe ser un número entero mayor a 0");
    }

    const fechaInicio = new Date(req.body.fechaInicio);
    const fechaTermino = new Date(req.body.fechaTermino);
    if (
      Number.isNaN(fechaInicio.getTime()) ||
      Number.isNaN(fechaTermino.getTime()) ||
      fechaTermino < fechaInicio
    ) {
      return enviarError(
        res,
        400,
        "FECHAS_INVALIDAS",
        "Las fechas deben estar en formato ISO 8601 válido y fechaTermino >= fechaInicio"
      );
    }

    // Validación opcional contra catálogos del Núcleo (GET)
    try {
      const [sedesResp, especiesResp] = await Promise.all([
        consultarCatalogoNucleo("sedes"),
        consultarCatalogoNucleo("especies")
      ]);
      const sedes = extraerListaCatalogo(sedesResp);
      const especies = extraerListaCatalogo(especiesResp);

      if (sedes.length > 0) {
        const sedeExiste = sedes.some(
          (s) => String(s.codigo || s.id || s.nombre).toLowerCase() === String(req.body.sede).toLowerCase()
        );
        if (!sedeExiste) {
          return enviarError(res, 400, "SEDE_INVALIDA", "La sede indicada no existe en el catálogo del núcleo");
        }
      }

      if (especies.length > 0) {
        const catalogoCodigos = especies.map((e) => String(e.codigo || e.id || e.nombre).toLowerCase());
        const invalidas = req.body.especiesAtendidas.filter(
          (esp) => !catalogoCodigos.includes(String(esp).toLowerCase())
        );
        if (invalidas.length > 0) {
          return enviarError(
            res,
            400,
            "ESPECIE_INVALIDA",
            `Especies no válidas en el catálogo del núcleo: ${invalidas.join(", ")}`
          );
        }
      }
    } catch {
      // Si el catálogo del núcleo no responde temporalmente, continuamos con los datos validados
    }

    const payload = {
      sede: String(req.body.sede).trim(),
      fechaInicio: fechaInicio.toISOString(),
      fechaTermino: fechaTermino.toISOString(),
      especiesAtendidas: req.body.especiesAtendidas.map((e) => String(e).trim()),
      bloquesHorarios: Array.isArray(req.body.bloquesHorarios)
        ? req.body.bloquesHorarios.map((b) => String(b).trim())
        : [],
      funcionarioResponsable: req.usuario.rut || req.usuario.nombre || "funcionario",
      cuposTotales,
      cuposDisponibles: cuposTotales,
      estado: "disponible"
    };

    if (dbConectada()) {
      const creado = await Operativo.create(payload);
      return res.status(201).json({
        id: creado._id,
        datos: creado
      });
    }

    const creadoLocal = {
      _id: `op_${Date.now()}`,
      ...payload,
      createdAt: new Date().toISOString()
    };
    operativosMemoria.push(creadoLocal);

    return res.status(201).json({
      id: creadoLocal._id,
      datos: creadoLocal
    });
  } catch {
    return enviarError(res, 500, "ERROR_CREAR_OPERATIVO", "No se pudo registrar el operativo");
  }
});

module.exports = router;