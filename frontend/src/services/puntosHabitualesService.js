// US10: puntos habituales del emolientero (solo con sesión de emolientero).
import { pedirConSesion } from './authService.js'

export const listarPuntosHabituales = () => pedirConSesion('/puntos-habituales')
export const crearPuntoHabitual = (punto) => pedirConSesion('/puntos-habituales', { method: 'POST', body: punto })
export const eliminarPuntoHabitual = (id) => pedirConSesion(`/puntos-habituales/${id}`, { method: 'DELETE' })

// Pública: ubicación aproximada (PatronHistorico, baja precisión) de quien no tiene la jornada abierta.
export async function listarUbicacionesEstimadas() {
  const res = await fetch('/api/ubicaciones/estimadas')
  if (!res.ok) throw new Error('No se pudieron cargar las ubicaciones aproximadas.')
  return res.json()
}

// --- Reglas del formulario: mismas que backend/src/validaciones/puntoHabitual.js (el backend es el que decide) ---

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] // 1 = lunes
export const CENTRO_LA_MOLINA = { lat: -12.0867, lng: -76.9405 }
// Igual que LA_MOLINA de backend/src/zonaCobertura.js.
const LA_MOLINA = { latMin: -12.135, latMax: -12.055, lngMin: -76.975, lngMax: -76.865 }

const aMinutos = (hora) => {
  const partes = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora ?? '')
  return partes ? Number(partes[1]) * 60 + Number(partes[2]) : null
}

export const seTraslapan = (a, b) =>
  a.diaSemana === b.diaSemana && aMinutos(a.horaInicio) < aMinutos(b.horaFin) && aMinutos(b.horaInicio) < aMinutos(a.horaFin)

// Devuelve un objeto campo → mensaje (vacío si todo es válido). `existentes` sirve para avisar del traslape.
export function validarPuntoHabitual({ referencia, zona, diaSemana, horaInicio, horaFin }, existentes = []) {
  const errores = {}
  const ref = referencia.trim()
  if (ref.length < 3 || ref.length > 100) errores.referencia = 'La referencia de la zona debe tener entre 3 y 100 caracteres.'
  if (!zona) errores.ubicacion = 'Marca la zona en el mapa.'
  else if (zona.lat < LA_MOLINA.latMin || zona.lat > LA_MOLINA.latMax || zona.lng < LA_MOLINA.lngMin || zona.lng > LA_MOLINA.lngMax) {
    errores.ubicacion = 'La zona debe estar dentro de La Molina.'
  }
  if (!diaSemana) errores.diaSemana = 'Elige un día de la semana.'

  const inicio = aMinutos(horaInicio)
  const fin = aMinutos(horaFin)
  if (inicio === null) errores.horaInicio = 'Ingresa la hora de inicio.'
  if (fin === null) errores.horaFin = 'Ingresa la hora de fin.'
  if (inicio !== null && fin !== null && fin <= inicio) errores.horaFin = 'La hora de fin debe ser posterior a la hora de inicio.'

  if (!errores.diaSemana && !errores.horaInicio && !errores.horaFin) {
    const conflicto = existentes.find((p) => seTraslapan({ diaSemana, horaInicio, horaFin }, p))
    if (conflicto) {
      errores.horaInicio = `Se cruza con tu punto "${conflicto.referencia}" del ${DIAS_SEMANA[conflicto.diaSemana - 1].toLowerCase()} de ${conflicto.horaInicio} a ${conflicto.horaFin}. No puedes estar en dos zonas a la misma hora.`
    }
  }
  return errores
}
