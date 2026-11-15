// US13: carrito y compra anticipada (el cliente confirma con sesión de cliente).
import { pedirConSesion } from './authService.js'

export const VIGENCIA_PAGO_MIN = 15 // igual que backend/src/orden.js
export const CANTIDAD_MAXIMA = 20 // por producto, igual que backend/src/orden.js

// T60/T61: el backend valida jornada y disponibilidad, congela los precios y crea la orden pendiente de pago.
export const confirmarCompra = (emolienteroId, lineas) => pedirConSesion('/ordenes', { method: 'POST', body: { emolienteroId, lineas } })
export const obtenerOrden = (id) => pedirConSesion(`/ordenes/${id}`)

// --- T59: carrito ---
// Se guarda en sessionStorage, uno por emolientero, solo con { productoId, cantidad }: el nombre y el precio
// se leen siempre del catálogo actual. El precio definitivo lo congela el backend al confirmar.

const clave = (emolienteroId) => `emolivery.carrito.${emolienteroId}`

export function leerCarrito(emolienteroId) {
  try {
    const lineas = JSON.parse(sessionStorage.getItem(clave(emolienteroId)))
    return Array.isArray(lineas) ? lineas : []
  } catch {
    return []
  }
}

export function guardarCarrito(emolienteroId, lineas) {
  try {
    if (lineas.length) sessionStorage.setItem(clave(emolienteroId), JSON.stringify(lineas))
    else sessionStorage.removeItem(clave(emolienteroId))
  } catch {
    // Sin almacenamiento (p. ej. modo privado estricto): el carrito vive solo mientras la página esté abierta.
  }
}

// Fija la cantidad de un producto (0 lo quita). Devuelve un carrito nuevo, sin modificar el anterior.
export function cambiarCantidad(lineas, productoId, cantidad) {
  const limitada = Math.min(Math.max(cantidad, 0), CANTIDAD_MAXIMA)
  const sinProducto = lineas.filter((l) => l.productoId !== productoId)
  if (!limitada) return sinProducto
  const existe = lineas.some((l) => l.productoId === productoId)
  return existe ? lineas.map((l) => (l.productoId === productoId ? { ...l, cantidad: limitada } : l)) : [...lineas, { productoId, cantidad: limitada }]
}

export const cantidadEnCarrito = (lineas, productoId) => lineas.find((l) => l.productoId === productoId)?.cantidad ?? 0

// T59: total con los precios actuales del catálogo, sumando en céntimos para evitar errores de redondeo.
export function totalCarrito(lineas, productosPorId) {
  const centimos = lineas.reduce((suma, l) => {
    const producto = productosPorId.get(l.productoId)
    return producto ? suma + Math.round(producto.precio * 100) * l.cantidad : suma
  }, 0)
  return centimos / 100
}
