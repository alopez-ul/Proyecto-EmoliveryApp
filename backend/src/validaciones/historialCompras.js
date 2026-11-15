// US20 - T77: validación del filtro por rango de fechas del historial de compras.
// Es la que decide; el frontend repite estas reglas solo para avisar antes de consultar.

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/

// "2026-11-15" → true si es una fecha real del calendario (no acepta 2026-02-30).
export function esFechaValida(texto) {
  const partes = typeof texto === 'string' ? FECHA.exec(texto) : null
  if (!partes) return false
  const [, a, m, d] = partes.map(Number)
  const fecha = new Date(Date.UTC(a, m - 1, d))
  return fecha.getUTCFullYear() === a && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d
}

// Ambas fechas son opcionales e inclusivas (días completos en hora de Lima).
// Devuelve { datos: { desde, hasta }, errores }. errores es un objeto campo → mensaje; vacío si todo es válido.
export function validarRangoFechas(params) {
  const limpiar = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const datos = { desde: limpiar(params?.desde), hasta: limpiar(params?.hasta) }
  const errores = {}

  if (datos.desde && !esFechaValida(datos.desde)) errores.desde = 'La fecha inicial no es válida (AAAA-MM-DD).'
  if (datos.hasta && !esFechaValida(datos.hasta)) errores.hasta = 'La fecha final no es válida (AAAA-MM-DD).'
  // Las fechas AAAA-MM-DD se comparan bien como texto.
  if (!Object.keys(errores).length && datos.desde && datos.hasta && datos.desde > datos.hasta) {
    errores.hasta = 'La fecha final no puede ser anterior a la inicial.'
  }
  return { datos, errores }
}
