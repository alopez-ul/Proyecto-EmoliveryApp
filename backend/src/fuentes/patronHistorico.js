// US10 - T48: PatronHistorico, fuente de localización de BAJA precisión.
// No usa GPS: deduce dónde suele estar un emolientero a partir de sus puntos habituales (día y rango
// horario). Es el último recurso de la jerarquía de fuentes: si el emolientero tiene la jornada abierta,
// manda su GPS (US05/US06) y esta fuente no lo incluye.
import { query } from '../db.js'
import { aMinutos } from '../validaciones/puntoHabitual.js'

const ZONA_HORARIA = 'America/Lima'
const DIA_ISO = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
const formatoLima = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_HORARIA, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

export class PatronHistorico {
  // Mismo valor que admite la columna ubicaciones.fuente.
  static FUENTE = 'horario_habitual'
  // Radio de incertidumbre que se informa (el GPS exige 50 m o mejor): el emolientero está "por la zona".
  static PRECISION_M = 300

  // Día ISO (1 = lunes) y minutos desde la medianoche, en hora de Lima, del instante dado.
  static momentoEnLima(fecha) {
    const partes = Object.fromEntries(formatoLima.formatToParts(fecha).map((p) => [p.type, p.value]))
    return { diaSemana: DIA_ISO[partes.weekday], minutos: Number(partes.hour) * 60 + Number(partes.minute) }
  }

  // Punto habitual que corresponde al instante dado (rango [inicio, fin)), o null.
  static puntoVigente(puntos, fecha) {
    const { diaSemana, minutos } = PatronHistorico.momentoEnLima(fecha)
    return (
      puntos.find((p) => p.diaSemana === diaSemana && aMinutos(p.horaInicio) <= minutos && minutos < aMinutos(p.horaFin)) ?? null
    )
  }

  // Ubicación estimada de cada emolientero activo SIN jornada abierta que, según su horario, suele
  // estar en un punto a esta hora. Como los rangos no se traslapan, hay a lo sumo una por emolientero.
  static async estimar(fecha = new Date()) {
    const { diaSemana } = PatronHistorico.momentoEnLima(fecha)
    const { rows } = await query(
      `SELECT ph.id, ph.emolientero_id AS "emolienteroId", u.nombre, ph.referencia, ph.lat, ph.lng,
              ph.dia_semana AS "diaSemana",
              to_char(ph.hora_inicio, 'HH24:MI') AS "horaInicio", to_char(ph.hora_fin, 'HH24:MI') AS "horaFin"
       FROM puntos_habituales ph
       JOIN usuarios u ON u.id = ph.emolientero_id
       WHERE ph.dia_semana = $1 AND u.rol = 'emolientero' AND u.estado = 'activo'
         AND NOT EXISTS (SELECT 1 FROM jornadas j WHERE j.emolientero_id = u.id AND j.cerrada_en IS NULL)`,
      [diaSemana],
    )
    return rows
      .filter((p) => PatronHistorico.puntoVigente([p], fecha))
      .map((p) => ({ ...p, precisionM: PatronHistorico.PRECISION_M, fuente: PatronHistorico.FUENTE }))
  }
}
