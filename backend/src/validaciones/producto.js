// US11 - T51: validación de un producto del catálogo (precio, categoría obligatoria y nombre único).
// Es la que decide; el frontend repite estas reglas solo para avisar antes de enviar.

// Clave guardada en la BD → nombre que se muestra. Debe coincidir con el CHECK de 009_catalogo.sql.
export const CATEGORIAS = {
  emoliente: 'Emolientes',
  bebida: 'Otras bebidas',
  acompanamiento: 'Acompañamientos',
}

export const PRECIO_MAXIMO = 100

// true si el número tiene como máximo dos decimales (céntimos): 2.5 y 2.50 sí, 2.555 no.
const tieneCentimos = (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9

// Devuelve { datos, errores }. errores es un objeto campo → mensaje; vacío si todo es válido.
export function validarProducto(body) {
  const datos = {
    nombre: typeof body?.nombre === 'string' ? body.nombre.trim().replace(/\s+/g, ' ') : '',
    categoria: body?.categoria,
    precio: body?.precio,
    disponible: body?.disponible ?? true,
  }
  const errores = {}

  if (datos.nombre.length < 3 || datos.nombre.length > 60) {
    errores.nombre = 'El nombre debe tener entre 3 y 60 caracteres.'
  }
  if (!Object.hasOwn(CATEGORIAS, datos.categoria)) {
    errores.categoria = 'Elige una categoría.'
  }
  if (typeof datos.precio !== 'number' || !Number.isFinite(datos.precio)) {
    errores.precio = 'Ingresa el precio.'
  } else if (datos.precio <= 0) {
    errores.precio = 'El precio debe ser mayor que cero.'
  } else if (datos.precio > PRECIO_MAXIMO) {
    errores.precio = `El precio no puede superar S/ ${PRECIO_MAXIMO}.`
  } else if (!tieneCentimos(datos.precio)) {
    errores.precio = 'El precio admite como máximo dos decimales.'
  }
  if (typeof datos.disponible !== 'boolean') {
    errores.disponible = 'Indica si el producto está disponible.'
  }

  return { datos, errores }
}

// Producto existente con el mismo nombre (sin distinguir mayúsculas), o null si no hay.
// `idPropio` excluye al producto que se está editando, para que pueda conservar su nombre.
export function buscarNombreRepetido(nombre, existentes, idPropio = null) {
  const buscado = nombre.toLowerCase()
  return existentes.find((p) => p.id !== idPropio && p.nombre.toLowerCase() === buscado) ?? null
}
