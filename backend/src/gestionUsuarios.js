// US24 - Gestión de usuarios registrados: filtros, totales y motivo (no usa la base de datos).

export const ROLES = ['cliente', 'emolientero', 'admin']
export const ESTADOS = ['activo', 'pendiente_verificacion', 'rechazado', 'suspendido']
export const MOTIVO_MIN = 10
export const MOTIVO_MAX = 500 // deben coincidir con el CHECK de 018_suspensiones.sql

const FECHA = /^\d{4}-\d{2}-\d{2}$/
// Rechaza también fechas imposibles como 2026-02-30 (Date las convertiría en 2026-03-02).
function esFechaValida(texto) {
  const fecha = new Date(`${texto}T00:00:00Z`)
  return FECHA.test(texto) && !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto
}

// T100: filtros del listado (todos opcionales). Fechas en formato AAAA-MM-DD, ambas inclusive.
export function validarFiltros(consulta = {}) {
  const datos = {
    rol: consulta.rol || null,
    estado: consulta.estado || null,
    desde: consulta.desde || null,
    hasta: consulta.hasta || null,
  }
  const errores = {}
  if (datos.rol && !ROLES.includes(datos.rol)) errores.rol = 'Rol no válido.'
  if (datos.estado && !ESTADOS.includes(datos.estado)) errores.estado = 'Estado no válido.'
  if (datos.desde && !esFechaValida(datos.desde)) errores.desde = 'Fecha "desde" no válida (AAAA-MM-DD).'
  if (datos.hasta && !esFechaValida(datos.hasta)) errores.hasta = 'Fecha "hasta" no válida (AAAA-MM-DD).'
  if (!errores.desde && !errores.hasta && datos.desde && datos.hasta && datos.desde > datos.hasta) {
    errores.hasta = 'La fecha "hasta" no puede ser anterior a "desde".'
  }
  return { datos, errores }
}

// T101: totales por categoría (rol y estado) de los usuarios listados. Incluye las categorías en 0.
export function calcularTotales(usuarios) {
  const contar = (campo, claves) => Object.fromEntries(claves.map((k) => [k, usuarios.filter((u) => u[campo] === k).length]))
  return { total: usuarios.length, porRol: contar('rol', ROLES), porEstado: contar('estado', ESTADOS) }
}

export function validarMotivo(body) {
  const datos = { motivo: typeof body?.motivo === 'string' ? body.motivo.trim().replace(/\s+/g, ' ') : '' }
  const errores = {}
  if (datos.motivo.length < MOTIVO_MIN || datos.motivo.length > MOTIVO_MAX) {
    errores.motivo = `Indica el motivo (entre ${MOTIVO_MIN} y ${MOTIVO_MAX} caracteres).`
  }
  return { datos, errores }
}
