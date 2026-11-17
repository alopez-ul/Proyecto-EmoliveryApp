// US21 - T94: Jerarquía polimórfica Notificacion y subclases (RNF18 - Principio Abierto/Cerrado)
// Modela la clase abstracta Notificacion y sus especializaciones para avisar al cliente
// cuando uno de sus emolienteros favoritos inicia jornada en su zona de interés de La Molina.

export class Notificacion {
  /**
   * @param {Object} params
   * @param {string} [params.id]
   * @param {string} params.destinatarioId
   * @param {Object} params.emolientero
   * @param {string} params.ubicacion
   * @param {string} params.zona
   * @param {Date|string} [params.fechaHora]
   * @param {string} [params.canal]
   */
  constructor({
    id,
    destinatarioId,
    emolientero,
    ubicacion,
    zona,
    fechaHora = new Date(),
    canal = 'GENERAL',
  } = {}) {
    if (new.target === Notificacion) {
      throw new TypeError('Notificacion es una clase abstracta: instancia una subclase concreta.')
    }
    if (!destinatarioId) {
      throw new TypeError('Notificacion requiere un destinatarioId válido.')
    }
    if (!emolientero || !emolientero.nombre) {
      throw new TypeError('Notificacion requiere los datos del emolientero.')
    }

    this.id = id ?? `NOTIF-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`
    this.destinatarioId = destinatarioId
    this.emolientero = emolientero
    this.ubicacion = ubicacion ?? emolientero.direccionReferencia ?? 'La Molina'
    this.zona = zona ?? emolientero.zona ?? 'La Molina'
    this.fechaHora = fechaHora instanceof Date ? fechaHora.toISOString() : new Date(fechaHora).toISOString()
    this.canal = canal
    this.estado = 'PENDIENTE'
    this.mensaje = ''
    this.titulo = ''
  }

  /**
   * Método abstracto que cada subclase concreta debe implementar (polimorfismo T94).
   * @returns {{ titulo: string, mensaje: string }}
   */
  formatearMensaje() {
    throw new Error(`${this.constructor.name} debe implementar el método formatearMensaje().`)
  }

  /**
   * Método plantilla que construye el contenido del aviso y marca el estado de envío.
   */
  procesarEnvio() {
    const { titulo, mensaje } = this.formatearMensaje()
    this.titulo = titulo
    this.mensaje = mensaje
    this.estado = 'ENVIADA'

    return {
      id: this.id,
      tipo: this.constructor.name,
      canal: this.canal,
      destinatarioId: this.destinatarioId,
      emolienteroId: this.emolientero.id,
      emolienteroNombre: this.emolientero.nombre,
      codigoMunicipal: this.emolientero.codigoMunicipal ?? 'MLM-2026-00104',
      zona: this.zona,
      ubicacion: this.ubicacion,
      latitud: this.emolientero.latitud,
      longitud: this.emolientero.longitud,
      titulo: this.titulo,
      mensaje: this.mensaje,
      fechaHora: this.fechaHora,
      estado: this.estado,
    }
  }
}

/**
 * T94: Subclase concreta para avisos de apertura de jornada de un emolientero favorito.
 */
export class NotificacionAperturaJornada extends Notificacion {
  static TIPO = 'APERTURA_JORNADA'

  constructor(params = {}) {
    super({ ...params, canal: params.canal ?? 'APERTURA_JORNADA' })
  }

  formatearMensaje() {
    const titulo = `🍵 ¡${this.emolientero.nombre} abrió su jornada en ${this.zona}!`
    const mensaje = `Tu emolientero favorito ${this.emolientero.nombre} (${this.emolientero.codigoMunicipal ?? 'Verificado'}) acaba de iniciar atención en ${this.ubicacion}, zona ${this.zona} (La Molina).`
    return { titulo, mensaje }
  }
}

/**
 * Subclase concreta para avisos dentro de la aplicación web (In-App Banner / Bandeja).
 * Demuestra extensibilidad de la jerarquía Notificacion bajo RNF18 (Principio Abierto/Cerrado).
 */
export class NotificacionEnApp extends NotificacionAperturaJornada {
  static TIPO = 'NOTIFICACION_EN_APP'

  constructor(params = {}) {
    super({ ...params, canal: 'IN_APP' })
  }

  formatearMensaje() {
    const base = super.formatearMensaje()
    return {
      titulo: base.titulo,
      mensaje: `${base.mensaje} Puedes ver su catálogo o hacer tu compra anticipada con QR de Yape ahora.`,
    }
  }
}

/**
 * Subclase concreta adicional para notificaciones Push simuladas (RNF18).
 */
export class NotificacionPushSimulada extends NotificacionAperturaJornada {
  static TIPO = 'NOTIFICACION_PUSH'

  constructor(params = {}) {
    super({ ...params, canal: 'PUSH_MOVIL' })
  }

  formatearMensaje() {
    return {
      titulo: `[PUSH EMOLIVERY] ${this.emolientero.nombre} activo en ${this.zona}`,
      mensaje: `Ubicación confirmada: ${this.ubicacion} (${this.zona}). ¡Pide por adelantado sin hacer cola!`,
    }
  }
}
