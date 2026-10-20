// US06: apertura y cierre de jornada (solo emolientero con sesión).
import { pedirConSesion } from './authService.js'

export const estadoJornada = () => pedirConSesion('/jornadas/estado')
export const abrirJornada = () => pedirConSesion('/jornadas/abrir', { method: 'POST' })
export const cerrarJornada = () => pedirConSesion('/jornadas/cerrar', { method: 'POST' })
