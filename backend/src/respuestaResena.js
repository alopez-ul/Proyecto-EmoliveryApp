// US19 - Respuesta del emolientero: reglas de la respuesta (no usa la base de datos).
import { ErrorHttp } from './errores.js'

export const RESPUESTA_MIN = 2
export const RESPUESTA_MAX = 500 // debe coincidir con el CHECK de 016_respuesta_resenas.sql

export function validarRespuesta(body) {
  const datos = { respuesta: typeof body?.respuesta === 'string' ? body.respuesta.trim().replace(/[ \t]+/g, ' ') : '' }
  const errores = {}
  if (datos.respuesta.length < RESPUESTA_MIN || datos.respuesta.length > RESPUESTA_MAX) {
    errores.respuesta = `Escribe tu respuesta (entre ${RESPUESTA_MIN} y ${RESPUESTA_MAX} caracteres).`
  }
  return { datos, errores }
}

// T91: por qué no se puede responder. resena: { emolienteroId, publicadaEn, ocultaEn, respuesta } o null.
export function verificarRespondible(resena, emolienteroId) {
  // Una reseña de otro emolientero se trata como inexistente, para no revelar cuáles existen.
  if (!resena || resena.emolienteroId !== emolienteroId || !resena.publicadaEn) throw new ErrorHttp(404, 'Reseña no encontrada.')
  if (resena.ocultaEn) throw new ErrorHttp(409, 'Esta reseña fue ocultada por moderación y no admite respuesta.')
  if (resena.respuesta) throw new ErrorHttp(409, 'Ya respondiste esta reseña. Solo se admite una respuesta.')
}
