// US25 - Moderación de contenido: reglas del reporte y de la decisión (no usa la base de datos).
import { ErrorHttp } from './errores.js'

export const PENALIZACION_REPUTACION = 10 // T106: puntos que pierde el autor si se oculta su reseña
export const REPUTACION_MINIMA = 0

// Decisión del administrador → estado en que queda el reporte.
export const DECISIONES = { ocultar: 'oculto', mantener: 'mantenido' }

const texto = (x) => (typeof x === 'string' ? x.trim().replace(/\s+/g, ' ') : '')

// Reporte de un usuario: el motivo es obligatorio (10 a 300 caracteres).
export function validarReporte(body) {
  const datos = { motivo: texto(body?.motivo) }
  const errores = {}
  if (datos.motivo.length < 10 || datos.motivo.length > 300) errores.motivo = 'Explica el motivo del reporte (entre 10 y 300 caracteres).'
  return { datos, errores }
}

// T105: decisión del administrador. La nota es obligatoria para que quede registrado el porqué (RNF06).
export function validarDecision(body) {
  const datos = { decision: body?.decision, nota: texto(body?.nota) }
  const errores = {}
  if (!Object.hasOwn(DECISIONES, datos.decision)) errores.decision = 'Elige ocultar o mantener el contenido.'
  if (datos.nota.length < 10 || datos.nota.length > 500) errores.nota = 'Registra el motivo de la decisión (entre 10 y 500 caracteres).'
  return { datos, errores }
}

// T107: solo se decide sobre reportes pendientes cuyo contenido aún existe.
// - reporte ya atendido → 409
// - contenido eliminado por su autor (resenaId null) → 410
export function verificarDecidible(reporte) {
  if (!reporte) throw new ErrorHttp(404, 'Reporte no encontrado.')
  if (reporte.estado !== 'pendiente') throw new ErrorHttp(409, 'Este reporte ya fue atendido.')
  if (reporte.resenaId == null) throw new ErrorHttp(410, 'El contenido fue eliminado por su autor. El reporte se cerró sin decisión.')
}

// T106: reputación del autor después de la decisión. Ocultar resta puntos (sin bajar de 0); mantener no cambia nada.
export function reputacionTrasDecision(actual, decision) {
  return decision === 'ocultar' ? Math.max(REPUTACION_MINIMA, actual - PENALIZACION_REPUTACION) : actual
}
