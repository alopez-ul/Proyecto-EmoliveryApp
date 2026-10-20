// US05: pruebas de las reglas de validación (no necesitan base de datos).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { dentroDeLaMolina, validarUbicacion } from '../src/zonaCobertura.js'

const CENTRO_LA_MOLINA = { lat: -12.0867, lng: -76.9405 }
const PLAZA_DE_ARMAS_LIMA = { lat: -12.0464, lng: -77.0306 }

describe('Zona de cobertura', () => {
  test('el centro de La Molina está dentro', () => {
    assert.equal(dentroDeLaMolina(CENTRO_LA_MOLINA.lat, CENTRO_LA_MOLINA.lng), true)
  })
  test('el centro de Lima está fuera', () => {
    assert.equal(dentroDeLaMolina(PLAZA_DE_ARMAS_LIMA.lat, PLAZA_DE_ARMAS_LIMA.lng), false)
  })
})

describe('validarUbicacion', () => {
  test('acepta una ubicación en La Molina con precisión de 20 m', () => {
    assert.equal(validarUbicacion({ ...CENTRO_LA_MOLINA, precision: 20 }), null)
  })
  test('acepta justo 50 m (límite)', () => {
    assert.equal(validarUbicacion({ ...CENTRO_LA_MOLINA, precision: 50 }), null)
  })
  test('rechaza 50.1 m con 422', () => {
    assert.equal(validarUbicacion({ ...CENTRO_LA_MOLINA, precision: 50.1 }).status, 422)
  })
  test('rechaza fuera de La Molina con el mensaje del criterio de aceptación', () => {
    const r = validarUbicacion({ ...PLAZA_DE_ARMAS_LIMA, precision: 10 })
    assert.equal(r.status, 422)
    assert.equal(r.error, 'Ubicación fuera de la zona de cobertura.')
  })
  test('rechaza datos mal formados con 400', () => {
    for (const mala of [{}, { lat: 'a', lng: 1, precision: 5 }, { ...CENTRO_LA_MOLINA }, { ...CENTRO_LA_MOLINA, precision: 0 }, { lat: 999, lng: 0, precision: 5 }, { lat: NaN, lng: 0, precision: 5 }]) {
      assert.equal(validarUbicacion(mala).status, 400)
    }
  })
})
