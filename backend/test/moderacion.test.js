// US25 - T104 a T107: reglas de la moderación de contenido (no necesitan base de datos).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { PENALIZACION_REPUTACION, reputacionTrasDecision, validarDecision, validarReporte, verificarDecidible } from '../src/moderacion.js'

function errorDe(fn) {
  try {
    fn()
  } catch (err) {
    return { status: err.status, message: err.message }
  }
  assert.fail('se esperaba un error')
}

describe('Reporte de un usuario', () => {
  test('acepta un motivo válido y limpia los espacios', () => {
    assert.deepEqual(validarReporte({ motivo: '  Usa   lenguaje ofensivo ' }), { datos: { motivo: 'Usa lenguaje ofensivo' }, errores: {} })
  })

  for (const motivo of ['', 'corto', 'x'.repeat(301), undefined, 123]) {
    test(`rechaza el motivo ${JSON.stringify(motivo)}`, () => {
      assert.ok(validarReporte({ motivo }).errores.motivo)
    })
  }
})

describe('T105: decisión con registro (RNF06)', () => {
  test('acepta ocultar y mantener con una nota', () => {
    assert.deepEqual(validarDecision({ decision: 'ocultar', nota: 'Contiene insultos al vendedor' }).errores, {})
    assert.deepEqual(validarDecision({ decision: 'mantener', nota: 'Es una crítica válida' }).errores, {})
  })

  test('rechaza una decisión que no es ocultar ni mantener', () => {
    assert.ok(validarDecision({ decision: 'borrar', nota: 'Contiene insultos al vendedor' }).errores.decision)
  })

  test('exige registrar el motivo de la decisión', () => {
    assert.ok(validarDecision({ decision: 'ocultar', nota: '' }).errores.nota)
    assert.ok(validarDecision({ decision: 'ocultar' }).errores.nota)
  })
})

describe('T106: reputación del usuario reportado', () => {
  test(`ocultar resta ${PENALIZACION_REPUTACION} puntos`, () => {
    assert.equal(reputacionTrasDecision(100, 'ocultar'), 90)
  })

  test('mantener no cambia la reputación', () => {
    assert.equal(reputacionTrasDecision(80, 'mantener'), 80)
  })

  test('la reputación no baja de 0', () => {
    assert.equal(reputacionTrasDecision(5, 'ocultar'), 0)
    assert.equal(reputacionTrasDecision(0, 'ocultar'), 0)
  })
})

describe('T107: reporte ya atendido y contenido eliminado por su autor', () => {
  test('un reporte pendiente con contenido se puede decidir', () => {
    assert.doesNotThrow(() => verificarDecidible({ estado: 'pendiente', resenaId: 7 }))
  })

  for (const estado of ['oculto', 'mantenido', 'contenido_eliminado']) {
    test(`un reporte ya atendido (${estado}) responde 409`, () => {
      const error = errorDe(() => verificarDecidible({ estado, resenaId: 7 }))
      assert.equal(error.status, 409)
      assert.equal(error.message, 'Este reporte ya fue atendido.')
    })
  }

  test('si el autor eliminó la reseña responde 410', () => {
    const error = errorDe(() => verificarDecidible({ estado: 'pendiente', resenaId: null }))
    assert.equal(error.status, 410)
    assert.match(error.message, /eliminado por su autor/)
  })

  test('un reporte inexistente responde 404', () => {
    assert.equal(errorDe(() => verificarDecidible(undefined)).status, 404)
  })
})
