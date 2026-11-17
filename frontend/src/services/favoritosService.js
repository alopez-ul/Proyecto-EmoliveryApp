// Servicio Frontend para US21 (Emolienteros Favoritos)
// Sincroniza acciones con /api/favoritos cuando el backend está activo y opera de forma
// 100% autónoma en el navegador mediante FavoritoService y localStorage.

import { CLIENTE_DEMO_ID, FavoritoService } from '../domain/favoritos/index.js'

const servicioGlobalFavoritos = new FavoritoService()

export function obtenerInstanciaFavoritoService() {
  return servicioGlobalFavoritos
}

export async function alternarFavoritoRemotoOLocal(emolienteroId, clienteId = CLIENTE_DEMO_ID) {
  const resultadoLocal = servicioGlobalFavoritos.alternarFavorito(clienteId, emolienteroId)

  try {
    await fetch('/api/favoritos/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId, emolienteroId }),
    })
  } catch {
    // Continúa en modo autónomo local
  }

  return resultadoLocal
}

export async function simularAperturaJornadaFavoritoRemotoOLocal( servicio, payload ) {
  const resultadoLocal = servicio.procesarAperturaJornada(payload)

  try {
    await fetch('/api/favoritos/apertura-jornada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // Continúa en modo autónomo local
  }

  return resultadoLocal
}
