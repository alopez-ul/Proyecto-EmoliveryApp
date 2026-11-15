// Servicio Frontend para US14 (Pago con QR de Yape)
// Sincroniza la validación de constancias con POST /api/pagos/yape/validar cuando el backend
// está activo y garantiza operación 100% autónoma en el navegador mediante PagoController / Yape.

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
