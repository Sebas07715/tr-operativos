class ProcedimientoBase {
  constructor({ operativoId, inscripcionId, animalId, veterinario, observaciones }) {
    this.operativoId = operativoId;
    this.inscripcionId = inscripcionId;
    this.animalId = animalId;
    this.asistio = true;
    this.veterinarioRut = veterinario.rut;
    this.veterinarioNombre = veterinario.nombre || "";
    this.observaciones = observaciones ? String(observaciones).trim() : "";
    this.fechaAtencion = new Date().toISOString();
  }

  construirRegistro() {
    throw new Error("Debe implementar construirRegistro()");
  }
}

class EsterilizacionProcedimiento extends ProcedimientoBase {
  constructor(params) {
    super(params);
    this.tipo = "esterilizacion";
    this.tecnica = params.datosClinicos?.tecnica || "ovariohisterectomia / orquiectomia";
    this.medicacionPostoperatoria = params.datosClinicos?.medicacionPostoperatoria || "";
  }

  construirRegistro() {
    return {
      operativoId: this.operativoId,
      inscripcionId: this.inscripcionId,
      animalId: this.animalId,
      tipo: this.tipo,
      asistio: this.asistio,
      veterinarioRut: this.veterinarioRut,
      veterinarioNombre: this.veterinarioNombre,
      observaciones: this.observaciones,
      detalleClinico: {
        tecnica: String(this.tecnica).trim(),
        medicacionPostoperatoria: String(this.medicacionPostoperatoria).trim()
      },
      fechaAtencion: this.fechaAtencion
    };
  }
}

class ChipeoProcedimiento extends ProcedimientoBase {
  constructor(params) {
    super(params);
    this.tipo = "chipeo";
    const chip = String(params.datosClinicos?.numeroMicrochip || "").trim();
    if (!/^\d{15}$/.test(chip)) {
      const err = new Error("Para chipeo debe ingresar un numeroMicrochip válido de 15 dígitos");
      err.status = 400;
      err.codigo = "MICROCHIP_INVALIDO";
      throw err;
    }
    this.numeroMicrochip = chip;
    this.zonaImplante = params.datosClinicos?.zonaImplante || "interescapular";
  }

  construirRegistro() {
    return {
      operativoId: this.operativoId,
      inscripcionId: this.inscripcionId,
      animalId: this.animalId,
      tipo: this.tipo,
      asistio: this.asistio,
      veterinarioRut: this.veterinarioRut,
      veterinarioNombre: this.veterinarioNombre,
      observaciones: this.observaciones,
      detalleClinico: {
        numeroMicrochip: this.numeroMicrochip,
        zonaImplante: String(this.zonaImplante).trim()
      },
      fechaAtencion: this.fechaAtencion
    };
  }
}

class ProcedimientoFactory {
  static crear(tipo, params) {
    switch (String(tipo || "").toLowerCase().trim()) {
      case "esterilizacion":
        return new EsterilizacionProcedimiento(params);
      case "chipeo":
        return new ChipeoProcedimiento(params);
      default: {
        const err = new Error("El tipo de procedimiento debe ser 'esterilizacion' o 'chipeo'");
        err.status = 400;
        err.codigo = "TIPO_PROCEDIMIENTO_INVALIDO";
        throw err;
      }
    }
  }
}

module.exports = { ProcedimientoFactory };