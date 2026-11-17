// Servicio Frontend para US14 (Pago con QR de Yape)
// Sincroniza la validación de constancias con POST /api/pagos/yape/validar cuando el backend
// está activo y garantiza operación 100% autónoma en el navegador mediante PagoController / Yape.
import { pedirConSesion } from './authService.js'

export async function validarPagoYapeRemotoOLocal(controladorLocal, { orden, numeroOperacion, montoIngresado, ahora = new Date() }) {
  // Ejecutamos primero en el controlador local para actualizar bitácora y estado en memoria de inmediato
  const resultadoLocal = controladorLocal.procesarConstancia({
    orden,
    numeroOperacion,
    montoIngresado,
    ahora,
  })

  // Sincronización opcional con el endpoint del backend (no bloqueante si el servidor de API no está encendido)
  try {
    await fetch('/api/pagos/yape/validar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orden,
        numeroOperacion,
        montoIngresado,
        ahora: ahora instanceof Date ? ahora.toISOString() : ahora,
      }),
    })
  } catch {
    // Continúa con la resolución del dominio local en modo autónomo
  }

  return resultadoLocal
}

// Pago de una orden REAL de US13 (con sesión de cliente). El backend valida la constancia con las mismas
// reglas de Yape y, si es válida, la orden queda pagada y devuelve su código de recojo (US15).

export const pagarOrdenConYape = (ordenId, { numeroOperacion, montoIngresado }) =>
  pedirConSesion(`/pagos/yape/ordenes/${ordenId}`, { method: 'POST', body: { numeroOperacion, montoIngresado } })
