// US11: catálogo de productos del emolientero (solo con sesión de emolientero).
import { pedirConSesion } from './authService.js'

export const listarMiCatalogo = () => pedirConSesion('/catalogo')
export const crearProducto = (producto) => pedirConSesion('/catalogo', { method: 'POST', body: producto })
export const editarProducto = (id, producto) => pedirConSesion(`/catalogo/${id}`, { method: 'PATCH', body: producto })

// --- Reglas del formulario: mismas que backend/src/validaciones/producto.js (el backend es el que decide) ---

export const CATEGORIAS = {
  emoliente: 'Emolientes',
  bebida: 'Otras bebidas',
  acompanamiento: 'Acompañamientos',
}

const PRECIO_MAXIMO = 100

// Devuelve un objeto campo → mensaje (vacío si todo es válido). `existentes` sirve para avisar del nombre repetido.
export function validarProducto({ nombre, categoria, precio }, existentes = [], idPropio = null) {
  const errores = {}
  const limpio = nombre.trim().replace(/\s+/g, ' ')
  if (limpio.length < 3 || limpio.length > 60) errores.nombre = 'El nombre debe tener entre 3 y 60 caracteres.'
  else if (existentes.some((p) => p.id !== idPropio && p.nombre.toLowerCase() === limpio.toLowerCase())) {
    errores.nombre = 'Ya tienes un producto con ese nombre en tu catálogo.'
  }
  if (!CATEGORIAS[categoria]) errores.categoria = 'Elige una categoría.'

  const valor = Number(precio)
  if (precio === '' || !Number.isFinite(valor)) errores.precio = 'Ingresa el precio.'
  else if (valor <= 0) errores.precio = 'El precio debe ser mayor que cero.'
  else if (valor > PRECIO_MAXIMO) errores.precio = `El precio no puede superar S/ ${PRECIO_MAXIMO}.`
  else if (Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-9) errores.precio = 'El precio admite como máximo dos decimales.'
  return errores
}
