// US20: historial de compras del cliente.
import { pedirConSesion } from './authService.js'

export const SIN_COMPRAS = 'No se encontraron compras en este periodo.'

// rango: { desde, hasta } en AAAA-MM-DD; las vacías no se envían.
export function obtenerHistorial({ desde, hasta } = {}) {
  const params = new URLSearchParams()
  if (desde) params.set('desde', desde)
  if (hasta) params.set('hasta', hasta)
  const consulta = params.toString()
  return pedirConSesion(`/compras${consulta ? `?${consulta}` : ''}`)
}

// Misma regla que backend/src/validaciones/historialCompras.js (el backend es el que decide).
export function validarRango({ desde, hasta }) {
  const errores = {}
  if (desde && hasta && desde > hasta) errores.hasta = 'La fecha final no puede ser anterior a la inicial.'
  return errores
}

// Nombre legible de cada estado de la orden (US13-US16). Un estado no previsto se muestra tal cual.
export const ESTADOS = {
  pendiente: 'Pendiente de pago',
  pagada: 'Pagada',
  en_camino: 'En camino',
  entregada: 'Entregada',
  cancelada: 'Cancelada',
}

export const nombreEstado = (estado) => ESTADOS[estado] ?? estado
