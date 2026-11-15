// US10 - T47/T48/T49: reglas del punto habitual y de PatronHistorico (no necesitan base de datos).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { buscarTraslape, seTraslapan, validarPuntoHabitual } from '../src/validaciones/puntoHabitual.js'
import { PatronHistorico } from '../src/fuentesUbicacion.js'

const valido = () => ({
  referencia: 'Parque Los Fresnos',
  lat: -12.0867,
  lng: -76.9405,
  diaSemana: 1,
  horaInicio: '07:00',
  horaFin: '10:00',
})
const errores = (cambios) => validarPuntoHabitual({ ...valido(), ...cambios }).errores

describe('T47: coherencia del rango horario', () => {
  test('acepta un punto válido', () => {
    assert.deepEqual(errores({}), {})
  })

  test('T49: rechaza una hora de fin anterior a la de inicio', () => {
    assert.deepEqual(errores({ horaInicio: '10:00', horaFin: '07:00' }), {
      horaFin: 'La hora de fin debe ser posterior a la hora de inicio.',
    })
  })

  test('rechaza una hora de fin igual a la de inicio (rango vacío)', () => {
    assert.deepEqual(Object.keys(errores({ horaInicio: '08:00', horaFin: '08:00' })), ['horaFin'])
  })

  test('un rango que cruza la medianoche se rechaza (fin anterior al inicio)', () => {
    assert.ok(errores({ horaInicio: '22:00', horaFin: '01:00' }).horaFin)
  })

  for (const hora of ['7:00', '24:00', '08:60', '0800', '', 'ocho', 800]) {
    test(`rechaza la hora mal formada ${JSON.stringify(hora)}`, () => {
      assert.ok(errores({ horaInicio: hora }).horaInicio)
    })
  }
})

describe('T46: resto del formulario', () => {
  test('la zona debe estar marcada y dentro de La Molina', () => {
    assert.ok(errores({ lat: undefined, lng: undefined }).ubicacion)
    assert.ok(errores({ lat: -12.0464, lng: -77.0306 }).ubicacion, 'Plaza de Armas de Lima está fuera')
  })

  for (const dia of [0, 8, 1.5, '1', null]) {
    test(`rechaza el día ${JSON.stringify(dia)}`, () => {
      assert.deepEqual(Object.keys(errores({ diaSemana: dia })), ['diaSemana'])
    })
  }

  test('la referencia es obligatoria y se normaliza', () => {
    assert.ok(errores({ referencia: '  a ' }).referencia)
    assert.equal(validarPuntoHabitual({ ...valido(), referencia: '  Óvalo   La Molina ' }).datos.referencia, 'Óvalo La Molina')
  })
})

describe('T47/T49: traslapes de horario', () => {
  const p = (diaSemana, horaInicio, horaFin, id) => ({ id, diaSemana, horaInicio, horaFin, referencia: 'X' })

  test('T49: detecta el conflicto cuando un rango empieza dentro de otro', () => {
    assert.equal(seTraslapan(p(1, '07:00', '10:00'), p(1, '09:00', '12:00')), true)
  })

  test('detecta un rango contenido en otro y uno idéntico', () => {
    assert.equal(seTraslapan(p(1, '07:00', '12:00'), p(1, '08:00', '09:00')), true)
    assert.equal(seTraslapan(p(1, '07:00', '10:00'), p(1, '07:00', '10:00')), true)
  })

  test('rangos contiguos no chocan (uno termina cuando empieza el otro)', () => {
    assert.equal(seTraslapan(p(1, '07:00', '10:00'), p(1, '10:00', '12:00')), false)
  })

  test('el mismo horario en otro día no choca', () => {
    assert.equal(seTraslapan(p(1, '07:00', '10:00'), p(2, '07:00', '10:00')), false)
  })

  test('buscarTraslape devuelve el punto en conflicto e ignora el propio', () => {
    const existentes = [p(1, '06:00', '07:00', 1), p(1, '09:00', '11:00', 2)]
    assert.equal(buscarTraslape(p(1, '08:00', '10:00'), existentes).id, 2)
    assert.equal(buscarTraslape(p(1, '07:00', '09:00'), existentes), null)
    assert.equal(buscarTraslape(p(1, '09:00', '11:00', 2), existentes), null)
  })
})

describe('T48: PatronHistorico', () => {
  // Jueves 12/11/2026 08:30 en Lima (UTC-5).
  const JUEVES_0830 = new Date('2026-11-12T13:30:00Z')

  test('convierte el instante a día y hora de Lima', () => {
    assert.deepEqual(PatronHistorico.momentoEnLima(JUEVES_0830), { diaSemana: 4, minutos: 8 * 60 + 30 })
    // 04:30 UTC del lunes 16 todavía es domingo 15 a las 23:30 en Lima.
    assert.deepEqual(PatronHistorico.momentoEnLima(new Date('2026-11-16T04:30:00Z')), { diaSemana: 7, minutos: 23 * 60 + 30 })
  })

  test('elige el punto del día y rango que corresponde', () => {
    const puntos = [
      { id: 1, diaSemana: 4, horaInicio: '06:00', horaFin: '08:30' },
      { id: 2, diaSemana: 4, horaInicio: '08:30', horaFin: '11:00' },
      { id: 3, diaSemana: 5, horaInicio: '08:00', horaFin: '11:00' },
    ]
    assert.equal(PatronHistorico.puntoVigente(puntos, JUEVES_0830).id, 2, 'el inicio se incluye y el fin no')
    assert.equal(PatronHistorico.puntoVigente([puntos[0], puntos[2]], JUEVES_0830), null)
  })

  test('es una fuente de baja precisión comparada con el GPS', () => {
    assert.equal(PatronHistorico.CODIGO, 'horario_habitual')
    assert.ok(PatronHistorico.PRECISION_M > 50)
  })
})
