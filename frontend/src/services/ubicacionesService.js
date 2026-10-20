// US05: llamadas a la API de ubicaciones.
import { pedirConSesion } from './authService.js'

// Pública: ubicación actual de cada emolientero activo (para el mapa de los clientes).
export async function listarUbicaciones() {
  const res = await fetch('/api/ubicaciones')
  if (!res.ok) throw new Error('No se pudieron cargar las ubicaciones.')
  return res.json()
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
