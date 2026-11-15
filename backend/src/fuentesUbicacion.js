// US08 - Confiabilidad de la ubicación.
// Jerarquía de fuentes de ubicación: cada subclase sabe qué tan confiable es su dato
// (calcularConfiabilidad) y la clase base aplica a todas la misma regla de vigencia (puntaje).
// Agregar una fuente nueva solo requiere una subclase y registrarla en FUENTES (RNF18).
import { query } from './db.js'
import { aMinutos } from './validaciones/puntoHabitual.js'

// Hora de Lima, para comparar con los puntos habituales (US10).
const DIA_ISO = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
const FORMATO_LIMA = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Lima', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

// Cortes de antigüedad del criterio de aceptación de US08 (en minutos).
export const LIMITE_ALTA_MIN = 15 // alta si es menor a 15 minutos
export const LIMITE_MEDIA_MIN = 60 // media hasta 1 hora
export const VIGENCIA_MAXIMA_MIN = 240 // más de 4 horas sin confirmación: "Ubicación no confirmada"

// Regla de vigencia: el dato vale completo hasta los 15 min y pierde valor de forma lineal
// hasta llegar a 0 a las 4 h, cuando vence.

// Confiabilidad base de cada fuente (0 a 1). Primera versión del modelo: se ajustará con los datos reales.
export const CONFIABILIDAD = {
  gpsMejorPrecisionM: 10, // con 10 m o mejor, el GPS vale 1.0
  gpsPeorPrecisionM: 50, // con 50 m (límite del RNF09), vale 0.6
  gpsMax: 1.0,
  gpsMin: 0.6,
  avistamientoVerificado: 0.8,
  avistamientoCliente: 0.6,
  patronHistorico: 0.3,
}

const MS_POR_MIN = 60_000

export class FuenteUbicacion {
  constructor({ id, emolienteroId, nombre, lat, lng, precisionM, registradaEn }) {
    if (new.target === FuenteUbicacion) throw new TypeError('FuenteUbicacion es abstracta: usa una subclase.')
    Object.assign(this, { id, emolienteroId, nombre, lat, lng, precisionM, registradaEn: new Date(registradaEn) })
  }

  // T41: cada subclase define qué tan confiable es su dato, sin considerar la antigüedad (0 a 1).
  calcularConfiabilidad() {
    throw new Error(`${this.constructor.name} debe implementar calcularConfiabilidad().`)
  }

  // Identificador de la fuente tal como se guarda en la columna ubicaciones.fuente.
  get fuente() {
    return this.constructor.CODIGO
  }

  antiguedadMin(ahora = new Date()) {
    return Math.max(0, (ahora - this.registradaEn) / MS_POR_MIN)
  }

  // Regla de vigencia (común a todas las fuentes): factor de 0 a 1 según la antigüedad.
  factorVigencia(ahora = new Date()) {
    const edad = this.antiguedadMin(ahora)
    if (edad <= LIMITE_ALTA_MIN) return 1
    if (edad >= VIGENCIA_MAXIMA_MIN) return 0
    return 1 - (edad - LIMITE_ALTA_MIN) / (VIGENCIA_MAXIMA_MIN - LIMITE_ALTA_MIN)
  }

  // T42: método plantilla. Fija el algoritmo y delega en la subclase solo calcularConfiabilidad().
  puntaje(ahora = new Date()) {
    return this.calcularConfiabilidad() * this.factorVigencia(ahora)
  }

  // T45: más de 4 horas sin confirmación de clientes. Las confirmaciones (US09) llegan como
  // fuentes de avistamiento con su propia fecha, así que una confirmación reciente es otra fuente vigente.
  estaConfirmada(ahora = new Date()) {
    return this.antiguedadMin(ahora) <= VIGENCIA_MAXIMA_MIN
  }

  // T44: indicador alto, medio o bajo según el criterio de aceptación de US08.
  nivelConfiabilidad(ahora = new Date()) {
    const edad = this.antiguedadMin(ahora)
    if (edad < LIMITE_ALTA_MIN) return 'alto'
    if (edad <= LIMITE_MEDIA_MIN) return 'medio'
    return 'bajo'
  }
}

// Ubicación registrada por el propio emolientero con el GPS de su dispositivo (US05).
// Su confiabilidad depende del margen de error que reporta el dispositivo.
export class GpsDelVendedor extends FuenteUbicacion {
  static CODIGO = 'gps_emolientero'

  calcularConfiabilidad() {
    const { gpsMejorPrecisionM: mejor, gpsPeorPrecisionM: peor, gpsMax, gpsMin } = CONFIABILIDAD
    const precision = Math.min(Math.max(this.precisionM, mejor), peor)
    return gpsMax - ((precision - mejor) / (peor - mejor)) * (gpsMax - gpsMin)
  }
}

// Un cliente reporta haber visto al emolientero en ese punto (US09).
export class AvistamientoCliente extends FuenteUbicacion {
  static CODIGO = 'avistamiento_cliente'

  calcularConfiabilidad() {
    return CONFIABILIDAD.avistamientoCliente
  }
}

// Avistamiento respaldado por la coincidencia de varios reportes de clientes (US09).
export class AvistamientoVerificado extends FuenteUbicacion {
  static CODIGO = 'avistamiento_verificado'

  calcularConfiabilidad() {
    return CONFIABILIDAD.avistamientoVerificado
  }
}

// US10 - T48: punto y horario habitual que declara el emolientero: fuente de BAJA precisión.
// No usa GPS: deduce dónde suele estar a partir de sus puntos habituales (tabla puntos_habituales:
// día y rango horario). Es el último recurso: si el emolientero tiene la jornada abierta, manda su
// GPS (US05/US06) y estimar() no lo incluye.
export class PatronHistorico extends FuenteUbicacion {
  static CODIGO = 'horario_habitual'
  // Radio de incertidumbre que se informa (el GPS exige 50 m o mejor): el emolientero está "por la zona".
  static PRECISION_M = 300

  calcularConfiabilidad() {
    return CONFIABILIDAD.patronHistorico
  }

  // Criterio de US08: si la ubicación proviene solo del horario habitual, la confiabilidad es baja.
  nivelConfiabilidad() {
    return 'bajo'
  }

  // Día ISO (1 = lunes) y minutos desde la medianoche, en hora de Lima, del instante dado.
  static momentoEnLima(fecha) {
    const partes = Object.fromEntries(FORMATO_LIMA.formatToParts(fecha).map((p) => [p.type, p.value]))
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
      .map((p) => {
        const fuente = new PatronHistorico({ ...p, precisionM: PatronHistorico.PRECISION_M, registradaEn: fecha })
        return { ...p, precisionM: fuente.precisionM, fuente: fuente.fuente, confiabilidad: fuente.nivelConfiabilidad() }
      })
  }
}

export const FUENTES = Object.fromEntries(
  [GpsDelVendedor, AvistamientoCliente, AvistamientoVerificado, PatronHistorico].map((C) => [C.CODIGO, C]),
)

// Crea la subclase que corresponde a una fila de la tabla ubicaciones.
export function crearFuente(fila) {
  const Clase = FUENTES[fila.fuente]
  if (!Clase) throw new Error(`Fuente de ubicación desconocida: ${fila.fuente}`)
  return new Clase(fila)
}

// T43: de todas las fuentes de un emolientero, la de mayor puntaje. A igual puntaje, la más reciente.
export function fuenteMasConfiable(fuentes, ahora = new Date()) {
  let mejor = null
  let mejorPuntaje = -1
  for (const f of fuentes) {
    const p = f.puntaje(ahora)
    if (p > mejorPuntaje || (p === mejorPuntaje && f.registradaEn > mejor.registradaEn)) {
      mejor = f
      mejorPuntaje = p
    }
  }
  return mejor
}

// T43 + T44 + T45: agrupa por emolientero, elige la fuente más confiable de cada uno, descarta
// las no confirmadas y devuelve lo que el cliente necesita ver (antigüedad y nivel).
export function resolverUbicaciones(filas, ahora = new Date()) {
  const porEmolientero = new Map()
  for (const fila of filas) {
    const fuente = crearFuente(fila)
    if (!porEmolientero.has(fuente.emolienteroId)) porEmolientero.set(fuente.emolienteroId, [])
    porEmolientero.get(fuente.emolienteroId).push(fuente)
  }

  const resultado = []
  for (const fuentes of porEmolientero.values()) {
    const f = fuenteMasConfiable(fuentes, ahora)
    if (!f.estaConfirmada(ahora)) continue
    resultado.push({
      id: f.id,
      emolienteroId: f.emolienteroId,
      nombre: f.nombre,
      lat: f.lat,
      lng: f.lng,
      precisionM: f.precisionM,
      fuente: f.fuente,
      registradaEn: f.registradaEn.toISOString(),
      antiguedadMin: Math.floor(f.antiguedadMin(ahora)),
      confiabilidad: f.nivelConfiabilidad(ahora),
      puntaje: Math.round(f.puntaje(ahora) * 1000) / 1000,
    })
  }
  return resultado
}
