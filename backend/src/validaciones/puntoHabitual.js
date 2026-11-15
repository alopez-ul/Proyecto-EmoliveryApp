// US10 - T47: validación de un punto habitual (zona, día y rango horario) y detección de traslapes.
// Es la que decide; el frontend repite estas reglas solo para avisar antes de enviar.
import { dentroDeLaMolina } from '../zonaCobertura.js'

// ISO 8601: 1 = lunes ... 7 = domingo.
export const DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/

// "08:30" → 510 (minutos desde la medianoche), o null si no es una hora HH:MM válida.
export function aMinutos(hora) {
  const partes = typeof hora === 'string' ? HORA.exec(hora.trim()) : null
  return partes ? Number(partes[1]) * 60 + Number(partes[2]) : null
}

const esNumero = (x) => typeof x === 'number' && Number.isFinite(x)

// Devuelve { datos, errores }. errores es un objeto campo → mensaje; vacío si todo es válido.
export function validarPuntoHabitual(body) {
  const datos = {
    referencia: typeof body?.referencia === 'string' ? body.referencia.trim().replace(/\s+/g, ' ') : '',
    lat: body?.lat,
    lng: body?.lng,
    diaSemana: body?.diaSemana,
    horaInicio: typeof body?.horaInicio === 'string' ? body.horaInicio.trim() : '',
    horaFin: typeof body?.horaFin === 'string' ? body.horaFin.trim() : '',
  }
  const errores = {}

  if (datos.referencia.length < 3 || datos.referencia.length > 100) {
    errores.referencia = 'La referencia de la zona debe tener entre 3 y 100 caracteres.'
  }
  if (!esNumero(datos.lat) || !esNumero(datos.lng)) {
    errores.ubicacion = 'Marca la zona en el mapa.'
  } else if (!dentroDeLaMolina(datos.lat, datos.lng)) {
    errores.ubicacion = 'La zona debe estar dentro de La Molina.'
  }
  if (!Number.isInteger(datos.diaSemana) || datos.diaSemana < 1 || datos.diaSemana > 7) {
    errores.diaSemana = 'Elige un día de la semana.'
  }

  const inicio = aMinutos(datos.horaInicio)
  const fin = aMinutos(datos.horaFin)
  if (inicio === null) errores.horaInicio = 'Ingresa la hora de inicio en formato HH:MM.'
  if (fin === null) errores.horaFin = 'Ingresa la hora de fin en formato HH:MM.'
  if (inicio !== null && fin !== null && fin <= inicio) {
    errores.horaFin = 'La hora de fin debe ser posterior a la hora de inicio.'
  }

  return { datos, errores }
}

// Dos rangos [inicio, fin) del mismo día se traslapan si cada uno empieza antes de que el otro termine.
// Que uno termine justo cuando empieza el otro (08:00-10:00 y 10:00-12:00) no es traslape.
export function seTraslapan(a, b) {
  return a.diaSemana === b.diaSemana && aMinutos(a.horaInicio) < aMinutos(b.horaFin) && aMinutos(b.horaInicio) < aMinutos(a.horaFin)
}

// Primer punto existente que choca con el nuevo, o null si no hay conflicto.
export function buscarTraslape(nuevo, existentes) {
  return existentes.find((p) => p.id !== nuevo.id && seTraslapan(nuevo, p)) ?? null
}

export function mensajeTraslape(conflicto) {
  return `Se cruza con tu punto "${conflicto.referencia}" del ${DIAS_SEMANA[conflicto.diaSemana - 1]} de ${conflicto.horaInicio} a ${conflicto.horaFin}. No puedes estar en dos zonas a la misma hora.`
}
