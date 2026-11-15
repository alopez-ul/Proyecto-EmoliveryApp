// US16 - Cancelación de compra anticipada: reglas del plazo (no usa la base de datos).

export const PLAZO_CANCELACION_MIN = 30 // T72: minutos desde el pago en que el cliente aún puede cancelar
const MS_POR_MIN = 60_000

// Pagada y aún por entregar (los mismos estados que cuenta US06 para no cerrar la jornada).
export const ESTADOS_CANCELABLES = ['pendiente', 'en_camino']

// Hasta cuándo se puede cancelar una orden pagada, o null si no tiene hora de pago.
export function cancelableHasta(pagadaEn) {
  return pagadaEn ? new Date(new Date(pagadaEn).getTime() + PLAZO_CANCELACION_MIN * MS_POR_MIN) : null
}

// Motivo por el que la orden NO se puede cancelar, o null si se puede.
// orden: { estado, pagadaEn, entregadaEn }
export function motivoNoCancelable(orden, ahora = new Date()) {
  if (orden.estado === 'cancelada') return 'Esta compra ya fue cancelada.'
  if (orden.estado === 'entregada' || orden.entregadaEn) return 'La compra ya no puede cancelarse: el pedido ya fue entregado.'
  if (orden.estado === 'pendiente_pago' || !orden.pagadaEn) {
    return 'Esta compra aún no está pagada: no hace falta cancelarla, vence sola si no la pagas.'
  }
  if (!ESTADOS_CANCELABLES.includes(orden.estado)) return 'La compra ya no puede cancelarse.'
  if (ahora > cancelableHasta(orden.pagadaEn)) {
    return `La compra ya no puede cancelarse: pasaron más de ${PLAZO_CANCELACION_MIN} minutos desde el pago.`
  }
  return null
}
