// US19: el emolientero responde las reseñas de su negocio.
import { pedirConSesion } from './authService.js'

export const RESPUESTA_MAX = 500 // debe coincidir con backend/src/respuestaResena.js
export const misResenas = () => pedirConSesion('/resenas/mias')
export const responderResena = (id, respuesta) => pedirConSesion(`/resenas/${id}/respuesta`, { method: 'POST', body: { respuesta } })
