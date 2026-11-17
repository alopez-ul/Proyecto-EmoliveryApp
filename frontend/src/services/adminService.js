// US23 - Verificación de emolienteros (solo administradores).
import { pedirConSesion } from './authService.js'

export const MOTIVO_MIN = 10
export const MOTIVO_MAX = 500

export const listarPendientes = () => pedirConSesion('/admin/emolienteros/pendientes')
export const listarHistorial = () => pedirConSesion('/admin/emolienteros/historial')
export const aprobarEmolientero = (id) => pedirConSesion(`/admin/emolienteros/${id}/aprobar`, { method: 'POST' })
export const rechazarEmolientero = (id, motivo) =>
  pedirConSesion(`/admin/emolienteros/${id}/rechazar`, { method: 'POST', body: { motivo } })

// US24: gestión de usuarios registrados.
export const ROLES = { cliente: 'Clientes', emolientero: 'Emolienteros', admin: 'Administradores' }
export const ESTADOS = { activo: 'Activo', pendiente_verificacion: 'Pendiente', rechazado: 'Rechazado', suspendido: 'Suspendido' }
export const listarUsuarios = (filtros) => {
  const consulta = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v))
  return pedirConSesion(`/admin/usuarios?${consulta}`)
}
export const suspenderUsuario = (id, motivo) => pedirConSesion(`/admin/usuarios/${id}/suspender`, { method: 'POST', body: { motivo } })
export const reactivarUsuario = (id, motivo) => pedirConSesion(`/admin/usuarios/${id}/reactivar`, { method: 'POST', body: { motivo } })
