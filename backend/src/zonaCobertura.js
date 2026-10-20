// US05: reglas de validación de una ubicación (zona de cobertura y precisión del GPS).

// RNF09: el GPS debe reportar una precisión igual o mejor a 50 m.
export const PRECISION_MAXIMA_M = 50

// Zona piloto: distrito de La Molina. Por ahora es un rectángulo APROXIMADO (lat/lng).
// Para mayor exactitud se puede reemplazar por el polígono real del distrito (GeoJSON) y
// cambiar solo la función dentroDeLaMolina: el resto del sistema no se entera.
export const LA_MOLINA = { latMin: -12.135, latMax: -12.055, lngMin: -76.975, lngMax: -76.865 }

export function dentroDeLaMolina(lat, lng) {
  return lat >= LA_MOLINA.latMin && lat <= LA_MOLINA.latMax && lng >= LA_MOLINA.lngMin && lng <= LA_MOLINA.lngMax
}

const esNumero = (x) => typeof x === 'number' && Number.isFinite(x)

// Devuelve null si la ubicación es válida, o { status, error } con el motivo del rechazo.
export function validarUbicacion({ lat, lng, precision }) {
  if (!esNumero(lat) || !esNumero(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { status: 400, error: 'lat y lng deben ser coordenadas válidas.' }
  }
  if (!esNumero(precision) || precision <= 0) {
    return { status: 400, error: 'precision (en metros) debe ser un número mayor que 0.' }
  }
  if (!dentroDeLaMolina(lat, lng)) {
    return { status: 422, error: 'Ubicación fuera de la zona de cobertura.' }
  }
  if (precision > PRECISION_MAXIMA_M) {
    return {
      status: 422,
      error: `La precisión del GPS (${Math.round(precision)} m) no alcanza el mínimo de ${PRECISION_MAXIMA_M} m. Acércate a un lugar abierto e inténtalo de nuevo.`,
    }
  }
  return null
}
