// HU-10 (fábrica de procedimientos) — Responsable: Jorge Vallejos
const { datosInvalidos, esTexto } = require("../middlewares/validaciones");

class Procedimiento {
  constructor(datos) {
    if (new.target === Procedimiento) {
      throw new Error("Procedimiento es una clase abstracta");
    }
    this.datos = datos || {};
  }

  validar() {
    throw new Error("Cada procedimiento debe implementar validar()");
  }

  detalle() {
    throw new Error("Cada procedimiento debe implementar detalle()");
  }

  registrarProcedimiento(veterinarioRut) {
    return {
      tipo: this.tipo,
      fecha: new Date(),
      veterinarioRut,
      detalle: this.detalle()
    };
  }
}

class Esterilizacion extends Procedimiento {
  tipo = "esterilizacion";

  validar() {
    const { pesoAnimal, tipoAnestesia, medicacion } = this.datos;
    if (typeof pesoAnimal !== "number" || Number.isNaN(pesoAnimal) || pesoAnimal <= 0 || pesoAnimal > 100) {
      throw datosInvalidos("pesoAnimal debe ser un número entre 0 y 100 (kg)");
    }
    if (!esTexto(tipoAnestesia, 2, 60)) {
      throw datosInvalidos("tipoAnestesia es obligatorio");
    }
    if (medicacion !== undefined && medicacion !== null && medicacion !== "" && !esTexto(medicacion, 1, 200)) {
      throw datosInvalidos("medicacion debe ser texto de hasta 200 caracteres");
    }
  }

  detalle() {
    const { pesoAnimal, tipoAnestesia, medicacion } = this.datos;
    return {
      pesoAnimal,
      tipoAnestesia: String(tipoAnestesia).trim(),
      medicacion: medicacion ? String(medicacion).trim() : null
    };
  }
}

class Chipeo extends Procedimiento {
  tipo = "chipeo";

  validar() {
    const { numeroChip, ubicacionChip } = this.datos;
    if (typeof numeroChip !== "string" || !/^\d{15}$/.test(numeroChip)) {
      throw datosInvalidos("numeroChip debe tener exactamente 15 dígitos");
    }
    if (!esTexto(ubicacionChip, 2, 60)) {
      throw datosInvalidos("ubicacionChip es obligatorio");
    }
  }

  detalle() {
    const { numeroChip, ubicacionChip } = this.datos;
    return {
      numeroChip: String(numeroChip).trim(),
      ubicacionChip: String(ubicacionChip).trim()
    };
  }
}

class ControlPostoperatorio extends Procedimiento {
  tipo = "control_postoperatorio";

  validar() {
    const { observaciones, altaMedica } = this.datos;
    if (!esTexto(observaciones, 3, 500)) {
      throw datosInvalidos("observaciones es obligatorio (3 a 500 caracteres)");
    }
    if (typeof altaMedica !== "boolean") {
      throw datosInvalidos("altaMedica debe ser true o false");
    }
  }

  detalle() {
    const { observaciones, altaMedica } = this.datos;
    return {
      observaciones: String(observaciones).trim(),
      altaMedica
    };
  }
}

class ProcedimientoFactory {
  static crearProcedimiento(tipo, datos) {
    switch (String(tipo || "").trim()) {
      case "esterilizacion":
        return new Esterilizacion(datos);
      case "chipeo":
        return new Chipeo(datos);
      case "control_postoperatorio":
        return new ControlPostoperatorio(datos);
      default:
        throw datosInvalidos("tipo debe ser esterilizacion, chipeo o control_postoperatorio");
    }
  }

  // Alias por si algún archivo previo invoca ProcedimientoFactory.crear(...)
  static crear(tipo, datos) {
    return ProcedimientoFactory.crearProcedimiento(tipo, datos);
  }
}

module.exports = {
  Procedimiento,
  Esterilizacion,
  Chipeo,
  ControlPostoperatorio,
  ProcedimientoFactory
};