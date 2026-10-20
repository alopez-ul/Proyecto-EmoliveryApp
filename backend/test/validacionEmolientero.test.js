// US02 - T06/T09: reglas del formulario de registro de emolientero (sin base de datos).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { validarRegistroEmolientero } from '../src/validaciones/emolientero.js'

const HOY = new Date('2026-10-20T12:00:00-05:00')

const valido = () => ({
  nombreNegocio: 'Don Manuel - Emolientes El Parque',
  dni: '45678912',
  codigoMunicipal: 'MLM-2025-00123',
  telefono: '987654321',
  correo: 'manuel@ejemplo.pe',
})

describe('código de autorización municipal', () => {
  test('acepta MLM-AAAA-NNNNN y lo normaliza a mayúsculas', () => {
    const { datos, errores } = validarRegistroEmolientero({ ...valido(), codigoMunicipal: '  mlm-2025-00123 ' }, HOY)
    assert.deepEqual(errores, {})
    assert.equal(datos.codigoMunicipal, 'MLM-2025-00123')
  })

  const invalidos = {
    vacío: '',
    'sin prefijo': '2025-00123',
    'otro distrito': 'MSI-2025-00123',
    'formato antiguo del formulario': 'MUN-2024-890',
    'correlativo corto': 'MLM-2025-123',
    'correlativo con letras': 'MLM-2025-00A23',
    'sin guiones': 'MLM202500123',
    'año futuro': 'MLM-2027-00123',
    'año anterior a 2000': 'MLM-1999-00123',
    'correlativo cero': 'MLM-2025-00000',
  }
  for (const [caso, codigo] of Object.entries(invalidos)) {
    test(`rechaza un código inválido: ${caso}`, () => {
      const { errores } = validarRegistroEmolientero({ ...valido(), codigoMunicipal: codigo }, HOY)
      assert.deepEqual(Object.keys(errores), ['codigoMunicipal'])
    })
  }

  test('rechaza un código que no es texto', () => {
    assert.ok(validarRegistroEmolientero({ ...valido(), codigoMunicipal: 2025123 }, HOY).errores.codigoMunicipal)
  })
})

describe('resto del formulario', () => {
  test('acepta un formulario válido', () => {
    assert.deepEqual(validarRegistroEmolientero(valido(), HOY).errores, {})
  })

  for (const dni of ['1234567', '123456789', '4567891A', '']) {
    test(`rechaza el DNI "${dni}"`, () => {
      assert.deepEqual(Object.keys(validarRegistroEmolientero({ ...valido(), dni }, HOY).errores), ['dni'])
    })
  }

  test('rechaza nombre corto, teléfono y correo inválidos', () => {
    const { errores } = validarRegistroEmolientero({ ...valido(), nombreNegocio: 'Al', telefono: '812345678', correo: 'x@' }, HOY)
    assert.deepEqual(Object.keys(errores).sort(), ['correo', 'nombreNegocio', 'telefono'])
  })

  test('sin cuerpo marca todos los campos', () => {
    assert.equal(Object.keys(validarRegistroEmolientero(undefined, HOY).errores).length, 5)
  })
})
