// US21 (T93, T94, T95, T96) - Pruebas unitarias de FavoritoService y jerarquía Notificacion (RNF18)
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CLIENTE_DEMO_ID,
  FavoritoService,
  Notificacion,
  NotificacionAperturaJornada,
  NotificacionEnApp,
  NotificacionPushSimulada,
} from '../src/favoritos.js'

const EMOLIENTERO_FONTANA = {
  id: 'emo-01',
  nombre: 'Don Lucho - Tradición Molulana',
  codigoMunicipal: 'MLM-2026-00104',
  zona: 'La Fontana',
  direccionReferencia: 'Av. La Fontana 550 (Frente a Puerta Principal USIL)',
}

describe('T93: Marcado y desmarcado de emolienteros favoritos', () => {
  test('permite marcar y desmarcar favoritos sin duplicados', () => {
    const service = new FavoritoService({ favoritosIniciales: [] })

    assert.equal(service.esFavorito(CLIENTE_DEMO_ID, 'emo-01'), false)

    service.marcarFavorito(CLIENTE_DEMO_ID, 'emo-01')
    service.marcarFavorito(CLIENTE_DEMO_ID, 'emo-01') // intento duplicado
    assert.equal(service.esFavorito(CLIENTE_DEMO_ID, 'emo-01'), true)
    assert.equal(service.listarFavoritos(CLIENTE_DEMO_ID).length, 1)

    service.desmarcarFavorito(CLIENTE_DEMO_ID, 'emo-01')
    assert.equal(service.esFavorito(CLIENTE_DEMO_ID, 'emo-01'), false)
    assert.equal(service.listarFavoritos(CLIENTE_DEMO_ID).length, 0)
  })

  test('alternarFavorito cambia el estado entre marcado y desmarcado', () => {
    const service = new FavoritoService({ favoritosIniciales: [] })
    const r1 = service.alternarFavorito(CLIENTE_DEMO_ID, 'emo-04')
    assert.equal(r1.esFavorito, true)

    const r2 = service.alternarFavorito(CLIENTE_DEMO_ID, 'emo-04')
    assert.equal(r2.esFavorito, false)
  })
})

describe('T94 (RNF18): Jerarquía polimórfica Notificacion y subclases', () => {
  test('Notificacion es abstracta y no puede instanciarse directamente', () => {
    assert.throws(
      () =>
        new Notificacion({
          destinatarioId: CLIENTE_DEMO_ID,
          emolientero: EMOLIENTERO_FONTANA,
          zona: 'La Fontana',
        }),
      TypeError,
    )
  })

  test('subclases NotificacionAperturaJornada, NotificacionEnApp y NotificacionPushSimulada formatean y procesan polimórficamente', () => {
    const base = new NotificacionAperturaJornada({
      destinatarioId: CLIENTE_DEMO_ID,
      emolientero: EMOLIENTERO_FONTANA,
      ubicacion: EMOLIENTERO_FONTANA.direccionReferencia,
      zona: 'La Fontana',
    }).procesarEnvio()

    const inApp = new NotificacionEnApp({
      destinatarioId: CLIENTE_DEMO_ID,
      emolientero: EMOLIENTERO_FONTANA,
      ubicacion: EMOLIENTERO_FONTANA.direccionReferencia,
      zona: 'La Fontana',
    }).procesarEnvio()

    const push = new NotificacionPushSimulada({
      destinatarioId: CLIENTE_DEMO_ID,
      emolientero: EMOLIENTERO_FONTANA,
      ubicacion: EMOLIENTERO_FONTANA.direccionReferencia,
      zona: 'La Fontana',
    }).procesarEnvio()

    assert.equal(base.estado, 'ENVIADA')
    assert.ok(base.mensaje.includes('Don Lucho - Tradición Molulana'))
    assert.ok(base.mensaje.includes('Av. La Fontana 550'))

    assert.equal(inApp.canal, 'IN_APP')
    assert.ok(inApp.mensaje.includes('compra anticipada'))

    assert.equal(push.canal, 'PUSH_MOVIL')
    assert.ok(push.titulo.includes('[PUSH EMOLIVERY]'))
  })
})

describe('T95 y T96: Emisión condicional de avisos al abrir jornada y registro de actividad', () => {
  test('T95 (Escenario Exitoso): envía aviso con ubicación cuando el favorito abre en la zona de interés y las notificaciones están activas', () => {
    const service = new FavoritoService({ favoritosIniciales: ['emo-01'] })
    service.actualizarPreferencias(CLIENTE_DEMO_ID, {
      notificacionesHabilitadas: true,
      zonasInteres: ['La Fontana', 'Camacho'],
    })

    const resultado = service.procesarAperturaJornada({
      clienteId: CLIENTE_DEMO_ID,
      emolientero: EMOLIENTERO_FONTANA,
      zonaApertura: 'La Fontana',
      direccionEspecifica: 'Av. La Fontana 550 (Frente a Puerta Principal USIL)',
    })

    assert.equal(resultado.avisoEnviado, true)
    assert.equal(resultado.actividadRegistrada, true)
    assert.equal(resultado.estado, 'NOTIFICACION_ENVIADA')
    assert.ok(resultado.notificacion)
    assert.equal(resultado.notificacion.ubicacion, 'Av. La Fontana 550 (Frente a Puerta Principal USIL)')
    assert.equal(service.obtenerAvisosEnviados().length, 1)
    assert.equal(service.obtenerHistorialActividad().length, 1)
  })

  test('T96 (Caso Inválido 1 - Fuera de zona de interés): registra actividad pero NO envía el aviso', () => {
    const service = new FavoritoService({ favoritosIniciales: ['emo-01'] })
    service.actualizarPreferencias(CLIENTE_DEMO_ID, {
      notificacionesHabilitadas: true,
      zonasInteres: ['La Fontana'],
    })

    const resultado = service.procesarAperturaJornada({
      clienteId: CLIENTE_DEMO_ID,
      emolientero: EMOLIENTERO_FONTANA,
      zonaApertura: 'Musa',
      direccionEspecifica: 'Av. La Molina cdra. 36 (Mercado Cooperativo Musa)',
    })

    assert.equal(resultado.avisoEnviado, false)
    assert.equal(resultado.actividadRegistrada, true)
    assert.equal(resultado.estado, 'AVISO_SUPRIMIDO_ZONA')
    assert.equal(resultado.motivo, 'Apertura fuera de la zona de interés del cliente')
    assert.equal(resultado.notificacion, null)
    assert.equal(service.obtenerAvisosEnviados().length, 0)
    assert.equal(service.obtenerHistorialActividad().length, 1)
  })

  test('T96 (Caso Inválido 2 - Notificaciones desactivadas): registra actividad pero NO envía el aviso', () => {
    const service = new FavoritoService({ favoritosIniciales: ['emo-01'] })
    service.actualizarPreferencias(CLIENTE_DEMO_ID, {
      notificacionesHabilitadas: false,
      zonasInteres: ['La Fontana'],
    })

    const resultado = service.procesarAperturaJornada({
      clienteId: CLIENTE_DEMO_ID,
      emolientero: EMOLIENTERO_FONTANA,
      zonaApertura: 'La Fontana',
      direccionEspecifica: 'Av. La Fontana 550 (Frente a Puerta Principal USIL)',
    })

    assert.equal(resultado.avisoEnviado, false)
    assert.equal(resultado.actividadRegistrada, true)
    assert.equal(resultado.estado, 'AVISO_SUPRIMIDO_CONFIGURACION')
    assert.equal(resultado.motivo, 'Notificaciones desactivadas por el cliente')
    assert.equal(resultado.notificacion, null)
    assert.equal(service.obtenerAvisosEnviados().length, 0)
    assert.equal(service.obtenerHistorialActividad().length, 1)
  })
})
