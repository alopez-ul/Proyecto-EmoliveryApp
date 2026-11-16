// SECCIÓN 10.2 — PRUEBAS DE CAJA BLANCA (Camino Básico de McCabe, V(G) y Cobertura de Ramas)
// Evalúa el 100% de las decisiones lógicas (if/else y cláusulas de guarda) de los métodos
// principales de los 5 integrantes del equipo EMOLIVERY.

process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/emolivery'
process.env.JWT_SECRET ||= 'clave-secreta-pruebas-unitarias-emolivery-ulima-2026-segura'

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import { Yape } from '../src/pagoYape.js'
import { Ubicacion, Localizador, CriterioPorDistancia } from '../src/localizacion.js'
import { FavoritoService } from '../src/favoritos.js'
import { seTraslapan, buscarTraslape } from '../src/validaciones/puntoHabitual.js'
import { validarUbicacion } from '../src/zonaCobertura.js'
import { verificarCompra } from '../src/orden.js'
import { verificarDecidible, reputacionTrasDecision } from '../src/moderacion.js'
import { errorCodigoMunicipal } from '../src/validaciones/emolientero.js'

const { AvistamientoCliente, AvistamientoVerificado, GpsDelVendedor } = await import(
  '../src/fuentesUbicacion.js'
)
const { procesarCancelacionOrden, gestionarEstadoUsuario } = await import(
  '../src/reglasComplementarias.js'
)

// ============================================================================
// 1. JORGE RODRIGO BURGA (US07, US14, US21, US06)
// ============================================================================

describe('10.2.1 Caja Blanca — Jorge Rodrigo Burga (US14, US07, US21)', () => {
  describe('Yape.prototype.validarYProcesarConstancia (V(G) = 5)', () => {
    const baseOrden = {
      id: 'ORD-CB-01',
      totalCalculado: 11.5,
      estado: 'PENDIENTE_PAGO',
      creadaEn: new Date('2026-06-15T10:00:00.000Z'),
    }

    test('CB-YAP-R1: Rama D1 verdadera (!esOrdenVigente -> ORDEN_VENCIDA)', () => {
      const yape = new Yape(['12345678'])
      const res = yape.validarYProcesarConstancia({
        orden: baseOrden,
        numeroOperacion: '55443322',
        montoIngresado: 11.5,
        ahora: new Date('2026-06-15T10:16:00.000Z'), // 16 min > 15 min
      })

      assert.equal(res.valido, false)
      assert.equal(res.codigoCausa, 'ORDEN_VENCIDA')
      assert.equal(res.reservaLiberada, true)
    })

    test('CB-YAP-R2: Rama D1 falsa, D2 verdadera (!/^\\d{6,10}$/ -> FORMATO_OPERACION_INVALIDO)', () => {
      const yape = new Yape(['12345678'])
      const res = yape.validarYProcesarConstancia({
        orden: baseOrden,
        numeroOperacion: '12AB',
        montoIngresado: 11.5,
        ahora: new Date('2026-06-15T10:05:00.000Z'),
      })

      assert.equal(res.valido, false)
      assert.equal(res.codigoCausa, 'FORMATO_OPERACION_INVALIDO')
    })

    test('CB-YAP-R3: Ramas D1-D2 falsas, D3 verdadera (esOperacionDuplicada -> OPERACION_DUPLICADA)', () => {
      const yape = new Yape(['12345678'])
      const res = yape.validarYProcesarConstancia({
        orden: baseOrden,
        numeroOperacion: '12345678',
        montoIngresado: 11.5,
        ahora: new Date('2026-06-15T10:05:00.000Z'),
      })

      assert.equal(res.valido, false)
      assert.equal(res.codigoCausa, 'OPERACION_DUPLICADA')
    })

    test('CB-YAP-R4: Ramas D1-D3 falsas, D4 verdadera (Math.abs(monto - total) >= 0.005 -> MONTO_INCORRECTO)', () => {
      const yape = new Yape(['12345678'])
      const res = yape.validarYProcesarConstancia({
        orden: baseOrden,
        numeroOperacion: '77889900',
        montoIngresado: 9.0,
        ahora: new Date('2026-06-15T10:05:00.000Z'),
      })

      assert.equal(res.valido, false)
      assert.equal(res.codigoCausa, 'MONTO_INCORRECTO')
    })

    test('CB-YAP-R5: Camino nominal D1-D4 falsas -> PAGO_VERIFICADO y estado Pagada', () => {
      const yape = new Yape(['12345678'])
      const res = yape.validarYProcesarConstancia({
        orden: baseOrden,
        numeroOperacion: '77889900',
        montoIngresado: 11.5,
        ahora: new Date('2026-06-15T10:05:00.000Z'),
      })

      assert.equal(res.valido, true)
      assert.equal(res.codigoCausa, 'PAGO_VERIFICADO')
      assert.equal(res.estadoOrden, 'Pagada')
      assert.match(res.codigoRecojo, /^EMO-\d{4}$/)
    })
  })

  describe('Ubicacion.prototype.calcularDistanciaGeodesica y Localizador.prototype.buscarCercanos (V(G) = 4)', () => {
    test('CB-UBI-R1: Guarda de coordenada inválida lanza TypeError / RangeError', () => {
      assert.throws(() => new Ubicacion({ latitud: 'invalido', longitud: -76.95 }), TypeError)
      assert.throws(() => new Ubicacion({ latitud: -99, longitud: -76.95 }), RangeError)

      const origen = new Ubicacion({ latitud: -12.0731, longitud: -76.9502 })
      assert.throws(() => origen.calcularDistanciaGeodesica(null), TypeError)
    })

    test('CB-UBI-R2: obtenerEmolienterosElegibles descarta inactivos o con antiguedadMin > 240', () => {
      const localizador = new Localizador([
        {
          id: 'e-activo',
          nombre: 'Don Lucho',
          latitud: -12.0731,
          longitud: -76.9502,
          jornadaAbierta: true,
          estadoCuenta: 'activo',
          antiguedadMin: 10,
        },
        {
          id: 'e-cerrado',
          nombre: 'Cerrado',
          latitud: -12.0735,
          longitud: -76.9505,
          jornadaAbierta: false,
          estadoCuenta: 'activo',
          antiguedadMin: 10,
        },
        {
          id: 'e-expirado',
          nombre: 'Expirado',
          latitud: -12.0735,
          longitud: -76.9505,
          jornadaAbierta: true,
          estadoCuenta: 'activo',
          antiguedadMin: 260,
        },
      ])

      const elegibles = localizador.obtenerEmolienterosElegibles()
      assert.equal(elegibles.length, 1)
      assert.equal(elegibles[0].id, 'e-activo')
    })

    test('CB-UBI-R3: Bucle distanciaMetros <= radio y ordenamiento ascendente con CriterioPorDistancia', () => {
      const localizador = new Localizador([
        {
          id: 'e-lejos',
          nombre: 'Lejos (450m)',
          latitud: -12.0771,
          longitud: -76.9502,
          jornadaAbierta: true,
          estadoCuenta: 'activo',
          antiguedadMin: 5,
        },
        {
          id: 'e-cerca',
          nombre: 'Cerca (110m)',
          latitud: -12.0741,
          longitud: -76.9502,
          jornadaAbierta: true,
          estadoCuenta: 'activo',
          antiguedadMin: 5,
        },
      ])

      const cercanos = localizador.buscarCercanos({
        ubicacionCliente: { latitud: -12.0731, longitud: -76.9502 },
        radioMetros: 600,
        criterioOrden: new CriterioPorDistancia(),
      })

      assert.equal(cercanos.length, 2)
      assert.equal(cercanos[0].id, 'e-cerca')
      assert.equal(cercanos[1].id, 'e-lejos')
      assert.ok(cercanos[0].distanciaMetros < cercanos[1].distanciaMetros)
    })
  })

  describe('FavoritoService.prototype.procesarAperturaJornada (V(G) = 3)', () => {
    test('CB-FAV-R1: Rama !notificacionesHabilitadas -> AVISO_SUPRIMIDO_CONFIGURACION', () => {
      const service = new FavoritoService()
      const res = service.procesarAperturaJornada({
        cliente: {
          id: 'cli-cb',
          esFavorito: true,
          notificacionesHabilitadas: false,
          zonasInteres: ['La Fontana'],
        },
        emolienteroId: 'emo-01',
        zonaApertura: 'La Fontana',
      })

      assert.equal(res.avisoEnviado, false)
      assert.equal(res.estado, 'AVISO_SUPRIMIDO_CONFIGURACION')
      assert.equal(res.actividadRegistrada, true)
    })

    test('CB-FAV-R2: Rama !coincideZona -> AVISO_SUPRIMIDO_ZONA', () => {
      const service = new FavoritoService()
      const res = service.procesarAperturaJornada({
        cliente: {
          id: 'cli-cb',
          esFavorito: true,
          notificacionesHabilitadas: true,
          zonasInteres: ['La Fontana'],
        },
        emolienteroId: 'emo-01',
        zonaApertura: 'Rinconada',
      })

      assert.equal(res.avisoEnviado, false)
      assert.equal(res.estado, 'AVISO_SUPRIMIDO_ZONA')
      assert.equal(res.actividadRegistrada, true)
    })

    test('CB-FAV-R3: Camino nominal -> instancia polimórfica Notificacion y estado NOTIFICACION_ENVIADA', () => {
      const service = new FavoritoService()
      const res = service.procesarAperturaJornada({
        cliente: {
          id: 'cli-cb',
          esFavorito: true,
          notificacionesHabilitadas: true,
          zonasInteres: ['La Fontana'],
          canalPreferido: 'IN_APP',
        },
        emolienteroId: 'emo-01',
        zonaApertura: 'La Fontana',
      })

      assert.equal(res.avisoEnviado, true)
      assert.equal(res.estado, 'NOTIFICACION_ENVIADA')
      assert.ok(res.notificacion)
      assert.equal(res.notificacion.estado, 'ENVIADA')
    })
  })
})

// ============================================================================
// 2. ANTONY LÓPEZ (US10, US09, US23)
// ============================================================================

describe('10.2.2 Caja Blanca — Antony López (US10, US09)', () => {
  describe('seTraslapan y buscarTraslape (V(G) = 4)', () => {
    const existentes = [
      { id: 1, referencia: 'USIL La Fontana', diaSemana: 1, horaInicio: '07:00', horaFin: '10:00' },
    ]

    test('CB-HOR-R1: Día distinto (p.diaSemana !== nuevo.diaSemana -> continúa y retorna null)', () => {
      const nuevo = { id: 2, diaSemana: 2, horaInicio: '08:00', horaFin: '09:00' }
      assert.equal(seTraslapan(nuevo, existentes[0]), false)
      assert.equal(buscarTraslape(nuevo, existentes), null)
    })

    test('CB-HOR-R2: Mismo día pero rangos contiguos (inicioA < finB && inicioB < finA falso -> null)', () => {
      const contiguo = { id: 2, diaSemana: 1, horaInicio: '10:00', horaFin: '12:00' }
      assert.equal(seTraslapan(contiguo, existentes[0]), false)
      assert.equal(buscarTraslape(contiguo, existentes), null)
    })

    test('CB-HOR-R3: Mismo día con intersección verdadera -> retorna el punto en conflicto', () => {
      const traslapado = { id: 2, diaSemana: 1, horaInicio: '09:00', horaFin: '11:00' }
      assert.equal(seTraslapan(traslapado, existentes[0]), true)
      const conflicto = buscarTraslape(traslapado, existentes)
      assert.ok(conflicto)
      assert.equal(conflicto.id, 1)
    })
  })

  describe('AvistamientoVerificado.porCoincidencia (V(G) = 4)', () => {
    const ahora = new Date('2026-06-15T10:15:00.000Z')

    test('CB-AVI-R1: Mismo cliente repetido es deduplicado por equals/hashCode -> retorna null', () => {
      const r1 = new AvistamientoCliente({
        emolienteroId: 'e1',
        clienteId: 'cli-mismo',
        nombre: 'Don Lucho',
        lat: -12.0731,
        lng: -76.9502,
        precisionM: 15,
        registradaEn: '2026-06-15T10:05:00.000Z',
      })
      const r2 = new AvistamientoCliente({
        emolienteroId: 'e1',
        clienteId: 'cli-mismo',
        nombre: 'Don Lucho',
        lat: -12.0732,
        lng: -76.9503,
        precisionM: 15,
        registradaEn: '2026-06-15T10:10:00.000Z',
      })

      assert.equal(AvistamientoVerificado.porCoincidencia([r1, r2], ahora), null)
    })

    test('CB-AVI-R2: Dos clientes distintos pero a > 100 m de distancia -> retorna null', () => {
      const r1 = new AvistamientoCliente({
        emolienteroId: 'e1',
        clienteId: 'cli-1',
        nombre: 'Don Lucho',
        lat: -12.0731,
        lng: -76.9502,
        precisionM: 15,
        registradaEn: '2026-06-15T10:05:00.000Z',
      })
      const r2 = new AvistamientoCliente({
        emolienteroId: 'e1',
        clienteId: 'cli-2',
        nombre: 'Don Lucho',
        lat: -12.08, // > 700 m de distancia
        lng: -76.9502,
        precisionM: 15,
        registradaEn: '2026-06-15T10:10:00.000Z',
      })

      assert.equal(AvistamientoVerificado.porCoincidencia([r1, r2], ahora), null)
    })

    test('CB-AVI-R3: Dos clientes distintos a <= 100 m y <= 30 min -> retorna AvistamientoVerificado en punto medio', () => {
      const r1 = new AvistamientoCliente({
        emolienteroId: 'e1',
        clienteId: 'cli-1',
        nombre: 'Don Lucho',
        lat: -12.0731,
        lng: -76.9502,
        precisionM: 15,
        registradaEn: '2026-06-15T10:05:00.000Z',
      })
      const r2 = new AvistamientoCliente({
        emolienteroId: 'e1',
        clienteId: 'cli-2',
        nombre: 'Don Lucho',
        lat: -12.0733,
        lng: -76.9504,
        precisionM: 15,
        registradaEn: '2026-06-15T10:10:00.000Z',
      })

      const verificado = AvistamientoVerificado.porCoincidencia([r1, r2], ahora)
      assert.ok(verificado instanceof AvistamientoVerificado)
      assert.equal(verificado.confirmaciones, 2)
    })
  })
})

// ============================================================================
// 3. FABIO MENDOZA (US05, US08, US17)
// ============================================================================

describe('10.2.3 Caja Blanca — Fabio Mendoza (US05, US08)', () => {
  describe('validarUbicacion (V(G) = 4)', () => {
    test('CB-ZONA-R1: Guarda de datos no numéricos o precisión <= 0 retorna status 400', () => {
      assert.equal(validarUbicacion({ lat: 'abc', lng: -76.95, precision: 20 }).status, 400)
      assert.equal(validarUbicacion({ lat: -12.08, lng: -76.95, precision: 0 }).status, 400)
    })

    test('CB-ZONA-R2: Rama !dentroDeLaMolina retorna status 422 fuera de zona de cobertura', () => {
      const res = validarUbicacion({ lat: -12.0464, lng: -77.0428, precision: 15 })
      assert.equal(res.status, 422)
      assert.equal(res.error, 'Ubicación fuera de la zona de cobertura.')
    })

    test('CB-ZONA-R3: Rama precision > 50 retorna status 422 por RNF09', () => {
      const res = validarUbicacion({ lat: -12.085, lng: -76.945, precision: 65 })
      assert.equal(res.status, 422)
      assert.match(res.error, /50 m/)
    })

    test('CB-ZONA-R4: Camino nominal dentro de La Molina y precisión <= 50 m retorna null', () => {
      const res = validarUbicacion({ lat: -12.085, lng: -76.945, precision: 25 })
      assert.equal(res, null)
    })
  })

  describe('FuenteUbicacion.prototype.puntaje y factorVigencia (V(G) = 4)', () => {
    const t0 = new Date('2026-06-15T08:00:00.000Z')
    const gps = new GpsDelVendedor({
      id: 1,
      emolienteroId: 'e1',
      nombre: 'Don Lucho',
      lat: -12.085,
      lng: -76.945,
      precisionM: 10, // confiabilidad base = 1.0
      registradaEn: t0,
    })

    test('CB-FUE-R1: antiguedad >= 240 min -> factorVigencia = 0 y puntaje = 0', () => {
      const t250 = new Date(t0.getTime() + 250 * 60_000)
      assert.equal(gps.puntaje(t250), 0)
      assert.equal(gps.estaConfirmada(t250), false)
    })

    test('CB-FUE-R2: antiguedad <= 15 min -> retorna calcularConfiabilidad() íntegro (1.0)', () => {
      const t10 = new Date(t0.getTime() + 10 * 60_000)
      assert.equal(gps.puntaje(t10), 1.0)
      assert.equal(gps.nivelConfiabilidad(t10), 'alto')
    })

    test('CB-FUE-R3: 15 < antiguedad < 240 min -> interpolación lineal decreciente', () => {
      const t127_5 = new Date(t0.getTime() + 127.5 * 60_000) // punto medio entre 15 y 240 min
      assert.equal(gps.puntaje(t127_5), 0.5)
    })
  })
})

// ============================================================================
// 4. MATÍAS SAN MIGUEL (US13, US25, US03)
// ============================================================================

describe('10.2.4 Caja Blanca — Matías San Miguel (US13, US25)', () => {
  describe('verificarCompra (V(G) = 5)', () => {
    const catalogo = [{ id: 10, nombre: 'Emoliente Clásico', precio: 3.5, disponible: true }]

    test('CB-ORD-R1: Emolientero nulo o inactivo lanza ErrorHttp 404', () => {
      assert.throws(
        () => verificarCompra({ emolientero: null, carrito: [{ productoId: 10, cantidad: 1 }], productos: catalogo }),
        (err) => err.status === 404,
      )
    })

    test('CB-ORD-R2: !emolientero.enJornada lanza ErrorHttp 422', () => {
      assert.throws(
        () =>
          verificarCompra({
            emolientero: { id: 'e1', nombre: 'Don Lucho', enJornada: false },
            carrito: [{ productoId: 10, cantidad: 1 }],
            productos: catalogo,
          }),
        (err) => err.status === 422,
      )
    })

    test('CB-ORD-R3: Producto no existe en el catálogo del emolientero lanza ErrorHttp 422', () => {
      assert.throws(
        () =>
          verificarCompra({
            emolientero: { id: 'e1', nombre: 'Don Lucho', enJornada: true },
            carrito: [{ productoId: 999, cantidad: 1 }],
            productos: catalogo,
          }),
        (err) => err.status === 422,
      )
    })

    test('CB-ORD-R4: !producto.disponible (agotado) lanza ErrorHttp 422', () => {
      assert.throws(
        () =>
          verificarCompra({
            emolientero: { id: 'e1', nombre: 'Don Lucho', enJornada: true },
            carrito: [{ productoId: 10, cantidad: 1 }],
            productos: [{ id: 10, nombre: 'Emoliente Clásico', precio: 3.5, disponible: false }],
          }),
        (err) => err.status === 422,
      )
    })

    test('CB-ORD-R5: Camino nominal -> congela LineaDeOrden con Object.freeze', () => {
      const lineas = verificarCompra({
        emolientero: { id: 'e1', nombre: 'Don Lucho', enJornada: true },
        carrito: [{ productoId: 10, cantidad: 2 }],
        productos: catalogo,
      })

      assert.equal(lineas.length, 1)
      assert.equal(lineas[0].subtotal, 7.0)
      assert.equal(Object.isFrozen(lineas[0]), true)
    })
  })

  describe('verificarDecidible y reputacionTrasDecision (V(G) = 4)', () => {
    test('CB-MOD-R1: Reporte nulo lanza ErrorHttp 404', () => {
      assert.throws(() => verificarDecidible(null), (err) => err.status === 404)
    })

    test('CB-MOD-R2: reporte.estado !== pendiente lanza ErrorHttp 409', () => {
      assert.throws(
        () => verificarDecidible({ id: 1, estado: 'oculto', resenaId: 5 }),
        (err) => err.status === 409,
      )
    })

    test('CB-MOD-R3: reporte.resenaId == null lanza ErrorHttp 410', () => {
      assert.throws(
        () => verificarDecidible({ id: 1, estado: 'pendiente', resenaId: null }),
        (err) => err.status === 410,
      )
    })

    test('CB-MOD-R4: Reporte pendiente válido no lanza error y reputacionTrasDecision respeta piso 0', () => {
      assert.doesNotThrow(() => verificarDecidible({ id: 1, estado: 'pendiente', resenaId: 5 }))
      assert.equal(reputacionTrasDecision(5, 'ocultar'), 0)
      assert.equal(reputacionTrasDecision(80, 'mantener'), 80)
    })
  })
})

// ============================================================================
// 5. RENZO PACHECO (US02, US16, US24)
// ============================================================================

describe('10.2.5 Caja Blanca — Renzo Pacheco (US02, US16, US24)', () => {
  describe('errorCodigoMunicipal (V(G) = 5)', () => {
    const hoy = new Date('2026-06-15T12:00:00.000Z')

    test('CB-EMO-R1: Cadena vacía retorna error de obligatoriedad', () => {
      assert.match(errorCodigoMunicipal('', hoy), /obligatorio/)
    })

    test('CB-EMO-R2: No cumple regex /^MLM-(\\d{4})-(\\d{5})$/ retorna error de formato', () => {
      assert.match(errorCodigoMunicipal('ABC-2025-123', hoy), /MLM-AAAA-NNNNN/)
    })

    test('CB-EMO-R3: Año < 2000 o > añoActual retorna error de rango de año', () => {
      assert.match(errorCodigoMunicipal('MLM-1998-00123', hoy), /entre 2000 y 2026/)
      assert.match(errorCodigoMunicipal('MLM-2027-00123', hoy), /entre 2000 y 2026/)
    })

    test('CB-EMO-R4: Correlativo 00000 retorna error de correlativo inválido', () => {
      assert.match(errorCodigoMunicipal('MLM-2025-00000', hoy), /00000/)
    })

    test('CB-EMO-R5: Código municipal válido retorna null', () => {
      assert.equal(errorCodigoMunicipal('MLM-2026-00104', hoy), null)
    })
  })

  describe('procesarCancelacionOrden y gestionarEstadoUsuario (V(G) = 4)', () => {
    test('CB-CAN-R1: orden.estado !== pagada -> rechaza cancelación', () => {
      const res = procesarCancelacionOrden({
        orden: { id: 'o1', estado: 'entregada', fechaPago: '2026-06-15T10:00:00Z' },
        ahora: '2026-06-15T10:05:00Z',
      })
      assert.equal(res.ok, false)
      assert.equal(res.codigo, 'CANCELACION_NO_PERMITIDA')
    })

    test('CB-CAN-R2: minutosTranscurridos > 30 -> rechaza con TIEMPO_LIMITE_EXCEDIDO', () => {
      const res = procesarCancelacionOrden({
        orden: { id: 'o2', estado: 'pagada', fechaPago: '2026-06-15T10:00:00Z' },
        ahora: '2026-06-15T10:35:00Z',
      })
      assert.equal(res.ok, false)
      assert.equal(res.codigo, 'TIEMPO_LIMITE_EXCEDIDO')
    })

    test('CB-CAN-R3: minutosTranscurridos <= 30 -> cancela orden, repone stock y valida suspensión US24', () => {
      const res = procesarCancelacionOrden({
        orden: {
          id: 'o3',
          estado: 'pagada',
          total: 7.0,
          fechaPago: '2026-06-15T10:00:00Z',
          items: [{ productoId: 'p1', cantidad: 2 }],
        },
        ahora: '2026-06-15T10:20:00Z',
        stockActual: { p1: 5 },
      })
      assert.equal(res.ok, true)
      assert.equal(res.stockActualizado.p1, 7)

      const suspBloqueada = gestionarEstadoUsuario({
        usuario: { id: 'e1', rol: 'emolientero', estado: 'activo' },
        accion: 'suspender',
        motivo: 'Inspección municipal',
        ordenesPendientesEntrega: 1,
      })
      assert.equal(suspBloqueada.ok, false)
      assert.equal(suspBloqueada.codigo, 'EMOLIENTERO_CON_ORDENES_PENDIENTES')
    })
  })
})
