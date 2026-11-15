// US18 - T89: visualización y orden del listado de reseñas (no necesita base de datos).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { nombrePublico, ordenarPorFecha, resumenResenas } from '../src/consultaResenas.js'

const resena = (id, calificacion, publicadaEn) => ({ id, calificacion, publicadaEn })

describe('T87: promedio y total', () => {
  test('calcula el total y el promedio', () => {
    assert.deepEqual(resumenResenas([resena(1, 5, '2026-11-01'), resena(2, 4, '2026-11-02'), resena(3, 3, '2026-11-03')]), { total: 3, promedio: 4 })
  })

  test('redondea el promedio a un decimal', () => {
    assert.equal(resumenResenas([resena(1, 5, 'x'), resena(2, 4, 'x'), resena(3, 4, 'x')]).promedio, 4.3)
  })

  test('una sola reseña: el promedio es su calificación', () => {
    assert.deepEqual(resumenResenas([resena(1, 2, 'x')]), { total: 1, promedio: 2 })
  })
})

describe('T88: emolientero sin reseñas', () => {
  test('total 0 y promedio null (no 0)', () => {
    assert.deepEqual(resumenResenas([]), { total: 0, promedio: null })
  })

  test('ordenar una lista vacía devuelve una lista vacía', () => {
    assert.deepEqual(ordenarPorFecha([]), [])
  })
})

describe('T89: orden del listado', () => {
  test('de la más reciente a la más antigua', () => {
    const lista = [resena(1, 5, '2026-11-01T10:00:00Z'), resena(2, 3, '2026-11-03T10:00:00Z'), resena(3, 4, '2026-11-02T10:00:00Z')]
    assert.deepEqual(ordenarPorFecha(lista).map((r) => r.id), [2, 3, 1])
  })

  test('con la misma fecha, primero la de mayor id', () => {
    const lista = [resena(4, 5, '2026-11-01T10:00:00Z'), resena(7, 3, '2026-11-01T10:00:00Z')]
    assert.deepEqual(ordenarPorFecha(lista).map((r) => r.id), [7, 4])
  })

  test('no modifica la lista original', () => {
    const lista = [resena(1, 5, '2026-11-01'), resena(2, 3, '2026-11-03')]
    ordenarPorFecha(lista)
    assert.deepEqual(lista.map((r) => r.id), [1, 2])
  })
})

describe('T89: visualización del autor', () => {
  test('muestra el nombre y la inicial del apellido', () => {
    assert.equal(nombrePublico('Carla Cliente'), 'Carla C.')
  })

  test('con un solo nombre lo muestra tal cual', () => {
    assert.equal(nombrePublico('Carla'), 'Carla')
  })

  test('limpia espacios y usa "Cliente" si no hay nombre', () => {
    assert.equal(nombrePublico('  rosa   huamán '), 'rosa H.')
    assert.equal(nombrePublico(''), 'Cliente')
  })
})
