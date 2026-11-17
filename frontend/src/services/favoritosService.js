// Servicio Frontend para US21 (Emolienteros Favoritos)
// Sincroniza acciones con /api/favoritos cuando el backend está activo y opera de forma
// 100% autónoma en el navegador mediante FavoritoService y localStorage.

import { CLIENTE_DEMO_ID, FavoritoService } from '../domain/favoritos/index.js'
import { pedirConSesion } from './authService.js'

const servicioGlobalFavoritos = new FavoritoService()

export function obtenerInstanciaFavoritoService() {
  return servicioGlobalFavoritos
}

export async function alternarFavoritoRemotoOLocal(emolienteroId, clienteId = CLIENTE_DEMO_ID) {
  const resultadoLocal = servicioGlobalFavoritos.alternarFavorito(clienteId, emolienteroId)

  try {
    await fetch('/api/favoritos/demo/toggle', {
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
    await fetch('/api/favoritos/demo/apertura-jornada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // Continúa en modo autónomo local
  }

  return resultadoLocal
}

// ---------- Favoritos reales (BD, con sesión de cliente) ----------

export const misFavoritos = () => pedirConSesion('/favoritos')
export const directorioEmolienteros = () => pedirConSesion('/favoritos/directorio')
export const marcarFavorito = (emolienteroId) => pedirConSesion(`/favoritos/${emolienteroId}`, { method: 'POST' })
export const desmarcarFavorito = (emolienteroId) => pedirConSesion(`/favoritos/${emolienteroId}`, { method: 'DELETE' })
export const guardarPreferenciasAvisos = (preferencias) => pedirConSesion('/favoritos/preferencias', { method: 'PUT', body: preferencias })
