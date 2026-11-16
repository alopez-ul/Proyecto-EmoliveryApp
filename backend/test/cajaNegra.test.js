// SECCIÓN 10.3 — PRUEBAS DE CAJA NEGRA (Partición de Equivalencia y Análisis de Valores Límite - BVA)
// Evalúa entradas y salidas de las 25 Historias de Usuario (CN-US01 a CN-US25) agrupadas por integrante.

process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/emolivery'
process.env.JWT_SECRET ||= 'clave-secreta-pruebas-unitarias-emolivery-ulima-2026-segura'

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import { Yape } from '../src/pagoYape.js'
import { MapaController } from '../src/localizacion.js'
import { FavoritoService } from '../src/favoritos.js'
import { validarPuntoHabitual } from '../src/validaciones/puntoHabitual.js'
import { generarCodigoRecojo, esCodigoValido, normalizarCodigo } from '../src/codigoRecojo.js'
import { validarNoticia } from '../src/validaciones/noticia.js'
import { validarUbicacion } from '../src/zonaCobertura.js'
import { validarProducto } from '../src/validaciones/producto.js'
import { validarCarrito } from '../src/validaciones/compra.js'
import { resumenResenas } from '../src/consultaResenas.js'
import { validarReporte } from '../src/moderacion.js'
import { validarRegistroEmolientero, errorCodigoMunicipal } from '../src/validaciones/emolientero.js'

const { AvistamientoCliente, AvistamientoVerificado, GpsDelVendedor } = await import(
  '../src/fuentesUbicacion.js'
)
const {
  validarRegistroCliente,
  evaluarAperturaJornada,
  evaluarCierreJornada,
  validarPassword,
  nuevoTokenRecuperacion,
  validarEnlaceRecuperacion,
  VerificacionService,
  calcularResumenHistorial,
  validarYPublicarResena,
  procesarCancelacionOrden,
  publicarRespuestaEmolientero,
  gestionarEstadoUsuario,
} = await import('../src/reglasComplementarias.js')

// ============================================================================
// 1. JORGE RODRIGO BURGA (CN-US01, CN-US06, CN-US07, CN-US14, CN-US21)
// ============================================================================

describe('10.3.1 Caja Negra — Jorge Rodrigo Burga (US01, US06, US07, US14, US21)', () => {
  test('CN-US01 (BVA Celular): rechaza 8 dígitos (98765432), acepta 9 dígitos con 9 (987654321) y rechaza 10 dígitos (9876543210)', () => {
    const base = { nombre: 'Rodrigo Burga', correo: 'rodrigo@ulima.edu.pe' }

    const bva8 = validarRegistroCliente({ ...base, telefono: '98765432' })
    const bva9 = validarRegistroCliente({ ...base, telefono: '987654321' })
    const bva10 = validarRegistroCliente({ ...base, telefono: '9876543210' })

    assert.ok(bva8.errores.telefono)
    assert.equal(bva9.errores.telefono, undefined)
    assert.ok(bva10.errores.telefono)
  })

  test('CN-US06 (BVA Órdenes pendientes al cerrar jornada): 0 órdenes permite cierre; 1 orden pendiente bloquea cierre', () => {
    const aperturaSinGps = evaluarAperturaJornada({ emolientero: { id: 'e1', estadoCuenta: 'activo' }, ubicacionGps: null })
    assert.equal(aperturaSinGps.ok, false)

    const cierreCon0 = evaluarCierreJornada({ estadoActual: 'abierta', ordenesPendientes: 0 })
    const cierreCon1 = evaluarCierreJornada({ estadoActual: 'abierta', ordenesPendientes: 1 })

    assert.equal(cierreCon0.ok, true)
    assert.equal(cierreCon1.ok, false)
  })

  test('CN-US07 (Partición Radio y BVA 50 emolienteros RNF01): radio 300m sin cercanos devuelve mensaje obligatorio vs 1000m con resultados y benchmark 50 activos < 3000ms', () => {
    const controller = new MapaController()

    // Coordenada en extremo de La Molina sin puestos a <= 300 m
    const sinResultados = controller.obtenerCercanos({
      latitud: -12.13,
      longitud: -76.87,
      radioMetros: 300,
    })
    assert.equal(sinResultados.totalEncontrados, 0)
    assert.equal(sinResultados.mensajeVacio, 'No hay emolienteros cercanos disponibles')

    // En La Fontana con radio 1000 m encuentra emolienteros activos
    const conResultados = controller.obtenerCercanos({
      latitud: -12.0731,
      longitud: -76.9502,
      radioMetros: 1000,
    })
    assert.ok(conResultados.totalEncontrados > 0)
    assert.equal(conResultados.mensajeVacio, null)

    // Límite RNF01: 50 emolienteros activos en < 3000 ms
    const bench = controller.ejecutarBenchmarkRNF01(50)
    assert.equal(bench.cantidadGenerada, 50)
    assert.equal(bench.cumpleRNF01, true)
  })

  test('CN-US14 (BVA Vigencia 15:00 vs 15:01 y Monto 11.50 vs 11.49): valida fronteras exactas de pago Yape', () => {
    const t0 = new Date('2026-06-15T10:00:00.000Z')
    const orden = { id: 'ORD-BVA', totalCalculado: 11.5, estado: 'PENDIENTE_PAGO', creadaEn: t0 }

    // Límite exacto 15:00 min (900_000 ms) y monto exacto 11.50 -> Válido
    const yape1 = new Yape([])
    const enLimite15m = yape1.validarYProcesarConstancia({
      orden,
      numeroOperacion: '11223344',
      montoIngresado: 11.5,
      ahora: new Date(t0.getTime() + 15 * 60 * 1000),
    })
    assert.equal(enLimite15m.valido, true)

    // Límite 15:01 min (901_000 ms) -> Rechazado (ORDEN_VENCIDA)
    const vencido15m01s = yape1.validarYProcesarConstancia({
      orden,
      numeroOperacion: '22334455',
      montoIngresado: 11.5,
      ahora: new Date(t0.getTime() + 15 * 60 * 1000 + 1000),
    })
    assert.equal(vencido15m01s.valido, false)
    assert.equal(vencido15m01s.mensaje, 'Pago no válido')

    // Monto 11.49 vs 11.50 -> Rechazado (MONTO_INCORRECTO)
    const monto1149 = yape1.validarYProcesarConstancia({
      orden,
      numeroOperacion: '33445566',
      montoIngresado: 11.49,
      ahora: new Date(t0.getTime() + 5 * 60 * 1000),
    })
    assert.equal(monto1149.valido, false)
    assert.equal(monto1149.codigoCausa, 'MONTO_INCORRECTO')
  })

  test('CN-US21 (Partición Equivalencia Favoritos): zona coincidente envía aviso; fuera de zona o notificaciones OFF suprime aviso y registra actividad', () => {
    const service = new FavoritoService()

    const enviado = service.procesarAperturaJornada({
      cliente: { id: 'c1', esFavorito: true, notificacionesHabilitadas: true, zonasInteres: ['La Fontana'] },
      emolienteroId: 'emo-01',
      zonaApertura: 'La Fontana',
    })
    assert.equal(enviado.avisoEnviado, true)

    const fueraZona = service.procesarAperturaJornada({
      cliente: { id: 'c1', esFavorito: true, notificacionesHabilitadas: true, zonasInteres: ['La Fontana'] },
      emolienteroId: 'emo-01',
      zonaApertura: 'Musa',
    })
    assert.equal(fueraZona.avisoEnviado, false)
    assert.equal(fueraZona.actividadRegistrada, true)

    const notifOff = service.procesarAperturaJornada({
      cliente: { id: 'c1', esFavorito: true, notificacionesHabilitadas: false, zonasInteres: ['La Fontana'] },
      emolienteroId: 'emo-01',
      zonaApertura: 'La Fontana',
    })
    assert.equal(notifOff.avisoEnviado, false)
    assert.equal(notifOff.actividadRegistrada, true)
  })
})

// ============================================================================
// 2. ANTONY LÓPEZ (CN-US09, CN-US10, CN-US15, CN-US22, CN-US23)
// ============================================================================

describe('10.3.2 Caja Negra — Antony López (US09, US10, US15, US22, US23)', () => {
  test('CN-US09 (BVA Radio de Avistamiento): <= 100m verifica coincidencia; > 100m (~101m) rechaza coincidencia', () => {
    const ahora = new Date('2026-06-15T10:10:00.000Z')
    const base = {
      emolienteroId: 'e1',
      nombre: 'Don Lucho',
      lat: -12.08,
      lng: -76.95,
      precisionM: 15,
      registradaEn: '2026-06-15T10:05:00.000Z',
    }

    // ~89 m de diferencia en latitud (0.0008 grados) -> <= 100 m
    const rCerca1 = new AvistamientoCliente({ ...base, clienteId: 'c1' })
    const rCerca2 = new AvistamientoCliente({ ...base, clienteId: 'c2', lat: -12.0808 })
    assert.ok(AvistamientoVerificado.porCoincidencia([rCerca1, rCerca2], ahora))

    // ~105 m de diferencia en latitud (0.00095 grados) -> > 100 m
    const rLejos2 = new AvistamientoCliente({ ...base, clienteId: 'c2', lat: -12.08095 })
    assert.equal(AvistamientoVerificado.porCoincidencia([rCerca1, rLejos2], ahora), null)
  })

  test('CN-US10 (Partición Horario Punto Habitual): 08:00-11:00 válido vs invertido 11:00-08:00 y vacío 08:00-08:00 inválidos', () => {
    const base = { referencia: 'Óvalo La Fontana', lat: -12.0731, lng: -76.9502, diaSemana: 1 }

    const valido = validarPuntoHabitual({ ...base, horaInicio: '08:00', horaFin: '11:00' })
    const invertido = validarPuntoHabitual({ ...base, horaInicio: '11:00', horaFin: '08:00' })
    const vacio = validarPuntoHabitual({ ...base, horaInicio: '08:00', horaFin: '08:00' })

    assert.deepEqual(valido.errores, {})
    assert.ok(invertido.errores.horaFin)
    assert.ok(vacio.errores.horaFin)
  })

  test('CN-US15 (Partición Código de Recojo): 6 caracteres sin 0/O/1/I válido vs caracteres ambiguos o longitud distinta inválidos', () => {
    const generado = generarCodigoRecojo()
    assert.equal(esCodigoValido(generado), true)
    assert.equal(esCodigoValido(normalizarCodigo('abc-23x')), true)
    assert.equal(esCodigoValido('AB01OI'), false) // contiene 0, 1, O, I
    assert.equal(esCodigoValido('ABC23'), false) // 5 caracteres
  })

  test('CN-US22 (BVA Fecha de Noticia Municipal): hoy válida vs ayer o fecha inexistente 2026-02-30 inválidas', () => {
    const base = {
      titulo: 'Feria del Emoliente en La Molina',
      contenido: 'Este sábado se realizará la feria saludable en el Parque Hispanoamérica.',
      publico: 'todos',
    }
    const hoy = '2026-06-15'

    const hoyValida = validarNoticia({ ...base, fechaPublicacion: '2026-06-15' }, hoy)
    const ayerInvalida = validarNoticia({ ...base, fechaPublicacion: '2026-06-14' }, hoy)
    const feb30Invalida = validarNoticia({ ...base, fechaPublicacion: '2026-02-30' }, hoy)

    assert.deepEqual(hoyValida.errores, {})
    assert.ok(ayerInvalida.errores.fechaPublicacion)
    assert.ok(feb30Invalida.errores.fechaPublicacion)
  })

  test('CN-US23 (BVA Motivo de Rechazo Municipal): 9 caracteres inválido vs 10 caracteres válido', () => {
    const service = new VerificacionService()
    const emolientero = { id: 'e1', estado: 'pendiente_verificacion', codigoMunicipal: 'LM-2026' }

    const bva9 = service.procesarDecision({ emolientero, decision: 'rechazar', motivo: '123456789' })
    const bva10 = service.procesarDecision({ emolientero, decision: 'rechazar', motivo: '1234567890' })

    assert.equal(bva9.ok, false)
    assert.equal(bva10.ok, true)
  })
})

// ============================================================================
// 3. FABIO MENDOZA (CN-US05, CN-US08, CN-US17, CN-US20)
// ============================================================================

describe('10.3.3 Caja Negra — Fabio Mendoza (US05, US08, US17, US20)', () => {
  test('CN-US05 (BVA Precisión GPS RNF09): 50.0 m aceptado vs 50.1 m rechazado', () => {
    const bva50 = validarUbicacion({ lat: -12.085, lng: -76.945, precision: 50.0 })
    const bva50_1 = validarUbicacion({ lat: -12.085, lng: -76.945, precision: 50.1 })

    assert.equal(bva50, null)
    assert.equal(bva50_1.status, 422)
  })

  test('CN-US08 (BVA Umbrales de Confiabilidad por Antigüedad): 14m alto, 15m/60m medio, 61m/240m bajo y 241m no confirmada', () => {
    const t0 = new Date('2026-06-15T08:00:00.000Z')
    const fuente = new GpsDelVendedor({
      id: 1,
      emolienteroId: 'e1',
      nombre: 'Don Lucho',
      lat: -12.085,
      lng: -76.945,
      precisionM: 15,
      registradaEn: t0,
    })

    const enMin = (m) => new Date(t0.getTime() + m * 60_000)

    assert.equal(fuente.nivelConfiabilidad(enMin(14)), 'alto')
    assert.equal(fuente.nivelConfiabilidad(enMin(15)), 'medio')
    assert.equal(fuente.nivelConfiabilidad(enMin(60)), 'medio')
    assert.equal(fuente.nivelConfiabilidad(enMin(61)), 'bajo')
    assert.equal(fuente.estaConfirmada(enMin(240)), true)
    assert.equal(fuente.estaConfirmada(enMin(241)), false)
  })

  test('CN-US17 (BVA Estrellas de Reseña): 0 inválida, 1 válida, 5 válida, 6 inválida', () => {
    const crearConEstrellas = (estrellas) =>
      validarYPublicarResena({
        orden: { id: `o-${estrellas}`, clienteId: 'c1', emolienteroId: 'e1', estado: 'entregada' },
        clienteId: 'c1',
        calificacion: estrellas,
        comentario: 'Buen emoliente caliente.',
      })

    assert.equal(crearConEstrellas(0).ok, false)
    assert.equal(crearConEstrellas(1).ok, true)
    assert.equal(crearConEstrellas(5).ok, true)
    assert.equal(crearConEstrellas(6).ok, false)
  })

  test('CN-US20 (Partición Historial de Compras): rango con compras devuelve suma exacta; rango sin compras devuelve mensaje vacío', () => {
    const lista = [{ id: 'o1', fecha: '2026-05-10T10:00:00Z', total: 14.5 }]

    const conDatos = calcularResumenHistorial(lista, {
      fechaDesde: '2026-05-01T00:00:00Z',
      fechaHasta: '2026-05-31T23:59:59Z',
    })
    assert.equal(conDatos.vacio, false)
    assert.equal(conDatos.montoAcumulado, 14.5)

    const sinDatos = calcularResumenHistorial(lista, {
      fechaDesde: '2026-06-01T00:00:00Z',
      fechaHasta: '2026-06-30T23:59:59Z',
    })
    assert.equal(sinDatos.vacio, true)
    assert.equal(sinDatos.mensaje, 'No se encontraron compras en este periodo')
  })
})

// ============================================================================
// 4. MATÍAS SAN MIGUEL (CN-US03, CN-US04, CN-US11, CN-US13, CN-US18, CN-US25)
// ============================================================================

describe('10.3.4 Caja Negra — Matías San Miguel (US03, US04, US11, US13, US18, US25)', () => {
  test('CN-US03 (BVA Longitud de Contraseña): 7 caracteres inválida vs 8 caracteres con letras y números válida', () => {
    assert.ok(validarPassword('Abc1234')) // 7 chars
    assert.equal(validarPassword('Abc12345'), null) // 8 chars
  })

  test('CN-US04 (BVA Vigencia de Enlace Recuperación): 15 min válido vs 16 min vencido', () => {
    const { token, tokenHash } = nuevoTokenRecuperacion()
    const t0 = new Date('2026-06-15T10:00:00.000Z')

    const bva15 = validarEnlaceRecuperacion({
      tokenRecibido: token,
      registroToken: { tokenHash, creadoEn: t0, usado: false },
      ahora: new Date(t0.getTime() + 15 * 60_000),
      vigenciaMaxMinutos: 15,
    })
    const bva16 = validarEnlaceRecuperacion({
      tokenRecibido: token,
      registroToken: { tokenHash, creadoEn: t0, usado: false },
      ahora: new Date(t0.getTime() + 16 * 60_000),
      vigenciaMaxMinutos: 15,
    })

    assert.equal(bva15.ok, true)
    assert.equal(bva16.ok, false)
    assert.equal(bva16.codigo, 'ENLACE_VENCIDO')
  })

  test('CN-US11 (BVA Precio de Producto): S/ 0.00 inválido, S/ 0.10 válido, S/ 100.00 válido, S/ 100.01 inválido', () => {
    const base = { nombre: 'Emoliente Especial', categoria: 'emoliente' }

    assert.ok(validarProducto({ ...base, precio: 0.0 }).errores.precio)
    assert.equal(validarProducto({ ...base, precio: 0.1 }).errores.precio, undefined)
    assert.equal(validarProducto({ ...base, precio: 100.0 }).errores.precio, undefined)
    assert.ok(validarProducto({ ...base, precio: 100.01 }).errores.precio)
  })

  test('CN-US13 (BVA Cantidad en Carrito): 0 inválida, 1 válida, 20 válida, 21 inválida', () => {
    const uuid = '11111111-2222-3333-4444-555555555555'
    const probarCantidad = (c) =>
      validarCarrito({ emolienteroId: uuid, lineas: [{ productoId: 1, cantidad: c }] })

    assert.ok(probarCantidad(0).errores.carrito)
    assert.equal(probarCantidad(1).errores.carrito, undefined)
    assert.equal(probarCantidad(20).errores.carrito, undefined)
    assert.ok(probarCantidad(21).errores.carrito)
  })

  test('CN-US18 (Partición Consulta de Reseñas): lista vacía devuelve promedio null; lista con datos redondea a 1 decimal', () => {
    assert.deepEqual(resumenResenas([]), { total: 0, promedio: null })
    assert.deepEqual(resumenResenas([{ calificacion: 5 }, { calificacion: 4 }, { calificacion: 4 }]), {
      total: 3,
      promedio: 4.3,
    })
  })

  test('CN-US25 (BVA Motivo de Reporte para Moderación): 9 caracteres inválido vs 10 caracteres válido', () => {
    assert.ok(validarReporte({ motivo: '123456789' }).errores.motivo)
    assert.equal(validarReporte({ motivo: '1234567890' }).errores.motivo, undefined)
  })
})

// ============================================================================
// 5. RENZO PACHECO (CN-US02, CN-US12, CN-US16, CN-US19, CN-US24)
// ============================================================================

describe('10.3.5 Caja Negra — Renzo Pacheco (US02, US12, US16, US19, US24)', () => {
  test('CN-US02 (BVA DNI y Código Municipal): DNI 7/8/9 dígitos y año municipal 1999/2000/2026/2027, correlativo 00000 vs 00001', () => {
    const hoy = new Date('2026-06-15T12:00:00.000Z')
    const base = {
      nombreNegocio: 'Emolientes Don Lucho',
      codigoMunicipal: 'MLM-2026-00001',
      telefono: '987654321',
      correo: 'lucho@emolivery.pe',
    }

    assert.ok(validarRegistroEmolientero({ ...base, dni: '1234567' }, hoy).errores.dni)
    assert.equal(validarRegistroEmolientero({ ...base, dni: '12345678' }, hoy).errores.dni, undefined)
    assert.ok(validarRegistroEmolientero({ ...base, dni: '123456789' }, hoy).errores.dni)

    assert.ok(errorCodigoMunicipal('MLM-1999-00001', hoy))
    assert.equal(errorCodigoMunicipal('MLM-2000-00001', hoy), null)
    assert.equal(errorCodigoMunicipal('MLM-2026-00001', hoy), null)
    assert.ok(errorCodigoMunicipal('MLM-2027-00001', hoy))
    assert.ok(errorCodigoMunicipal('MLM-2026-00000', hoy))
  })

  test('CN-US12 (BVA Descripción de Catálogo Público): 200 caracteres válida vs 201 caracteres inválida', () => {
    const base = { nombre: 'Quinua con Manzana', categoria: 'quinua_avena', precio: 4.5 }

    const bva200 = validarProducto({ ...base, descripcion: 'a'.repeat(200) })
    const bva201 = validarProducto({ ...base, descripcion: 'a'.repeat(201) })

    assert.equal(bva200.errores.descripcion, undefined)
    assert.ok(bva201.errores.descripcion)
  })

  test('CN-US16 (BVA Plazo de Cancelación Anticipada): 30.0 min válido vs 30.1 min rechazado', () => {
    const t0 = new Date('2026-06-15T08:00:00.000Z')
    const orden = { id: 'o-bva', estado: 'pagada', total: 8.0, fechaPago: t0.toISOString(), items: [] }

    const bva30_0 = procesarCancelacionOrden({
      orden,
      ahora: new Date(t0.getTime() + 30 * 60_000).toISOString(),
    })
    const bva30_1 = procesarCancelacionOrden({
      orden,
      ahora: new Date(t0.getTime() + 30.1 * 60_000).toISOString(),
    })

    assert.equal(bva30_0.ok, true)
    assert.equal(bva30_1.ok, false)
    assert.equal(bva30_1.error, 'La compra ya no puede cancelarse')
  })

  test('CN-US19 (Partición Respuesta del Emolientero): primera respuesta válida vs segunda respuesta duplicada rechazada', () => {
    const primera = publicarRespuestaEmolientero({
      resena: { id: 'r1', emolienteroId: 'e1', estado: 'activa', respuesta: null },
      emolienteroId: 'e1',
      textoRespuesta: '¡Gracias por tu preferencia!',
    })
    assert.equal(primera.ok, true)

    const segunda = publicarRespuestaEmolientero({
      resena: primera.resenaActualizada,
      emolienteroId: 'e1',
      textoRespuesta: 'Otra respuesta adicional',
    })
    assert.equal(segunda.ok, false)
    assert.equal(segunda.codigo, 'RESPUESTA_DUPLICADA')
  })

  test('CN-US24 (BVA Suspensión de Emolientero con Órdenes Pendientes): 0 órdenes permite suspender; 1 orden pendiente bloquea', () => {
    const usuario = { id: 'e1', rol: 'emolientero', estado: 'activo' }

    const con0 = gestionarEstadoUsuario({
      usuario,
      accion: 'suspender',
      motivo: 'Suspensión preventiva municipal',
      ordenesPendientesEntrega: 0,
    })
    const con1 = gestionarEstadoUsuario({
      usuario,
      accion: 'suspender',
      motivo: 'Suspensión preventiva municipal',
      ordenesPendientesEntrega: 1,
    })

    assert.equal(con0.ok, true)
    assert.equal(con1.ok, false)
    assert.equal(con1.codigo, 'EMOLIENTERO_CON_ORDENES_PENDIENTES')
  })
})
