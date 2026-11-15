// US22 - T97/T99: validación del formulario de noticia. Es la que decide; el frontend repite estas
// reglas solo para avisar antes de enviar.

// Clave guardada en la BD → nombre que se muestra. Debe coincidir con el CHECK de 015_noticias.sql.
export const PUBLICOS = { todos: 'Todos', clientes: 'Clientes', emolienteros: 'Emolienteros' }

// Público de las noticias que ve cada rol (además de las de 'todos').
export const PUBLICO_DEL_ROL = { cliente: 'clientes', emolientero: 'emolienteros' }

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/
const formatoLima = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }) // en-CA da AAAA-MM-DD

// Fecha de hoy en Lima como "AAAA-MM-DD" (se compara como texto: el formato ordena igual que la fecha).
export const hoyEnLima = (ahora = new Date()) => formatoLima.format(ahora)

// true si "AAAA-MM-DD" es una fecha real del calendario (descarta 2026-02-30).
export function esFechaReal(texto) {
  const partes = FECHA.exec(texto ?? '')
  if (!partes) return false
  const [, a, m, d] = partes.map(Number)
  const fecha = new Date(Date.UTC(a, m - 1, d))
  return fecha.getUTCFullYear() === a && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d
}

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '')

// Devuelve { datos, errores }. errores es un objeto campo → mensaje; vacío si todo es válido.
export function validarNoticia(body, hoy = hoyEnLima()) {
  const datos = {
    titulo: texto(body?.titulo).replace(/\s+/g, ' '),
    // En el contenido se respetan los saltos de línea.
    contenido: texto(body?.contenido),
    publico: body?.publico,
    fechaPublicacion: texto(body?.fechaPublicacion),
  }
  const errores = {}

  if (datos.titulo.length < 5 || datos.titulo.length > 120) errores.titulo = 'El título debe tener entre 5 y 120 caracteres.'
  if (datos.contenido.length < 10 || datos.contenido.length > 2000) {
    errores.contenido = 'El contenido debe tener entre 10 y 2000 caracteres.'
  }
  if (!Object.hasOwn(PUBLICOS, datos.publico)) errores.publico = 'Elige el público objetivo.'
  if (!esFechaReal(datos.fechaPublicacion)) {
    errores.fechaPublicacion = 'Ingresa una fecha de publicación válida.'
  } else if (datos.fechaPublicacion < hoy) {
    errores.fechaPublicacion = 'La fecha de publicación no puede ser anterior a hoy.'
  }

  return { datos, errores }
}
