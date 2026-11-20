// US17 - T84/T85: validación de la reseña que publica el cliente. Mismas reglas y mensajes que
// validarYPublicarResena de src/reglasComplementarias.js (pruebas de QA). El frontend las repite para avisar antes.

export const COMENTARIO_MAX = 500 // debe coincidir con el CHECK de resenas.comentario (migración 012)

// Devuelve { datos, errores }. errores es un objeto campo → mensaje; vacío si todo es válido.
export function validarResena(body) {
  const datos = {
    calificacion: body?.calificacion,
    comentario: typeof body?.comentario === 'string' ? body.comentario.trim() : '',
  }
  const errores = {}
  if (!Number.isInteger(datos.calificacion) || datos.calificacion < 1 || datos.calificacion > 5) {
    errores.calificacion = 'La calificación debe ser un número entero entre 1 y 5 estrellas.'
  }
  if (!datos.comentario || datos.comentario.length > COMENTARIO_MAX) {
    errores.comentario = `El comentario de la reseña es obligatorio y no debe superar ${COMENTARIO_MAX} caracteres.`
  }
  return { datos, errores }
}
