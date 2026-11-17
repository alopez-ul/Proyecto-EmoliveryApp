// US20: historial de compras del cliente.
import { pedirConSesion } from './authService.js'

export const SIN_COMPRAS = 'No se encontraron compras en este periodo.'

// rango: { desde, hasta } en AAAA-MM-DD; las vacías no se envían.
export function obtenerHistorial({ desde, hasta } = {}) {
  const params = new URLSearchParams()
  if (desde) params.set('desde', desde)
  if (hasta) params.set('hasta', hasta)
  const consulta = params.toString()
  return pedirConSesion(`/historial-compras${consulta ? `?${consulta}` : ''}`)
}

// Misma regla que backend/src/validaciones/historialCompras.js (el backend es el que decide).
export function validarRango({ desde, hasta }) {
  const errores = {}
  if (desde && hasta && desde > hasta) errores.hasta = 'La fecha final no puede ser anterior a la inicial.'
  return errores
}

// Nombre legible de cada estado de la orden (US13-US16). Un estado no previsto se muestra tal cual.
// 'pendiente' es la orden ya pagada que espera ser recogida.
export const ESTADOS = {
  pendiente_pago: 'Pendiente de pago',
  pendiente: 'Pagada · por recoger',
  en_camino: 'En camino',
  entregada: 'Entregada',
  cancelada: 'Cancelada',
}

export const nombreEstado = (compra) => (compra.vencida ? 'Vencida sin pago' : ESTADOS[compra.estado] ?? compra.estado)

// Las órdenes pendientes de pago y las canceladas no suman al conteo ni al monto acumulado.
export const cuentaComoCompra = (compra) => !['pendiente_pago', 'cancelada'].includes(compra.estado)
