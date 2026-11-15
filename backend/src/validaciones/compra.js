// US13 - T59/T62: validación del carrito que envía el cliente al confirmar la compra.
// Solo revisa la forma de los datos; el precio y la disponibilidad se toman del catálogo en la BD (T61).
import { CANTIDAD_MAXIMA } from '../orden.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAXIMO_PRODUCTOS = 30

const esEnteroPositivo = (x) => Number.isInteger(x) && x > 0

// Devuelve { datos, errores }. datos.carrito junta las líneas repetidas de un mismo producto.
export function validarCarrito(body) {
  const errores = {}
  const emolienteroId = typeof body?.emolienteroId === 'string' ? body.emolienteroId : ''
  const lineas = Array.isArray(body?.lineas) ? body.lineas : []

  if (!UUID.test(emolienteroId)) errores.emolienteroId = 'Indica a qué emolientero le compras.'

  if (!lineas.length) {
    errores.carrito = 'Tu carrito está vacío. Agrega al menos un producto.'
  } else if (lineas.length > MAXIMO_PRODUCTOS) {
    errores.carrito = `Tu carrito puede tener hasta ${MAXIMO_PRODUCTOS} productos.`
  } else if (!lineas.every((l) => esEnteroPositivo(l?.productoId) && esEnteroPositivo(l?.cantidad))) {
    errores.carrito = 'Hay productos o cantidades no válidos en tu carrito.'
  }

  // Un mismo producto agregado dos veces se cuenta como una sola línea con la cantidad sumada.
  const porProducto = new Map()
  if (!errores.carrito) {
    for (const { productoId, cantidad } of lineas) porProducto.set(productoId, (porProducto.get(productoId) ?? 0) + cantidad)
    if ([...porProducto.values()].some((c) => c > CANTIDAD_MAXIMA)) {
      errores.carrito = `Puedes pedir hasta ${CANTIDAD_MAXIMA} unidades de cada producto.`
    }
  }

  const carrito = [...porProducto].map(([productoId, cantidad]) => ({ productoId, cantidad }))
  return { datos: { emolienteroId, carrito }, errores }
}
