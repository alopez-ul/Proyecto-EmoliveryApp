// US09 - T79/T80/T81: modelo de avistamientos (no necesita base de datos).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AvistamientoCliente,
  AvistamientoVerificado,
  MIN_COINCIDENCIAS,
  RADIO_CONFIRMACION_M,
  deduplicar,
  distanciaMetros,
  ventanaDe,
} from '../src/fuentesUbicacion.js'

const CENTRO = { lat: -12.0867, lng: -76.9405 }
// ~1 m de latitud = 1/111_320 grados.
const alNorte = (metros, punto = CENTRO) => ({ lat: punto.lat + metros / 111_320, lng: punto.lng })
const AHORA = new Date('2026-11-15T15:10:00Z') // ventana [15:00, 15:30) UTC
const haceMin = (m) => new Date(AHORA.getTime() - m * 60_000)

const reporte = ({ cliente = 'c1', emolientero = 'e1', minutos = 0, punto = CENTRO, id } = {}) =>
  new AvistamientoCliente({ id, emolienteroId: emolientero, clienteId: cliente, nombre: 'Elmer', ...punto, precisionM: 10, registradaEn: haceMin(minutos) })

describe('T79: distancia y radio', () => {
  test('distanciaMetros mide bien distancias cortas', () => {
    assert.ok(Math.abs(distanciaMetros(CENTRO, alNorte(100)) - 100) < 0.5)
    assert.equal(distanciaMetros(CENTRO, CENTRO), 0)
  })

  test('el radio de confirmación es de 100 m', () => {
    assert.equal(RADIO_CONFIRMACION_M, 100)
  })
})

describe('T81: equals y hashCode (RNF19)', () => {
  test('mismo cliente, mismo emolientero y misma ventana: iguales, con el mismo hash', () => {
    const a = reporte({ minutos: 0 })
    const b = reporte({ minutos: 5, punto: alNorte(30) }) // otras coordenadas, misma ventana
    assert.equal(a.equals(b), true)
    assert.equal(b.equals(a), true, 'simétrico')
    assert.equal(a.hashCode(), b.hashCode())
  })

  test('otro cliente, otro emolientero u otra ventana: distintos', () => {
    const a = reporte()
    assert.equal(a.equals(reporte({ cliente: 'c2' })), false)
    assert.equal(a.equals(reporte({ emolientero: 'e2' })), false)
    assert.equal(a.equals(reporte({ minutos: 15 })), false, '14:55 cae en la ventana anterior')
    assert.equal(ventanaDe(haceMin(15)) + 1, ventanaDe(AHORA))
  })

  test('es reflexivo y no es igual a algo que no sea un avistamiento', () => {
    const a = reporte()
    assert.equal(a.equals(a), true)
    assert.equal(a.equals(null), false)
    assert.equal(a.equals({ ...a }), false)
  })

  test('hashCode es un entero de 32 bits y estable', () => {
    const h = reporte().hashCode()
    assert.ok(Number.isInteger(h) && h >= -(2 ** 31) && h < 2 ** 31)
    assert.equal(reporte().hashCode(), h)
  })

  test('deduplicar deja uno por cliente y ventana, y conserva el primero', () => {
    const lista = [reporte({ id: 1 }), reporte({ id: 2, minutos: 3 }), reporte({ id: 3, cliente: 'c2' }), reporte({ id: 4, minutos: 20 })]
    assert.deepEqual(deduplicar(lista).map((r) => r.id), [1, 3, 4])
  })
})

describe('T80: AvistamientoVerificado por coincidencia', () => {
  test(`con ${MIN_COINCIDENCIAS} clientes distintos cerca se verifica en el punto medio`, () => {
    const v = AvistamientoVerificado.porCoincidencia([reporte({ cliente: 'c1', minutos: 5 }), reporte({ cliente: 'c2', punto: alNorte(40) })], AHORA)
    assert.ok(v instanceof AvistamientoVerificado)
    assert.equal(v.fuente, 'avistamiento_verificado')
    assert.equal(v.confirmaciones, 2)
    assert.ok(Math.abs(distanciaMetros(v, alNorte(20))) < 0.5, 'punto medio')
    assert.equal(v.precisionM, 20)
  })

  test('los reportes repetidos del mismo cliente no cuentan como coincidencia', () => {
    assert.equal(AvistamientoVerificado.porCoincidencia([reporte({ minutos: 5 }), reporte({ minutos: 1 })], AHORA), null)
  })

  test('el mismo cliente en dos ventanas tampoco cuenta dos veces', () => {
    assert.equal(AvistamientoVerificado.porCoincidencia([reporte({ minutos: 20 }), reporte()], AHORA), null)
  })

  test('no coinciden reportes de hace más de 30 min ni a más de 100 m', () => {
    assert.equal(AvistamientoVerificado.porCoincidencia([reporte({ cliente: 'c1', minutos: 31 }), reporte({ cliente: 'c2' })], AHORA), null)
    assert.equal(AvistamientoVerificado.porCoincidencia([reporte({ cliente: 'c1', punto: alNorte(150) }), reporte({ cliente: 'c2' })], AHORA), null)
  })
})
