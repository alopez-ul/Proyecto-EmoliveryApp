import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import {
  // 1. Rodrigo: US01 & US06
  validarRegistroCliente,
  evaluarAperturaJornada,
  evaluarCierreJornada,
  // 2. Matías: US03 & US04
  hashContrasena,
  verificarContrasena,
  firmarSesion,
  verificarSesion,
  validarPassword,
  nuevoTokenRecuperacion,
  hashToken,
  evaluarAccesoCuenta,
  validarEnlaceRecuperacion,
  // 3. Antony: US23
  VerificacionService,
  // 4. Fabio: US20 & US17
  calcularResumenHistorial,
  validarYPublicarResena,
  // 5. Renzo: US16, US19 & US24
  procesarCancelacionOrden,
  publicarRespuestaEmolientero,
  filtrarUsuariosRegistrados,
  gestionarEstadoUsuario,
} from '../src/reglasComplementarias.js'

// ============================================================================
// 1. JORGE RODRIGO BURGA — US01 (Registro de cliente) y US06 (Jornada)
// ============================================================================

describe('Jorge Rodrigo Burga — US01 (Registro de cliente) y US06 (Apertura y cierre de jornada)', () => {
  describe('US01: validarRegistroCliente()', () => {
    test('CP-US01-01: acepta registro con nombre válido (3-100 chars), celular peruano /^9\\d{8}$/ y correo válido', () => {
      const { datos, errores } = validarRegistroCliente({
        nombre: '  Jorge   Rodrigo Burga  ',
        telefono: '987-654-321',
        correo: 'Rodrigo.Burga@alu.ulima.edu.pe ',
      })

      assert.deepEqual(errores, {})
      assert.equal(datos.nombre, 'Jorge Rodrigo Burga')
      assert.equal(datos.telefono, '987654321')
      assert.equal(datos.correo, 'rodrigo.burga@alu.ulima.edu.pe')
    })

    test('CP-US01-02: rechaza celular inválido (no inicia con 9 o no tiene 9 dígitos), correo mal formado o nombre corto', () => {
      const resultado = validarRegistroCliente({
        nombre: 'Jo',
        telefono: '812345678',
        correo: 'correo-sin-arroba.com',
      })

      assert.ok(resultado.errores.nombre)
      assert.ok(resultado.errores.telefono)
      assert.ok(resultado.errores.correo)

      const celularCorto = validarRegistroCliente({
        nombre: 'Cliente Valido',
        telefono: '91234',
        correo: 'cliente@ulima.edu.pe',
      })
      assert.ok(celularCorto.errores.telefono)
    })
  })

  describe('US06: evaluarAperturaJornada() y evaluarCierreJornada() (T26, T27)', () => {
    test('CP-US06-01: permite abrir jornada cuando tiene ubicación GPS registrada en La Molina (estado -> abierta)', () => {
      const res = evaluarAperturaJornada({
        emolientero: { id: 'emo-01', estadoCuenta: 'activo' },
        ubicacionGps: { latitud: -12.0851, longitud: -76.9482, zona: 'La Fontana' },
      })

      assert.equal(res.ok, true)
      assert.equal(res.estadoJornada, 'abierta')
      assert.equal(res.ubicacionRegistrada.zona, 'La Fontana')
    })

    test('CP-US06-02: bloquea la apertura de jornada cuando NO tiene ubicación GPS registrada (T26)', () => {
      const res = evaluarAperturaJornada({
        emolientero: { id: 'emo-01', estadoCuenta: 'activo' },
        ubicacionGps: null,
      })

      assert.equal(res.ok, false)
      assert.equal(res.codigo, 'SIN_UBICACION_GPS')
    })

    test('CP-US06-03: bloquea el cierre cuando existen órdenes pagadas pendientes de entrega y permite cerrar con 0 pendientes (T27)', () => {
      const bloqueado = evaluarCierreJornada({
        estadoActual: 'abierta',
        ordenesPendientes: 2,
      })
      assert.equal(bloqueado.ok, false)
      assert.equal(bloqueado.codigo, 'ORDENES_PENDIENTES_ENTREGA')
      assert.equal(bloqueado.ordenesPendientes, 2)

      const exitoso = evaluarCierreJornada({
        estadoActual: 'abierta',
        ordenesPendientes: 0,
      })
      assert.equal(exitoso.ok, true)
      assert.equal(exitoso.estadoJornada, 'cerrada')
    })
  })
})

// ============================================================================
// 2. MATÍAS SAN MIGUEL — US03 (Inicio de sesión) y US04 (Recuperación)
// ============================================================================

describe('Matías San Miguel — US03 (Inicio de sesión) y US04 (Recuperación de contraseña)', () => {
  describe('US03: hashContrasena(), verificarContrasena(), firmarSesion(), verificarSesion(), validarPassword() y RNF14', () => {
    test('CP-US03-01: genera hash scrypt con sal aleatoria, verifica contraseña correcta y rechaza incorrecta', async () => {
      const hash = await hashContrasena('Emoliente2026')
      assert.match(hash, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/)

      const esValida = await verificarContrasena('Emoliente2026', hash)
      const esInvalida = await verificarContrasena('OtraClave999', hash)

      assert.equal(esValida, true)
      assert.equal(esInvalida, false)
    })

    test('CP-US03-02: emite y verifica token JWT (HS256) con subject id y rol, y valida reglas de validarPassword()', () => {
      const token = firmarSesion({
        id: 'usr-100',
        nombre: 'Matías San Miguel',
        correo: 'matias@ulima.edu.pe',
        rol: 'cliente',
      })

      const payload = verificarSesion(token)
      assert.equal(payload.sub, 'usr-100')
      assert.equal(payload.rol, 'cliente')
      assert.equal(payload.correo, 'matias@ulima.edu.pe')

      assert.equal(validarPassword('Segura123'), null)
      assert.ok(validarPassword('corta1'))
      assert.ok(validarPassword('sololetras'))
      assert.ok(validarPassword('12345678'))
    })

    test('CP-US03-03: bloquea el inicio de sesión para cuenta suspendida o rechazada (RNF14)', () => {
      const suspendida = evaluarAccesoCuenta({ id: 'u1', estado: 'suspendida' })
      assert.equal(suspendida.permitido, false)
      assert.equal(suspendida.codigo, 'CUENTA_SUSPENDIDA')

      const rechazada = evaluarAccesoCuenta({ id: 'u2', estado: 'rechazada' })
      assert.equal(rechazada.permitido, false)
      assert.equal(rechazada.codigo, 'CUENTA_RECHAZADA')

      const activa = evaluarAccesoCuenta({ id: 'u3', estado: 'activo' })
      assert.equal(activa.permitido, true)
    })
  })

  describe('US04: nuevoTokenRecuperacion(), hashToken() y vigencia de enlace (T15, T17)', () => {
    test('CP-US04-01: genera token único con hash SHA-256 determinista', () => {
      const t1 = nuevoTokenRecuperacion()
      const t2 = nuevoTokenRecuperacion()

      assert.notEqual(t1.token, t2.token)
      assert.equal(t1.tokenHash, hashToken(t1.token))
      assert.equal(t1.tokenHash.length, 64)
    })

    test('CP-US04-02: acepta enlace vigente (<= 15 min) y rechaza enlace vencido o ya utilizado (T15, T17)', () => {
      const { token, tokenHash } = nuevoTokenRecuperacion()
      const creadoEn = new Date('2026-06-15T10:00:00.000Z')

      const vigente = validarEnlaceRecuperacion({
        tokenRecibido: token,
        registroToken: { tokenHash, creadoEn, usado: false },
        ahora: new Date('2026-06-15T10:10:00.000Z'),
        vigenciaMaxMinutos: 15,
      })
      assert.equal(vigente.ok, true)

      const vencido = validarEnlaceRecuperacion({
        tokenRecibido: token,
        registroToken: { tokenHash, creadoEn, usado: false },
        ahora: new Date('2026-06-15T10:25:00.000Z'),
        vigenciaMaxMinutos: 15,
      })
      assert.equal(vencido.ok, false)
      assert.equal(vencido.codigo, 'ENLACE_VENCIDO')

      const yaUsado = validarEnlaceRecuperacion({
        tokenRecibido: token,
        registroToken: { tokenHash, creadoEn, usado: true },
        ahora: new Date('2026-06-15T10:05:00.000Z'),
        vigenciaMaxMinutos: 15,
      })
      assert.equal(yaUsado.ok, false)
      assert.equal(yaUsado.codigo, 'TOKEN_YA_UTILIZADO')
    })
  })
})

// ============================================================================
// 3. ANTONY LÓPEZ — US23 (Verificación municipal de emolienteros)
// ============================================================================

describe('Antony López — US23 (Verificación municipal de emolienteros: T29, T30, T32)', () => {
  const service = new VerificacionService()

  test('CP-US23-01: aprueba emolientero en estado pendiente_verificacion con código municipal válido -> pasa a activo / verificado', () => {
    const res = service.procesarDecision({
      emolientero: {
        id: 'emo-10',
        nombre: 'Don Lucho',
        estado: 'pendiente_verificacion',
        codigoMunicipal: 'LM-202601',
      },
      decision: 'aprobar',
    })

    assert.equal(res.ok, true)
    assert.equal(res.nuevoEstado, 'activo')
    assert.equal(res.verificado, true)
    assert.equal(res.codigoMunicipal, 'LM-202601')
  })

  test('CP-US23-02: rechaza solicitud con motivo obligatorio (10-500 caracteres) -> pasa a rechazado', () => {
    const res = service.procesarDecision({
      emolientero: {
        id: 'emo-11',
        estado: 'pendiente_verificacion',
        codigoMunicipal: 'LM-1020',
      },
      decision: 'rechazar',
      motivo: 'El carné de sanidad adjunto se encuentra vencido desde marzo.',
    })

    assert.equal(res.ok, true)
    assert.equal(res.nuevoEstado, 'rechazado')
    assert.equal(res.verificado, false)
  })

  test('CP-US23-03: bloquea el rechazo si el motivo está vacío/corto o si la cuenta ya fue verificada antes (T29, T30, T32)', () => {
    const sinMotivo = service.procesarDecision({
      emolientero: { id: 'emo-12', estado: 'pendiente_verificacion', codigoMunicipal: 'LM-1020' },
      decision: 'rechazar',
      motivo: '   ',
    })
    assert.equal(sinMotivo.ok, false)
    assert.equal(sinMotivo.codigo, 'MOTIVO_RECHAZO_INVALIDO')

    const yaVerificado = service.procesarDecision({
      emolientero: { id: 'emo-13', estado: 'activo', codigoMunicipal: 'LM-1020' },
      decision: 'aprobar',
    })
    assert.equal(yaVerificado.ok, false)
    assert.equal(yaVerificado.codigo, 'CUENTA_YA_VERIFICADA')
  })
})

// ============================================================================
// 4. FABIO MENDOZA — US20 (Historial de compras) y US17 (Publicar reseña)
// ============================================================================

describe('Fabio Mendoza — US20 (Historial de compras) y US17 (Publicar reseña)', () => {
  describe('US20: calcularResumenHistorial() (T76, T77, T78)', () => {
    const comprasMock = [
      { id: 'ord-1', fecha: '2026-05-02T08:00:00Z', total: 8.5 },
      { id: 'ord-2', fecha: '2026-05-10T09:30:00Z', total: 12.0 },
      { id: 'ord-3', fecha: '2026-05-20T18:15:00Z', total: 6.5 },
    ]

    test('CP-US20-01: calcula conteo total de compras, monto acumulado exacto en soles y filtra por rango [fechaDesde, fechaHasta]', () => {
      const total = calcularResumenHistorial(comprasMock)
      assert.equal(total.vacio, false)
      assert.equal(total.totalCompras, 3)
      assert.equal(total.montoAcumulado, 27.0)

      const filtrado = calcularResumenHistorial(comprasMock, {
        fechaDesde: '2026-05-05T00:00:00Z',
        fechaHasta: '2026-05-15T23:59:59Z',
      })
      assert.equal(filtrado.totalCompras, 1)
      assert.equal(filtrado.montoAcumulado, 12.0)
      assert.equal(filtrado.compras[0].id, 'ord-2')
    })

    test('CP-US20-02: devuelve "No se encontraron compras en este periodo" cuando la lista o el filtro queda vacío (T78)', () => {
      const vacio = calcularResumenHistorial(comprasMock, {
        fechaDesde: '2026-06-01T00:00:00Z',
        fechaHasta: '2026-06-30T23:59:59Z',
      })
      assert.equal(vacio.vacio, true)
      assert.equal(vacio.totalCompras, 0)
      assert.equal(vacio.montoAcumulado, 0)
      assert.equal(vacio.mensaje, 'No se encontraron compras en este periodo')
    })
  })

  describe('US17: validarYPublicarResena() (T84, T85, T86)', () => {
    test('CP-US17-01: acepta calificación de 1 a 5 estrellas y comentario no vacío en orden entregada, recalculando promedio (T84, T85)', () => {
      const res = validarYPublicarResena({
        orden: { id: 'ord-50', clienteId: 'cli-1', emolienteroId: 'emo-1', estado: 'entregada', resenada: false },
        clienteId: 'cli-1',
        calificacion: 5,
        comentario: 'Excelente emoliente frutado y atención puntual en La Fontana.',
        resenasExistentes: [
          { ordenId: 'ord-10', calificacion: 4 },
          { ordenId: 'ord-11', calificacion: 3 },
        ],
      })

      assert.equal(res.ok, true)
      assert.equal(res.nuevoPromedio, 4) // (4 + 3 + 5) / 3 = 4
      assert.equal(res.totalResenas, 3)
    })

    test('CP-US17-02: rechaza si la orden no está entregada, si es reseña duplicada o si el comentario está vacío (T86)', () => {
      const noEntregada = validarYPublicarResena({
        orden: { id: 'ord-51', clienteId: 'cli-1', estado: 'pagada' },
        clienteId: 'cli-1',
        calificacion: 5,
        comentario: 'Muy rico',
      })
      assert.equal(noEntregada.ok, false)
      assert.equal(noEntregada.codigo, 'ORDEN_NO_ENTREGADA')

      const duplicada = validarYPublicarResena({
        orden: { id: 'ord-52', clienteId: 'cli-1', estado: 'entregada' },
        clienteId: 'cli-1',
        calificacion: 4,
        comentario: 'Buen servicio',
        resenasExistentes: [{ ordenId: 'ord-52', calificacion: 5 }],
      })
      assert.equal(duplicada.ok, false)
      assert.equal(duplicada.codigo, 'RESENA_DUPLICADA')

      const comentarioVacio = validarYPublicarResena({
        orden: { id: 'ord-53', clienteId: 'cli-1', estado: 'entregada' },
        clienteId: 'cli-1',
        calificacion: 4,
        comentario: '   ',
      })
      assert.equal(comentarioVacio.ok, false)
      assert.equal(comentarioVacio.codigo, 'COMENTARIO_INVALIDO')
    })
  })
})

// ============================================================================
// 5. RENZO PACHECO — US16 (Cancelación), US19 (Respuesta) y US24 (Usuarios)
// ============================================================================

describe('Renzo Pacheco — US16 (Cancelación), US19 (Respuesta del emolientero) y US24 (Gestión de usuarios)', () => {
  describe('US16: procesarCancelacionOrden() (T72, T73, T74, T75)', () => {
    test('CP-US16-01: acepta cancelar orden pagada no entregada cuando han transcurrido <= 30 min (anula, libera stock y registra devolución)', () => {
      const res = procesarCancelacionOrden({
        orden: {
          id: 'ord-100',
          estado: 'pagada',
          total: 11.5,
          fechaPago: '2026-06-10T08:00:00.000Z',
          items: [{ productoId: 'prod-emoliente', cantidad: 2 }],
        },
        ahora: '2026-06-10T08:20:00.000Z', // 20 minutos después
        stockActual: { 'prod-emoliente': 10 },
      })

      assert.equal(res.ok, true)
      assert.equal(res.ordenActualizada.estado, 'cancelada')
      assert.equal(res.stockActualizado['prod-emoliente'], 12)
      assert.equal(res.devolucion.montoDevuelto, 11.5)
    })

    test('CP-US16-02: rechaza con "La compra ya no puede cancelarse" si pasaron > 30 minutos (ej. 31 min) o si ya figura como entregada (T75)', () => {
      const fueraDeTiempo = procesarCancelacionOrden({
        orden: {
          id: 'ord-101',
          estado: 'pagada',
          total: 9.0,
          fechaPago: '2026-06-10T08:00:00.000Z',
          items: [],
        },
        ahora: '2026-06-10T08:31:00.000Z', // 31 minutos
      })
      assert.equal(fueraDeTiempo.ok, false)
      assert.equal(fueraDeTiempo.error, 'La compra ya no puede cancelarse')

      const yaEntregada = procesarCancelacionOrden({
        orden: {
          id: 'ord-102',
          estado: 'entregada',
          total: 9.0,
          fechaPago: '2026-06-10T08:00:00.000Z',
          items: [],
        },
        ahora: '2026-06-10T08:05:00.000Z',
      })
      assert.equal(yaEntregada.ok, false)
      assert.equal(yaEntregada.error, 'La compra ya no puede cancelarse')
    })
  })

  describe('US19: publicarRespuestaEmolientero() (T90, T91, T92)', () => {
    test('CP-US19-01: vincula la respuesta del emolientero cuando la reseña está activa y no tiene respuesta previa (T90)', () => {
      const res = publicarRespuestaEmolientero({
        resena: { id: 'res-1', emolienteroId: 'emo-1', estado: 'activa', respuesta: null },
        emolienteroId: 'emo-1',
        textoRespuesta: '¡Muchas gracias por tu visita! Te esperamos mañana en Camacho.',
      })

      assert.equal(res.ok, true)
      assert.equal(
        res.resenaActualizada.respuesta.texto,
        '¡Muchas gracias por tu visita! Te esperamos mañana en Camacho.'
      )
    })

    test('CP-US19-02: bloquea la acción si la reseña ya tiene respuesta previa (duplicada) o si fue ocultada por moderación (T91, T92)', () => {
      const duplicada = publicarRespuestaEmolientero({
        resena: {
          id: 'res-2',
          emolienteroId: 'emo-1',
          estado: 'activa',
          respuesta: { texto: 'Gracias por venir' },
        },
        emolienteroId: 'emo-1',
        textoRespuesta: 'Segunda respuesta no permitida',
      })
      assert.equal(duplicada.ok, false)
      assert.equal(duplicada.codigo, 'RESPUESTA_DUPLICADA')

      const oculta = publicarRespuestaEmolientero({
        resena: { id: 'res-3', emolienteroId: 'emo-1', estado: 'oculta', respuesta: null },
        emolienteroId: 'emo-1',
        textoRespuesta: 'Intentando responder reseña oculta',
      })
      assert.equal(oculta.ok, false)
      assert.equal(oculta.codigo, 'RESENA_OCULTA_MODERACION')
    })
  })

  describe('US24: filtrarUsuariosRegistrados() y gestionarEstadoUsuario() (T100, T101, T102, T103)', () => {
    const usuariosMock = [
      { id: 'u1', rol: 'cliente', estado: 'activo' },
      { id: 'u2', rol: 'emolientero', estado: 'activo' },
      { id: 'u3', rol: 'emolientero', estado: 'suspendido' },
    ]

    test('CP-US24-01: filtra usuarios por rol/estado, calcula totales por categoría y suspende/reactiva con motivo obligatorio (T100-T102)', () => {
      const filtro = filtrarUsuariosRegistrados(usuariosMock, { rol: 'emolientero', estado: 'activo' })
      assert.equal(filtro.usuarios.length, 1)
      assert.equal(filtro.usuarios[0].id, 'u2')
      assert.deepEqual(filtro.totales, {
        total: 3,
        clientes: 1,
        emolienteros: 2,
        activos: 2,
        suspendidos: 1,
      })

      const suspension = gestionarEstadoUsuario({
        usuario: usuariosMock[1],
        accion: 'suspender',
        motivo: 'Incumplimiento reiterado de horario municipal.',
        ordenesPendientesEntrega: 0,
      })
      assert.equal(suspension.ok, true)
      assert.equal(suspension.usuarioActualizado.estado, 'suspendido')

      const reactivacion = gestionarEstadoUsuario({
        usuario: usuariosMock[2],
        accion: 'reactivar',
        motivo: 'Descargos aprobados por fiscalización.',
      })
      assert.equal(reactivacion.ok, true)
      assert.equal(reactivacion.usuarioActualizado.estado, 'activo')
    })

    test('CP-US24-02: bloquea la suspensión de un emolientero cuando tiene órdenes pagadas pendientes de entrega (T103)', () => {
      const bloqueado = gestionarEstadoUsuario({
        usuario: { id: 'u2', rol: 'emolientero', estado: 'activo' },
        accion: 'suspender',
        motivo: 'Reporte de inspección municipal',
        ordenesPendientesEntrega: 3,
      })

      assert.equal(bloqueado.ok, false)
      assert.equal(bloqueado.codigo, 'EMOLIENTERO_CON_ORDENES_PENDIENTES')
    })
  })
})
