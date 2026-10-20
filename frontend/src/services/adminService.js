// US23 - Verificación de emolienteros (solo administradores).
import { pedirConSesion } from './authService.js'

export const MOTIVO_MIN = 10
export const MOTIVO_MAX = 500

export const listarPendientes = () => pedirConSesion('/admin/emolienteros/pendientes')
export const listarHistorial = () => pedirConSesion('/admin/emolienteros/historial')
export const aprobarEmolientero = (id) => pedirConSesion(`/admin/emolienteros/${id}/aprobar`, { method: 'POST' })
export const rechazarEmolientero = (id, motivo) =>
  pedirConSesion(`/admin/emolienteros/${id}/rechazar`, { method: 'POST', body: { motivo } })
