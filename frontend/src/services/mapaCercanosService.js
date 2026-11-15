// Servicio Frontend para US07 (Mapa de Emolienteros Cercanos)
// Intenta consultar el endpoint del backend GET /api/mapa/cercanos y opera con fallback autónomo
// en el navegador usando MapaController / Localizador si el backend no está levantado.

import { MapaController } from '../domain/ubicacion/index.js'

const controladorLocal = new MapaController()

export async function consultarEmolienterosCercanos({
  lat,
  lng,
  radio = 1000,
  orden = 'distancia',
  zona = '',
  q = '',
} = {}) {
  const params = new URLSearchParams()
  if (lat !== undefined && lat !== null) params.set('lat', String(lat))
  if (lng !== undefined && lng !== null) params.set('lng', String(lng))
  if (radio) params.set('radio', String(radio))
  if (orden) params.set('orden', orden)
  if (zona) params.set('zona', zona)
  if (q) params.set('q', q)

  try {
    const res = await fetch(`/api/mapa/cercanos?${params.toString()}`)
    if (res.ok) {
      return await res.json()
    }
  } catch {
    // Fallback autónomo local en el navegador
  }

  if (zona && (lat === undefined || lat === null)) {
    return controladorLocal.obtenerPorZona({ zona, textoBusqueda: q })
  }

  return controladorLocal.obtenerCercanos({
    latitud: Number(lat),
    longitud: Number(lng),
    radioMetros: Number(radio),
    tipoOrden: orden,
  })
}
