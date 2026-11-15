// US20 - T78: pruebas del historial de compras (no necesitan base de datos).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { esFechaValida, validarRangoFechas } from '../src/validaciones/historialCompras.js'
import { SIN_COMPRAS, resumirHistorial } from '../src/historialCompras.js'

const compra = (id, monto, estado = 'entregada') => ({
  id,
  fecha: '2026-11-10T15:00:00.000Z',
  emolientero: { id: 'e1', nombre: 'Rosa' },
  productos: [{ nombre: 'Emoliente clásico', cantidad: 1, precioUnitario: monto }],
  monto,
  estado,
})

describe('T78: historial vacío', () => {
  test('sin órdenes: conteo 0, monto 0 y el mensaje del criterio de aceptación', () => {
    assert.deepEqual(resumirHistorial([]), { conteo: 0, montoAcumulado: 0, compras: [], mensaje: SIN_COMPRAS })
    assert.equal(SIN_COMPRAS, 'No se encontraron compras en este periodo.')
  })
})

describe('T76: conteo y monto acumulado', () => {
  test('suma todas las compras realizadas', () => {
    const r = resumirHistorial([compra(1, 2.5), compra(2, 1.5)])
    assert.equal(r.conteo, 2)
    assert.equal(r.montoAcumulado, 4)
    assert.equal(r.mensaje, null)
  })
  test('una orden cancelada se lista pero no cuenta ni suma', () => {
    const r = resumirHistorial([compra(1, 2.5), compra(2, 10, 'cancelada')])
    assert.equal(r.conteo, 1)
    assert.equal(r.montoAcumulado, 2.5)
    assert.equal(r.compras.length, 2)
  })
  test('suma sin errores de redondeo (0.1 + 0.2 = 0.3)', () => {
    assert.equal(resumirHistorial([compra(1, 0.1), compra(2, 0.2)]).montoAcumulado, 0.3)
  })
  test('acepta montos que llegan como texto desde NUMERIC', () => {
    assert.equal(resumirHistorial([compra(1, '2.50'), compra(2, '1.50')]).montoAcumulado, 4)
  })
})

describe('T77: filtro por rango de fechas', () => {
  test('sin filtro: ambas fechas nulas y sin errores', () => {
    assert.deepEqual(validarRangoFechas({}), { datos: { desde: null, hasta: null }, errores: {} })
    assert.deepEqual(validarRangoFechas({ desde: '', hasta: '  ' }).datos, { desde: null, hasta: null })
  })
  test('acepta un rango válido, una sola fecha y un mismo día', () => {
    assert.deepEqual(validarRangoFechas({ desde: '2026-11-01', hasta: '2026-11-15' }).errores, {})
    assert.deepEqual(validarRangoFechas({ desde: '2026-11-01' }).errores, {})
    assert.deepEqual(validarRangoFechas({ hasta: '2026-11-15' }).errores, {})
    assert.deepEqual(validarRangoFechas({ desde: '2026-11-15', hasta: '2026-11-15' }).errores, {})
  })
  test('rechaza fechas con formato inválido o inexistentes', () => {
    assert.ok(validarRangoFechas({ desde: '15/11/2026' }).errores.desde)
    assert.ok(validarRangoFechas({ hasta: '2026-02-30' }).errores.hasta)
    assert.equal(esFechaValida('2024-02-29'), true)
    assert.equal(esFechaValida('2026-13-01'), false)
    assert.equal(esFechaValida(20261115), false)
  })
  test('rechaza una fecha final anterior a la inicial', () => {
    assert.equal(
      validarRangoFechas({ desde: '2026-11-15', hasta: '2026-11-01' }).errores.hasta,
      'La fecha final no puede ser anterior a la inicial.',
    )
  })
})
