// US14 (T63, T64, T65, T66, T67) - Pruebas unitarias de MetodoPago, subclase Yape y PagoController (RNF18 / RNF06)
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { MetodoPago, PagoController, Yape } from '../src/pagoYape.js'

const AHORA = new Date('2026-11-15T16:00:00Z')
const haceMinutos = (min) => new Date(AHORA.getTime() - min * 60_000)

function crearOrdenPrueba(overrides = {}) {
  return {
    id: 'ORD-2026-1001',
    totalCalculado: 11.5,
    estado: 'PENDIENTE_PAGO',
    creadaEn: haceMinutos(3).toISOString(),
    emolientero: {
      id: 'emo-01',
      nombre: 'Don Lucho - Tradición Molulana',
      encargado: 'Luis Alberto Quispe Mamani',
      telefonoYape: '987654321',
    },
    ...overrides,
  }
}

describe('T63 y T64: Jerarquía MetodoPago, subclase Yape y generación de QR', () => {
  test('MetodoPago es abstracta y exige instanciar una subclase como Yape', () => {
    assert.throws(() => new MetodoPago('Genérico'), TypeError)
  })

  test('Yape genera los datos del QR con el monto exacto y titular verificado', () => {
    const controller = new PagoController(new Yape())
    const orden = crearOrdenPrueba()
    const qr = controller.obtenerDatosQR(orden)

    assert.equal(qr.metodo, 'Yape')
    assert.equal(qr.montoTotal, 11.5)
    assert.equal(qr.telefonoDestino, '987654321')
    assert.equal(qr.vigenciaMinutos, 15)
    assert.ok(qr.payloadQR.includes('PE.YAPE.QR'))
  })
})

describe('T66 y T67: Validación de constancia Yape (Exitoso y Casos Inválidos de Caja Negra)', () => {
  test('Caso 1 (Exitoso): operación única, monto exacto y orden vigente pasa a Pagada y genera código de recojo', () => {
    const controller = new PagoController(new Yape(['12345678']))
    const orden = crearOrdenPrueba()

    const resultado = controller.procesarConstancia({
      orden,
      numeroOperacion: '84920174',
      montoIngresado: 11.5,
      ahora: AHORA,
    })

    assert.equal(resultado.valido, true)
    assert.equal(resultado.estadoOrden, 'Pagada')
    assert.equal(resultado.reservaLiberada, false)
    assert.match(resultado.codigoRecojo, /^EMO-\d{4}$/)
    assert.equal(resultado.ordenActualizada.estado, 'Pagada')
  })

  test('Caso 2 (Operación Duplicada): rechaza número de operación ya usado con "Pago no válido" y libera reserva', () => {
    const controller = new PagoController(new Yape(['12345678']))
    const orden = crearOrdenPrueba()

    const resultado = controller.procesarConstancia({
      orden,
      numeroOperacion: '12345678',
      montoIngresado: 11.5,
      ahora: AHORA,
    })

    assert.equal(resultado.valido, false)
    assert.equal(resultado.mensaje, 'Pago no válido')
    assert.equal(resultado.codigoCausa, 'OPERACION_DUPLICADA')
    assert.equal(resultado.reservaLiberada, true)
    assert.equal(resultado.estadoOrden, 'Rechazada / Reserva Liberada')
    assert.equal(resultado.codigoRecojo, null)
  })

  test('impide reutilizar un número de operación recién aprobado en una segunda orden', () => {
    const controller = new PagoController(new Yape([]))
    const primera = controller.procesarConstancia({
      orden: crearOrdenPrueba({ id: 'ORD-1' }),
      numeroOperacion: '55443322',
      montoIngresado: 11.5,
      ahora: AHORA,
    })
    assert.equal(primera.valido, true)

    const segunda = controller.procesarConstancia({
      orden: crearOrdenPrueba({ id: 'ORD-2' }),
      numeroOperacion: '55443322',
      montoIngresado: 11.5,
      ahora: AHORA,
    })
    assert.equal(segunda.valido, false)
    assert.equal(segunda.mensaje, 'Pago no válido')
    assert.equal(segunda.codigoCausa, 'OPERACION_DUPLICADA')
  })

  test('Caso 3 (Monto Distinto): rechaza cuando el monto no coincide con el total de la orden con "Pago no válido"', () => {
    const controller = new PagoController(new Yape())
    const orden = crearOrdenPrueba({ totalCalculado: 11.5 })

    const resultado = controller.procesarConstancia({
      orden,
      numeroOperacion: '71829364',
      montoIngresado: 5.0,
      ahora: AHORA,
    })

    assert.equal(resultado.valido, false)
    assert.equal(resultado.mensaje, 'Pago no válido')
    assert.equal(resultado.codigoCausa, 'MONTO_INCORRECTO')
    assert.equal(resultado.reservaLiberada, true)
  })

  test('Caso 4 (Orden Vencida > 15 min): rechaza la constancia con "Pago no válido" y libera la reserva', () => {
    const controller = new PagoController(new Yape())
    const ordenVencida = crearOrdenPrueba({
      creadaEn: haceMinutos(16).toISOString(),
    })

    const resultado = controller.procesarConstancia({
      orden: ordenVencida,
      numeroOperacion: '91827364',
      montoIngresado: 11.5,
      ahora: AHORA,
    })

    assert.equal(resultado.valido, false)
    assert.equal(resultado.mensaje, 'Pago no válido')
    assert.equal(resultado.codigoCausa, 'ORDEN_VENCIDA')
    assert.equal(resultado.reservaLiberada, true)
  })

  test('RNF06: registra todos los intentos exitosos y rechazados en la bitácora de auditoría', () => {
    const controller = new PagoController(new Yape(['12345678']))
    controller.procesarConstancia({
      orden: crearOrdenPrueba({ id: 'ORD-OK' }),
      numeroOperacion: '33445566',
      montoIngresado: 11.5,
      ahora: AHORA,
    })
    controller.procesarConstancia({
      orden: crearOrdenPrueba({ id: 'ORD-DUP' }),
      numeroOperacion: '12345678',
      montoIngresado: 11.5,
      ahora: AHORA,
    })

    const bitacora = controller.obtenerBitacora()
    assert.equal(bitacora.length, 2)
    assert.equal(bitacora[0].resultado, 'RECHAZADO')
    assert.equal(bitacora[1].resultado, 'ACEPTADO')
  })
})
