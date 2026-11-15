// US25: moderación de contenido.
import { pedirConSesion } from './authService.js'

// Cualquier usuario con sesión puede reportar una reseña.
export const reportarResena = (resenaId, motivo) => pedirConSesion(`/moderacion/resenas/${resenaId}/reportes`, { method: 'POST', body: { motivo } })

// Solo administrador.
export const listarReportes = (estado = 'pendientes') => pedirConSesion(`/moderacion/reportes?estado=${estado}`)
export const decidirReporte = (id, decision, nota) => pedirConSesion(`/moderacion/reportes/${id}/decision`, { method: 'POST', body: { decision, nota } })
