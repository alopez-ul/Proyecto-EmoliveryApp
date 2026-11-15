// US05: llamadas a la API de ubicaciones.
import { pedirConSesion } from './authService.js'

// Pública: ubicación más confiable de cada emolientero activo (para el mapa de los clientes).
// US08: cada una trae antiguedadMin y confiabilidad ('alto' | 'medio' | 'bajo').
export async function listarUbicaciones() {
  const res = await fetch('/api/ubicaciones')
  if (!res.ok) throw new Error('No se pudieron cargar las ubicaciones.')
  return res.json()
}

// US08 - T44: antigüedad legible del dato.
export function formatearAntiguedad(min) {
  if (min < 1) return 'hace menos de 1 min'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  const resto = min % 60
  return resto ? `hace ${h} h ${resto} min` : `hace ${h} h`
}

// US08 - T44 (RNF15): el nivel se comunica con texto, no solo con color.
const NIVELES = { alto: 'Confiabilidad alta', medio: 'Confiabilidad media', bajo: 'Confiabilidad baja' }

export function describirConfiabilidad({ confiabilidad, antiguedadMin }) {
  return `${NIVELES[confiabilidad] ?? 'Confiabilidad desconocida'} · ${formatearAntiguedad(antiguedadMin)}`
}

// Con sesión de emolientero.
export const miUbicacion = () => pedirConSesion('/ubicaciones/mia')
export const registrarUbicacion = ({ lat, lng, precision }) =>
  pedirConSesion('/ubicaciones', { method: 'POST', body: { lat, lng, precision } })

// Pide la posición al GPS del dispositivo. Traduce los errores del navegador a mensajes claros.
export function obtenerPosicionGps() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Tu dispositivo no permite obtener la ubicación.'))
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: pos.coords.accuracy }),
      (err) => {
        const mensajes = {
          1: 'No diste permiso para usar tu ubicación. Actívalo en el navegador para poder registrarla.',
          2: 'No se pudo determinar tu posición. Revisa que el GPS esté encendido.',
          3: 'El GPS tardó demasiado en responder. Inténtalo de nuevo.',
        }
        reject(new Error(mensajes[err.code] ?? 'No se pudo obtener tu ubicación.'))
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    )
  })
}
