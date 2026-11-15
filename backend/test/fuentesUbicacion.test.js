// US08: pruebas de la jerarquía FuenteUbicacion (no necesitan base de datos).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AvistamientoCliente,
  AvistamientoVerificado,
  FuenteUbicacion,
  GpsDelVendedor,
  PatronHistorico,
  crearFuente,
  fuenteMasConfiable,
  resolverUbicaciones,
} from '../src/fuentesUbicacion.js'

const AHORA = new Date('2026-11-15T15:00:00Z')
const haceMin = (min) => new Date(AHORA.getTime() - min * 60_000)
const base = { id: 1, emolienteroId: 'e1', nombre: 'Rosa', lat: -12.0867, lng: -76.9405, precisionM: 10 }
const gps = (min, precisionM = 10, extra = {}) => new GpsDelVendedor({ ...base, precisionM, registradaEn: haceMin(min), ...extra })

describe('T41: calcularConfiabilidad en cada subclase', () => {
  test('FuenteUbicacion es abstracta', () => {
    assert.throws(() => new FuenteUbicacion({ ...base, registradaEn: AHORA }), TypeError)
  })
  test('GPS: 1.0 con 10 m o mejor, 0.6 con 50 m y proporcional entre ambos', () => {
    assert.equal(gps(0, 5).calcularConfiabilidad(), 1)
    assert.equal(gps(0, 10).calcularConfiabilidad(), 1)
    assert.equal(gps(0, 30).calcularConfiabilidad(), 0.8)
    assert.equal(gps(0, 50).calcularConfiabilidad(), 0.6)
  })
  test('avistamiento verificado 0.8, avistamiento de cliente 0.6 y patrón horario 0.3', () => {
    const datos = { ...base, registradaEn: AHORA }
    assert.equal(new AvistamientoVerificado(datos).calcularConfiabilidad(), 0.8)
    assert.equal(new AvistamientoCliente(datos).calcularConfiabilidad(), 0.6)
    assert.equal(new PatronHistorico(datos).calcularConfiabilidad(), 0.3)
  })
  test('crearFuente elige la subclase según la columna fuente', () => {
    assert.ok(crearFuente({ ...base, fuente: 'gps_emolientero', registradaEn: AHORA }) instanceof GpsDelVendedor)
    assert.ok(crearFuente({ ...base, fuente: 'avistamiento_cliente', registradaEn: AHORA }) instanceof AvistamientoCliente)
    assert.ok(crearFuente({ ...base, fuente: 'avistamiento_verificado', registradaEn: AHORA }) instanceof AvistamientoVerificado)
    assert.ok(crearFuente({ ...base, fuente: 'horario_habitual', registradaEn: AHORA }) instanceof PatronHistorico)
    assert.throws(() => crearFuente({ ...base, fuente: 'otra', registradaEn: AHORA }))
  })
})

describe('T42: método plantilla puntaje con la regla de vigencia', () => {
  test('hasta 15 min el dato vale completo', () => {
    assert.equal(gps(0).puntaje(AHORA), 1)
    assert.equal(gps(15).puntaje(AHORA), 1)
  })
  test('pierde valor con la antigüedad', () => {
    assert.ok(gps(30).puntaje(AHORA) < gps(16).puntaje(AHORA))
    assert.ok(gps(120).puntaje(AHORA) < gps(30).puntaje(AHORA))
  })
  test('a mitad del camino vale la mitad y a las 4 h vence (0)', () => {
    assert.ok(Math.abs(gps(127.5).puntaje(AHORA) - 0.5) < 1e-9)
    assert.equal(gps(240).puntaje(AHORA), 0)
    assert.equal(gps(300).puntaje(AHORA), 0)
  })
  test('combina la confiabilidad de la fuente con la vigencia', () => {
    const av = new AvistamientoCliente({ ...base, registradaEn: haceMin(5) })
    assert.equal(av.puntaje(AHORA), 0.6)
  })
})

describe('T43: fuente más confiable por emolientero', () => {
  test('a igual antigüedad gana la fuente más confiable', () => {
    const g = gps(5)
    const av = new AvistamientoCliente({ ...base, registradaEn: haceMin(5) })
    assert.equal(fuenteMasConfiable([av, g], AHORA), g)
  })
  test('un avistamiento reciente gana a un GPS de hace 2 horas', () => {
    const viejo = gps(120)
    const av = new AvistamientoCliente({ ...base, registradaEn: haceMin(10) })
    assert.equal(fuenteMasConfiable([viejo, av], AHORA), av)
  })
  test('a igual puntaje gana la más reciente', () => {
    const a = gps(10, 10, { id: 1 })
    const b = gps(2, 10, { id: 2 })
    assert.equal(fuenteMasConfiable([a, b], AHORA), b)
  })
})

describe('T44: antigüedad e indicador alto, medio o bajo', () => {
  test('alto si es menor a 15 min, medio hasta 1 h, bajo si es mayor', () => {
    assert.equal(gps(14).nivelConfiabilidad(AHORA), 'alto')
    assert.equal(gps(15).nivelConfiabilidad(AHORA), 'medio')
    assert.equal(gps(60).nivelConfiabilidad(AHORA), 'medio')
    assert.equal(gps(61).nivelConfiabilidad(AHORA), 'bajo')
  })
  test('bajo si proviene solo del horario habitual, aunque sea reciente', () => {
    assert.equal(new PatronHistorico({ ...base, registradaEn: haceMin(1) }).nivelConfiabilidad(AHORA), 'bajo')
  })
  test('resolverUbicaciones devuelve la antigüedad en minutos y el nivel', () => {
    const [u] = resolverUbicaciones([{ ...base, fuente: 'gps_emolientero', registradaEn: haceMin(30) }], AHORA)
    assert.equal(u.antiguedadMin, 30)
    assert.equal(u.confiabilidad, 'medio')
    assert.equal(u.fuente, 'gps_emolientero')
  })
})

describe('T45: excluir la ubicación no confirmada', () => {
  test('más de 4 h sin confirmación: no se incluye', () => {
    assert.deepEqual(resolverUbicaciones([{ ...base, fuente: 'gps_emolientero', registradaEn: haceMin(241) }], AHORA), [])
  })
  test('justo 4 h todavía se incluye con nivel bajo', () => {
    const [u] = resolverUbicaciones([{ ...base, fuente: 'gps_emolientero', registradaEn: haceMin(240) }], AHORA)
    assert.equal(u.confiabilidad, 'bajo')
  })
  test('un GPS viejo con una confirmación reciente de un cliente sí se muestra (con el avistamiento)', () => {
    const lista = resolverUbicaciones(
      [
        { ...base, id: 1, fuente: 'gps_emolientero', registradaEn: haceMin(300) },
        { ...base, id: 2, fuente: 'avistamiento_cliente', registradaEn: haceMin(20) },
      ],
      AHORA,
    )
    assert.equal(lista.length, 1)
    assert.equal(lista[0].id, 2)
  })
  test('una sola ubicación por emolientero', () => {
    const lista = resolverUbicaciones(
      [
        { ...base, id: 1, fuente: 'gps_emolientero', registradaEn: haceMin(5) },
        { ...base, id: 2, fuente: 'gps_emolientero', registradaEn: haceMin(1) },
        { ...base, id: 3, emolienteroId: 'e2', nombre: 'Luis', fuente: 'gps_emolientero', registradaEn: haceMin(3) },
      ],
      AHORA,
    )
    assert.deepEqual(lista.map((u) => u.id).sort(), [2, 3])
  })
})
