// US14 - T63: Clase abstracta MetodoPago (RNF18 - Principio Abierto/Cerrado)
// Define el contrato y método plantilla para validar y procesar pagos en EMOLIVERY.
// Nuevos medios de pago (ej. Plin, Tarjeta) pueden extender MetodoPago sin modificar PagoController.

export const PLAZO_VIGENCIA_ORDEN_MIN = 15
export const PLAZO_VIGENCIA_ORDEN_MS = PLAZO_VIGENCIA_ORDEN_MIN * 60 * 1000

export class MetodoPago {
  constructor(nombreMetodo) {
    if (new.target === MetodoPago) {
      throw new TypeError('MetodoPago es una clase abstracta: debe instanciarse una subclase como Yape.')
    }
    this.nombreMetodo = nombreMetodo
  }

  /**
   * Verifica si la orden anticipada aún se encuentra dentro del plazo de 15 minutos.
   * @param {Object} orden
   * @param {Date} [ahora]
   * @returns {boolean}
   */
  esOrdenVigente(orden, ahora = new Date()) {
    if (!orden) return false
    if (orden.forzarExpiracion === true) return false
    const estadosPermitidos = ['PENDIENTE_PAGO', 'Pendiente de pago', 'pendiente']
    if (orden.estado && !estadosPermitidos.includes(orden.estado)) {
      return false
    }
    const creadaEn = orden.creadaEn instanceof Date ? orden.creadaEn : new Date(orden.creadaEn)
    const transcurridoMs = ahora.getTime() - creadaEn.getTime()
    return transcurridoMs <= PLAZO_VIGENCIA_ORDEN_MS
  }

  /**
   * Método abstracto que cada medio de pago concreto debe implementar.
   */
  validarYProcesarConstancia(_contexto) {
    throw new Error(`${this.constructor.name} debe implementar validarYProcesarConstancia(contexto).`)
  }
}
