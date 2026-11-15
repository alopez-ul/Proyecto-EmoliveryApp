// US15 - T68: generación y formato del código de recojo (no necesita base de datos).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { ALFABETO, esCodigoValido, formatearCodigo, generarCodigoRecojo, normalizarCodigo } from '../src/codigoRecojo.js'

describe('T68: código de recojo', () => {
  test('tiene 6 caracteres del alfabeto sin 0/O ni 1/I', () => {
    for (let i = 0; i < 500; i++) {
      const codigo = generarCodigoRecojo()
      assert.ok(esCodigoValido(codigo), codigo)
      assert.doesNotMatch(codigo, /[01OI]/)
    }
    assert.equal(ALFABETO.length, 32)
  })

  test('no se repite en una muestra grande', () => {
    const muestra = new Set(Array.from({ length: 5000 }, generarCodigoRecojo))
    assert.equal(muestra.size, 5000)
  })

  test('normaliza lo que escribe el emolientero', () => {
    assert.equal(normalizarCodigo(' abc-23x '), 'ABC23X')
    assert.equal(normalizarCodigo('abc 23x'), 'ABC23X')
    assert.equal(normalizarCodigo(undefined), '')
  })

  test('rechaza formatos inválidos', () => {
    for (const malo of ['', 'ABC23', 'ABC23XY', 'ABC2O0', 'ABC-23', 'abc23x']) assert.equal(esCodigoValido(malo), false, malo)
  })

  test('se muestra en dos grupos de tres', () => {
    assert.equal(formatearCodigo('ABC23X'), 'ABC-23X')
    assert.equal(formatearCodigo(null), null)
  })
})
