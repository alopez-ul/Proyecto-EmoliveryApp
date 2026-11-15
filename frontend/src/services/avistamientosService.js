// US09: el cliente confirma que ve al emolientero donde lo muestra el mapa (solo con sesión de cliente).
import { pedirConSesion } from './authService.js'

export const RADIO_CONFIRMACION_M = 100 // igual que backend/src/fuentesUbicacion.js

export const confirmarAvistamiento = (emolienteroId, { lat, lng, precision }) =>
  pedirConSesion('/avistamientos', { method: 'POST', body: { emolienteroId, lat, lng, precision } })
