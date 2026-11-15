// Catálogo de productos de cada emolientero.
import { pedirConSesion } from './authService.js'

// US12: catálogo público de un emolientero (no requiere sesión).
export async function obtenerCatalogo(emolienteroId) {
  let res
  try {
    res = await fetch(`/api/catalogo/${encodeURIComponent(emolienteroId)}`)
  } catch {
    throw new Error('No se pudo conectar con el servidor. Inténtalo de nuevo.')
  }
  const datos = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(datos.error || 'No se pudo cargar el catálogo.'), { status: res.status })
  return datos
}

// US11: catálogo propio (solo con sesión de emolientero).
export const listarMiCatalogo = () => pedirConSesion('/catalogo')
export const crearProducto = (producto) => pedirConSesion('/catalogo', { method: 'POST', body: producto })
export const editarProducto = (id, producto) => pedirConSesion(`/catalogo/${id}`, { method: 'PATCH', body: producto })

// --- Reglas del formulario: mismas que backend/src/validaciones/producto.js (el backend es el que decide) ---

export const CATEGORIAS = {
  emoliente: 'Emolientes',
  quinua_avena: 'Quinua y avena',
  maca: 'Maca',
  bebida: 'Otras bebidas',
  acompanamiento: 'Acompañamientos',
}

const PRECIO_MAXIMO = 100
export const DESCRIPCION_MAXIMA = 200

// Devuelve un objeto campo → mensaje (vacío si todo es válido). `existentes` sirve para avisar del nombre repetido.
export function validarProducto({ nombre, descripcion = '', categoria, precio }, existentes = [], idPropio = null) {
  const errores = {}
  const limpio = nombre.trim().replace(/\s+/g, ' ')
  if (limpio.length < 3 || limpio.length > 60) errores.nombre = 'El nombre debe tener entre 3 y 60 caracteres.'
  else if (existentes.some((p) => p.id !== idPropio && p.nombre.toLowerCase() === limpio.toLowerCase())) {
    errores.nombre = 'Ya tienes un producto con ese nombre en tu catálogo.'
  }
  if (descripcion.trim().length > DESCRIPCION_MAXIMA) errores.descripcion = `La descripción puede tener hasta ${DESCRIPCION_MAXIMA} caracteres.`
  if (!CATEGORIAS[categoria]) errores.categoria = 'Elige una categoría.'

  const valor = Number(precio)
  if (precio === '' || !Number.isFinite(valor)) errores.precio = 'Ingresa el precio.'
  else if (valor <= 0) errores.precio = 'El precio debe ser mayor que cero.'
  else if (valor > PRECIO_MAXIMO) errores.precio = `El precio no puede superar S/ ${PRECIO_MAXIMO}.`
  else if (Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-9) errores.precio = 'El precio admite como máximo dos decimales.'
  return errores
}
