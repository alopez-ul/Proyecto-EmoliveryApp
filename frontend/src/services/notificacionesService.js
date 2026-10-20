// Notificaciones del usuario con sesión iniciada (US23 - T31).
import { pedirConSesion } from './authService.js'

export const listarNotificaciones = () => pedirConSesion('/notificaciones')
export const marcarLeida = (id) => pedirConSesion(`/notificaciones/${id}/leida`, { method: 'POST' })
