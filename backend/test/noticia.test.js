// US22 - T99: validación del formulario de noticia (no necesita base de datos).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { esFechaReal, hoyEnLima, validarNoticia } from '../src/validaciones/noticia.js'

const HOY = '2026-11-15'
const valida = () => ({
  titulo: 'Feria del emoliente en La Molina',
  contenido: 'Este sábado habrá una feria con descuentos en el parque.',
  publico: 'todos',
  fechaPublicacion: HOY,
})
const errores = (cambios) => validarNoticia({ ...valida(), ...cambios }, HOY).errores

describe('T99: fecha de publicación', () => {
  test('acepta hoy y una fecha futura', () => {
    assert.deepEqual(errores({}), {})
    assert.deepEqual(errores({ fechaPublicacion: '2026-12-01' }), {})
  })

  test('rechaza una fecha anterior a hoy', () => {
    assert.deepEqual(errores({ fechaPublicacion: '2026-11-14' }), {
      fechaPublicacion: 'La fecha de publicación no puede ser anterior a hoy.',
    })
  })

  for (const fecha of ['', '15/11/2026', '2026-02-30', '2026-13-01', 'mañana', undefined]) {
    test(`rechaza la fecha inválida ${JSON.stringify(fecha)}`, () => {
      assert.equal(errores({ fechaPublicacion: fecha }).fechaPublicacion, 'Ingresa una fecha de publicación válida.')
    })
  }

  test('hoy se calcula en hora de Lima', () => {
    // 03:00 UTC del 16 todavía es el 15 a las 22:00 en Lima.
    assert.equal(hoyEnLima(new Date('2026-11-16T03:00:00Z')), '2026-11-15')
    assert.equal(esFechaReal('2028-02-29'), true)
    assert.equal(esFechaReal('2027-02-29'), false)
  })
})

describe('T99: resto de los campos', () => {
  test('título y contenido con su largo', () => {
    assert.ok(errores({ titulo: 'Hola' }).titulo)
    assert.ok(errores({ titulo: 'x'.repeat(121) }).titulo)
    assert.ok(errores({ contenido: 'Muy corto' }).contenido)
    assert.ok(errores({ contenido: 'x'.repeat(2001) }).contenido)
  })

  for (const publico of ['', 'admins', 'Clientes', undefined]) {
    test(`rechaza el público ${JSON.stringify(publico)}`, () => {
      assert.deepEqual(Object.keys(errores({ publico })), ['publico'])
    })
  }

  test('sin cuerpo marca todos los campos', () => {
    assert.deepEqual(Object.keys(validarNoticia(undefined, HOY).errores).sort(), ['contenido', 'fechaPublicacion', 'publico', 'titulo'])
  })

  test('limpia los espacios del título', () => {
    assert.equal(validarNoticia({ ...valida(), titulo: '  Feria   del  emoliente ' }, HOY).datos.titulo, 'Feria del emoliente')
  })
})
