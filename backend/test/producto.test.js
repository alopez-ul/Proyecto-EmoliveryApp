// US11 - T53: rechazo por datos inválidos y nombre repetido (reglas de T51; no necesitan base de datos).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { buscarNombreRepetido, validarProducto } from '../src/validaciones/producto.js'

const valido = () => ({ nombre: 'Emoliente con maca', categoria: 'emoliente', precio: 2.5, disponible: true })
const errores = (cambios) => validarProducto({ ...valido(), ...cambios }).errores

describe('T51/T53: datos del producto', () => {
  test('acepta un producto válido', () => {
    assert.deepEqual(errores({}), {})
  })

  test('limpia los espacios sobrantes del nombre', () => {
    assert.equal(validarProducto({ ...valido(), nombre: '  Emoliente   con  maca ' }).datos.nombre, 'Emoliente con maca')
  })

  test('si no se indica, el producto queda disponible', () => {
    const { disponible, ...sinDisponible } = valido()
    assert.equal(validarProducto(sinDisponible).datos.disponible, true)
  })

  for (const nombre of ['', '  ', 'ab', 'x'.repeat(61), undefined]) {
    test(`rechaza el nombre ${JSON.stringify(nombre)}`, () => {
      assert.ok(errores({ nombre }).nombre)
    })
  }

  for (const categoria of ['', 'postres', undefined, 'Emoliente']) {
    test(`rechaza la categoría ${JSON.stringify(categoria)} (categoría obligatoria)`, () => {
      assert.deepEqual(errores({ categoria }), { categoria: 'Elige una categoría.' })
    })
  }

  test('rechaza el precio cero', () => {
    assert.deepEqual(errores({ precio: 0 }), { precio: 'El precio debe ser mayor que cero.' })
  })

  test('rechaza el precio negativo', () => {
    assert.deepEqual(errores({ precio: -1.5 }), { precio: 'El precio debe ser mayor que cero.' })
  })

  test('rechaza el precio con más de dos decimales', () => {
    assert.deepEqual(errores({ precio: 2.555 }), { precio: 'El precio admite como máximo dos decimales.' })
  })

  test('rechaza el precio por encima del máximo', () => {
    assert.ok(errores({ precio: 100.5 }).precio)
  })

  for (const precio of [undefined, '2.50', NaN, Infinity, null]) {
    test(`rechaza el precio ${String(precio)} (no es un número)`, () => {
      assert.deepEqual(errores({ precio }), { precio: 'Ingresa el precio.' })
    })
  }

  test('acepta los precios límite 0.10 y 100', () => {
    assert.deepEqual(errores({ precio: 0.1 }), {})
    assert.deepEqual(errores({ precio: 100 }), {})
  })

  test('rechaza una disponibilidad que no es sí/no', () => {
    assert.ok(errores({ disponible: 'si' }).disponible)
  })
})

describe('T51/T53: nombre único en el catálogo', () => {
  const catalogo = [
    { id: 1, nombre: 'Emoliente con maca' },
    { id: 2, nombre: 'Quinua con manzana' },
  ]

  test('detecta el nombre repetido sin distinguir mayúsculas', () => {
    assert.equal(buscarNombreRepetido('EMOLIENTE CON MACA', catalogo)?.id, 1)
  })

  test('permite un nombre nuevo', () => {
    assert.equal(buscarNombreRepetido('Maca con leche', catalogo), null)
  })

  test('al editar, el producto puede conservar su propio nombre', () => {
    assert.equal(buscarNombreRepetido('Emoliente con maca', catalogo, 1), null)
  })

  test('al editar, no puede tomar el nombre de otro producto', () => {
    assert.equal(buscarNombreRepetido('quinua con manzana', catalogo, 1)?.id, 2)
  })
})

describe('Sprint 2: catálogo unificado (US11 + US12)', () => {
  test('acepta las categorías de la vista pública', () => {
    for (const categoria of ['emoliente', 'quinua_avena', 'maca', 'bebida', 'acompanamiento']) {
      assert.deepEqual(errores({ categoria }), {}, categoria)
    }
  })

  test('la descripción es opcional, se limpia y tiene un máximo de 200 caracteres', () => {
    assert.equal(validarProducto(valido()).datos.descripcion, '')
    assert.equal(validarProducto({ ...valido(), descripcion: '  Con  linaza ' }).datos.descripcion, 'Con linaza')
    assert.ok(errores({ descripcion: 'x'.repeat(201) }).descripcion)
    assert.ok(errores({ descripcion: 123 }).descripcion)
  })
})
