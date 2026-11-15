// US20 - T76: resumen del historial de compras del cliente (conteo y monto acumulado).
// No depende de la base de datos: recibe las compras ya leídas por el repositorio.

// Estados que no cuentan como compra realizada. Se mantienen en el listado, con su estado, pero no
// suman al conteo ni al monto. Ajustar a los estados que defina US13-US16 (p. ej., una orden vencida
// sin pago tampoco es una compra).
export const ESTADOS_SIN_COMPRA = new Set(['cancelada'])

export const SIN_COMPRAS = 'No se encontraron compras en este periodo.'

export const cuentaComoCompra = (compra) => !ESTADOS_SIN_COMPRA.has(compra.estado)

// Suma en céntimos para no acumular errores de redondeo de los decimales.
const aCentimos = (monto) => Math.round(Number(monto) * 100)

// compras: [{ id, fecha, emolientero, productos, monto, estado }], de la más reciente a la más antigua.
// Devuelve { conteo, montoAcumulado, compras, mensaje }. mensaje es SIN_COMPRAS si el listado está vacío.
export function resumirHistorial(compras) {
  const realizadas = compras.filter(cuentaComoCompra)
  const centimos = realizadas.reduce((total, c) => total + aCentimos(c.monto), 0)
  return {
    conteo: realizadas.length,
    montoAcumulado: centimos / 100,
    compras,
    mensaje: compras.length ? null : SIN_COMPRAS,
  }
}
