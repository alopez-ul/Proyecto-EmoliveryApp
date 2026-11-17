// US22: noticias (con sesión).
import { pedirConSesion } from './authService.js'

// Panel del usuario: noticias de su público cuya fecha ya llegó.
export const listarNoticias = () => pedirConSesion('/noticias')

// Administrador.
export const listarTodasLasNoticias = () => pedirConSesion('/noticias/todas')
export const publicarNoticia = (noticia) => pedirConSesion('/noticias', { method: 'POST', body: noticia })
export const eliminarNoticia = (id) => pedirConSesion(`/noticias/${id}`, { method: 'DELETE' })

// --- Reglas del formulario: mismas que backend/src/validaciones/noticia.js (el backend es el que decide) ---

export const PUBLICOS = { todos: 'Todos', clientes: 'Clientes', emolienteros: 'Emolienteros' }
export const TITULO_MAX = 120
export const CONTENIDO_MAX = 2000

// Hoy en Lima como "AAAA-MM-DD" (también sirve para el atributo min del campo de fecha).
export const hoyEnLima = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())

// "2026-11-15" → "15 nov 2026", sin que la zona horaria del navegador mueva el día.
export const formatearFecha = (iso) =>
  new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))

export function validarNoticia({ titulo, contenido, publico, fechaPublicacion }) {
  const errores = {}
  const t = titulo.trim().replace(/\s+/g, ' ')
  if (t.length < 5 || t.length > TITULO_MAX) errores.titulo = `El título debe tener entre 5 y ${TITULO_MAX} caracteres.`
  const c = contenido.trim()
  if (c.length < 10 || c.length > CONTENIDO_MAX) errores.contenido = `El contenido debe tener entre 10 y ${CONTENIDO_MAX} caracteres.`
  if (!PUBLICOS[publico]) errores.publico = 'Elige el público objetivo.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaPublicacion)) errores.fechaPublicacion = 'Ingresa una fecha de publicación válida.'
  else if (fechaPublicacion < hoyEnLima()) errores.fechaPublicacion = 'La fecha de publicación no puede ser anterior a hoy.'
  return errores
}
