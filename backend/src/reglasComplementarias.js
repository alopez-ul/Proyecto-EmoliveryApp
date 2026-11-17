// Reglas de dominio puras complementarias para respaldar el 100% de las 25 Historias de Usuario
// sin depender de conexión activa a PostgreSQL (Neon) ni modificar archivos de otros integrantes.

process.env.JWT_SECRET ||= 'clave-secreta-pruebas-unitarias-emolivery-ulima-2026-segura'

import { validarRegistroCliente } from './validaciones/cliente.js'

const {
  hashContrasena,
  verificarContrasena,
  firmarSesion,
  verificarSesion,
  nuevoTokenRecuperacion,
  hashToken,
  validarPassword,
  VIGENCIA_ENLACE_MIN,
} = await import('./seguridad.js')

export {
  validarRegistroCliente,
  hashContrasena,
  verificarContrasena,
  firmarSesion,
  verificarSesion,
  nuevoTokenRecuperacion,
  hashToken,
  validarPassword,
  VIGENCIA_ENLACE_MIN,
}

// ============================================================================
// 1. JORGE RODRIGO BURGA — US06 (Apertura y cierre de jornada: T26, T27)
// ============================================================================

/**
 * Evalúa si un emolientero puede abrir su jornada diaria (US06 - T26).
 * Requiere cuenta activa/verificada y ubicación GPS registrada en La Molina.
 */
export function evaluarAperturaJornada({ emolientero, ubicacionGps } = {}) {
  if (!emolientero || emolientero.estadoCuenta === 'suspendida' || emolientero.estadoCuenta === 'rechazada') {
    return {
      ok: false,
      codigo: 'CUENTA_NO_HABILITADA',
      error: 'La cuenta del emolientero no está habilitada para abrir jornada.',
    }
  }

  const tieneCoordenadas =
    ubicacionGps &&
    typeof ubicacionGps.latitud === 'number' &&
    !Number.isNaN(ubicacionGps.latitud) &&
    typeof ubicacionGps.longitud === 'number' &&
    !Number.isNaN(ubicacionGps.longitud)

  if (!tieneCoordenadas) {
    return {
      ok: false,
      codigo: 'SIN_UBICACION_GPS',
      error: 'Debe registrar su ubicación GPS actual antes de abrir la jornada.',
    }
  }

  return {
    ok: true,
    estadoJornada: 'abierta',
    ubicacionRegistrada: {
      latitud: ubicacionGps.latitud,
      longitud: ubicacionGps.longitud,
      zona: ubicacionGps.zona || 'La Molina',
    },
    fechaApertura: new Date().toISOString(),
  }
}

/**
 * Evalúa si un emolientero puede cerrar su jornada diaria (US06 - T27).
 * Bloquea el cierre si existen órdenes pagadas pendientes de entrega.
 */
export function evaluarCierreJornada({ estadoActual = 'abierta', ordenesPendientes = 0 } = {}) {
  if (estadoActual !== 'abierta') {
    return {
      ok: false,
      codigo: 'JORNADA_NO_ABIERTA',
      error: 'No hay una jornada abierta actualmente para cerrar.',
    }
  }

  const pendientes = Number(ordenesPendientes) || 0
  if (pendientes > 0) {
    return {
      ok: false,
      codigo: 'ORDENES_PENDIENTES_ENTREGA',
      error: `No puede cerrar la jornada porque tiene ${pendientes} orden(es) pagada(s) pendiente(s) de entrega.`,
      ordenesPendientes: pendientes,
    }
  }

  return {
    ok: true,
    estadoJornada: 'cerrada',
    ordenesPendientes: 0,
    fechaCierre: new Date().toISOString(),
  }
}

// ============================================================================
// 2. MATÍAS SAN MIGUEL — US03 (Login RNF14) y US04 (Vigencia enlace T15, T17)
// ============================================================================

/**
 * Verifica que el estado de la cuenta permita iniciar sesión (US03 - RNF14).
 */
export function evaluarAccesoCuenta(usuario) {
  if (!usuario) {
    return { permitido: false, codigo: 'CREDENCIALES_INVALIDAS', error: 'Correo o contraseña incorrectos.' }
  }
  const estado = String(usuario.estado || '').toLowerCase()
  if (estado === 'suspendida' || estado === 'suspendido') {
    return {
      permitido: false,
      codigo: 'CUENTA_SUSPENDIDA',
      error: 'Tu cuenta ha sido suspendida. Comunícate con soporte municipal.',
    }
  }
  if (estado === 'rechazada' || estado === 'rechazado') {
    return {
      permitido: false,
      codigo: 'CUENTA_RECHAZADA',
      error: 'Tu solicitud de registro fue rechazada en la verificación municipal.',
    }
  }
  return { permitido: true, estado }
}

/**
 * Valida la vigencia (15-30 min) y uso único de un enlace de recuperación (US04 - T15, T17).
 */
export function validarEnlaceRecuperacion({
  tokenRecibido,
  registroToken,
  ahora = new Date(),
  vigenciaMaxMinutos = VIGENCIA_ENLACE_MIN,
} = {}) {
  if (!tokenRecibido || !registroToken) {
    return { ok: false, codigo: 'TOKEN_INVALIDO', error: 'El enlace de recuperación no es válido.' }
  }

  if (registroToken.usado) {
    return { ok: false, codigo: 'TOKEN_YA_UTILIZADO', error: 'Este enlace de recuperación ya fue utilizado.' }
  }

  const hashCalculado = hashToken(tokenRecibido)
  if (hashCalculado !== registroToken.tokenHash) {
    return { ok: false, codigo: 'TOKEN_NO_COINCIDE', error: 'El token proporcionado no coincide.' }
  }

  const fechaCreacion = new Date(registroToken.creadoEn)
  const fechaActual = new Date(ahora)
  const minutosTranscurridos = (fechaActual.getTime() - fechaCreacion.getTime()) / (1000 * 60)

  if (minutosTranscurridos > vigenciaMaxMinutos) {
    return {
      ok: false,
      codigo: 'ENLACE_VENCIDO',
      error: 'El enlace de recuperación ha expirado. Solicita uno nuevo.',
    }
  }

  return {
    ok: true,
    minutosTranscurridos: Math.round(minutosTranscurridos * 100) / 100,
  }
}

// ============================================================================
// 3. ANTONY LÓPEZ — US23 (Verificación municipal de emolienteros: T29, T30, T32)
// ============================================================================

const REGEX_CODIGO_MUNICIPAL = /^LM-\d{4,6}$/i

export class VerificacionService {
  /**
   * Procesa la decisión municipal (aprobar o rechazar) sobre un emolientero (US23).
   */
  procesarDecision({ emolientero, decision, motivo = '' } = {}) {
    if (!emolientero) {
      return { ok: false, codigo: 'EMOLIENTERO_NO_ENCONTRADO', error: 'El emolientero no existe.' }
    }

    if (emolientero.estado === 'activo' || emolientero.estado === 'verificado') {
      return {
        ok: false,
        codigo: 'CUENTA_YA_VERIFICADA',
        error: 'La cuenta del emolientero ya fue verificada previamente.',
      }
    }

    if (emolientero.estado !== 'pendiente_verificacion') {
      return {
        ok: false,
        codigo: 'ESTADO_NO_PENDIENTE',
        error: `No se puede verificar una cuenta en estado '${emolientero.estado}'.`,
      }
    }

    if (decision === 'aprobar') {
      const codigo = String(emolientero.codigoMunicipal || '').trim()
      if (!REGEX_CODIGO_MUNICIPAL.test(codigo)) {
        return {
          ok: false,
          codigo: 'CODIGO_MUNICIPAL_INVALIDO',
          error: 'El código de autorización municipal de La Molina es inválido.',
        }
      }

      return {
        ok: true,
        estadoAnterior: emolientero.estado,
        nuevoEstado: 'activo',
        verificado: true,
        codigoMunicipal: codigo.toUpperCase(),
        fechaVerificacion: new Date().toISOString(),
      }
    }

    if (decision === 'rechazar') {
      const motivoLimpio = String(motivo || '').trim()
      if (motivoLimpio.length < 10 || motivoLimpio.length > 500) {
        return {
          ok: false,
          codigo: 'MOTIVO_RECHAZO_INVALIDO',
          error: 'Debe ingresar un motivo de rechazo obligatorio entre 10 y 500 caracteres.',
        }
      }

      return {
        ok: true,
        estadoAnterior: emolientero.estado,
        nuevoEstado: 'rechazado',
        verificado: false,
        motivoRechazo: motivoLimpio,
        fechaVerificacion: new Date().toISOString(),
      }
    }

    return {
      ok: false,
      codigo: 'DECISION_DESCONOCIDA',
      error: "La decisión debe ser 'aprobar' o 'rechazar'.",
    }
  }
}

// ============================================================================
// 4. FABIO MENDOZA — US20 (Historial de compras: T76-T78) y US17 (Reseña: T84-T86)
// ============================================================================

/**
 * Filtra el historial de compras del cliente por rango de fechas y calcula totales (US20 - T76, T77, T78).
 */
export function calcularResumenHistorial(compras = [], { fechaDesde = null, fechaHasta = null } = {}) {
  const lista = Array.isArray(compras) ? compras : []

  const filtradas = lista.filter((compra) => {
    const fechaCompra = new Date(compra.fecha).getTime()
    if (Number.isNaN(fechaCompra)) return false
    if (fechaDesde) {
      const desde = new Date(fechaDesde).getTime()
      if (fechaCompra < desde) return false
    }
    if (fechaHasta) {
      const hasta = new Date(fechaHasta).getTime()
      if (fechaCompra > hasta) return false
    }
    return true
  })

  if (filtradas.length === 0) {
    return {
      vacio: true,
      mensaje: 'No se encontraron compras en este periodo',
      totalCompras: 0,
      montoAcumulado: 0,
      compras: [],
    }
  }

  const montoAcumulado =
    Math.round(
      filtradas.reduce((acc, item) => acc + (Number(item.total) || 0), 0) * 100
    ) / 100

  return {
    vacio: false,
    mensaje: null,
    totalCompras: filtradas.length,
    montoAcumulado,
    compras: filtradas,
  }
}

/**
 * Valida y publica una reseña de cliente sobre una orden entregada, recalculando el promedio (US17 - T84, T85, T86).
 */
export function validarYPublicarResena({
  orden,
  clienteId,
  calificacion,
  comentario,
  resenasExistentes = [],
} = {}) {
  if (!orden || orden.clienteId !== clienteId) {
    return {
      ok: false,
      codigo: 'SIN_COMPRA_VERIFICADA',
      error: 'Solo puedes publicar una reseña sobre una compra propia verificada.',
    }
  }

  if (orden.estado !== 'entregada') {
    return {
      ok: false,
      codigo: 'ORDEN_NO_ENTREGADA',
      error: 'Solo puedes calificar pedidos que ya hayan sido entregados.',
    }
  }

  const yaResenada =
    orden.resenada === true ||
    resenasExistentes.some((r) => r.ordenId === orden.id)

  if (yaResenada) {
    return {
      ok: false,
      codigo: 'RESENA_DUPLICADA',
      error: 'Ya has publicado una reseña para esta orden de compra.',
    }
  }

  const estrellas = Number(calificacion)
  if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) {
    return {
      ok: false,
      codigo: 'CALIFICACION_INVALIDA',
      error: 'La calificación debe ser un número entero entre 1 y 5 estrellas.',
    }
  }

  const textoComentario = String(comentario || '').trim()
  if (textoComentario.length === 0 || textoComentario.length > 500) {
    return {
      ok: false,
      codigo: 'COMENTARIO_INVALIDO',
      error: 'El comentario de la reseña es obligatorio y no debe superar 500 caracteres.',
    }
  }

  const nuevaResena = {
    id: `res-${orden.id}`,
    ordenId: orden.id,
    clienteId,
    emolienteroId: orden.emolienteroId,
    calificacion: estrellas,
    comentario: textoComentario,
    estado: 'activa',
    respuesta: null,
    fecha: new Date().toISOString(),
  }

  const todas = [...resenasExistentes, nuevaResena]
  const suma = todas.reduce((acc, r) => acc + Number(r.calificacion), 0)
  const nuevoPromedio = Math.round((suma / todas.length) * 100) / 100

  return {
    ok: true,
    resena: nuevaResena,
    nuevoPromedio,
    totalResenas: todas.length,
  }
}

// ============================================================================
// 5. RENZO PACHECO — US16 (Cancelación: T72-T75), US19 (Respuesta: T90-T92)
//                    y US24 (Gestión de usuarios registrados: T100-T103)
// ============================================================================

export const LIMITE_CANCELACION_MINUTOS = 30

/**
 * Procesa la cancelación de una compra anticipada dentro de los 30 minutos (US16 - T72, T73, T74, T75).
 */
export function procesarCancelacionOrden({
  orden,
  ahora = new Date(),
  stockActual = {},
} = {}) {
  if (!orden) {
    return { ok: false, codigo: 'ORDEN_NO_ENCONTRADA', error: 'La orden no existe.' }
  }

  if (orden.estado === 'entregada' || orden.estado !== 'pagada') {
    return {
      ok: false,
      codigo: 'CANCELACION_NO_PERMITIDA',
      error: 'La compra ya no puede cancelarse',
    }
  }

  const fechaPago = new Date(orden.fechaPago).getTime()
  const fechaActual = new Date(ahora).getTime()
  const minutosTranscurridos = (fechaActual - fechaPago) / (1000 * 60)

  if (minutosTranscurridos > LIMITE_CANCELACION_MINUTOS) {
    return {
      ok: false,
      codigo: 'TIEMPO_LIMITE_EXCEDIDO',
      error: 'La compra ya no puede cancelarse',
      minutosTranscurridos: Math.round(minutosTranscurridos),
    }
  }

  // Reponer disponibilidad de productos
  const stockActualizado = { ...stockActual }
  for (const item of orden.items || []) {
    const actual = Number(stockActualizado[item.productoId]) || 0
    stockActualizado[item.productoId] = actual + (Number(item.cantidad) || 0)
  }

  return {
    ok: true,
    ordenActualizada: {
      ...orden,
      estado: 'cancelada',
      fechaCancelacion: new Date(ahora).toISOString(),
    },
    stockActualizado,
    devolucion: {
      ordenId: orden.id,
      montoDevuelto: orden.total,
      estado: 'pendiente_reembolso',
    },
  }
}

/**
 * Permite al emolientero publicar una única respuesta sobre una reseña activa (US19 - T90, T91, T92).
 */
export function publicarRespuestaEmolientero({
  resena,
  emolienteroId,
  textoRespuesta,
} = {}) {
  if (!resena) {
    return { ok: false, codigo: 'RESENA_NO_ENCONTRADA', error: 'La reseña no existe.' }
  }

  if (resena.emolienteroId && resena.emolienteroId !== emolienteroId) {
    return {
      ok: false,
      codigo: 'NO_AUTORIZADO',
      error: 'Solo el emolientero destinatario puede responder esta reseña.',
    }
  }

  if (resena.estado === 'oculta' || resena.oculta === true) {
    return {
      ok: false,
      codigo: 'RESENA_OCULTA_MODERACION',
      error: 'No se puede responder a una reseña que fue ocultada por moderación.',
    }
  }

  if (resena.respuesta) {
    return {
      ok: false,
      codigo: 'RESPUESTA_DUPLICADA',
      error: 'Esta reseña ya cuenta con una respuesta registrada.',
    }
  }

  const respuestaLimpia = String(textoRespuesta || '').trim()
  if (respuestaLimpia.length < 3 || respuestaLimpia.length > 500) {
    return {
      ok: false,
      codigo: 'RESPUESTA_INVALIDA',
      error: 'La respuesta debe tener entre 3 y 500 caracteres.',
    }
  }

  return {
    ok: true,
    resenaActualizada: {
      ...resena,
      respuesta: {
        texto: respuestaLimpia,
        emolienteroId,
        fechaRespuesta: new Date().toISOString(),
      },
    },
  }
}

/**
 * Filtra usuarios registrados por rol y estado y calcula totales por categoría (US24 - T100, T101).
 */
export function filtrarUsuariosRegistrados(usuarios = [], { rol = null, estado = null } = {}) {
  const lista = Array.isArray(usuarios) ? usuarios : []

  const totales = {
    total: lista.length,
    clientes: lista.filter((u) => u.rol === 'cliente').length,
    emolienteros: lista.filter((u) => u.rol === 'emolientero').length,
    activos: lista.filter((u) => u.estado === 'activo').length,
    suspendidos: lista.filter((u) => u.estado === 'suspendido' || u.estado === 'suspendida').length,
  }

  const filtrados = lista.filter((u) => {
    if (rol && u.rol !== rol) return false
    if (estado && u.estado !== estado) return false
    return true
  })

  return {
    usuarios: filtrados,
    totales,
  }
}

/**
 * Suspende o reactiva una cuenta de usuario validando motivo y órdenes pendientes (US24 - T102, T103).
 */
export function gestionarEstadoUsuario({
  usuario,
  accion,
  motivo = '',
  ordenesPendientesEntrega = 0,
} = {}) {
  if (!usuario) {
    return { ok: false, codigo: 'USUARIO_NO_ENCONTRADO', error: 'El usuario no existe.' }
  }

  const motivoLimpio = String(motivo || '').trim()
  if (motivoLimpio.length < 5) {
    return {
      ok: false,
      codigo: 'MOTIVO_OBLIGATORIO',
      error: 'Debe especificar un motivo válido para cambiar el estado de la cuenta.',
    }
  }

  if (accion === 'suspender') {
    if (usuario.rol === 'emolientero' && Number(ordenesPendientesEntrega) > 0) {
      return {
        ok: false,
        codigo: 'EMOLIENTERO_CON_ORDENES_PENDIENTES',
        error: 'No se puede suspender al emolientero mientras tenga órdenes pagadas pendientes de entrega.',
      }
    }

    return {
      ok: true,
      usuarioActualizado: {
        ...usuario,
        estado: 'suspendido',
        motivoEstado: motivoLimpio,
      },
    }
  }

  if (accion === 'reactivar') {
    return {
      ok: true,
      usuarioActualizado: {
        ...usuario,
        estado: 'activo',
        motivoEstado: motivoLimpio,
      },
    }
  }

  return {
    ok: false,
    codigo: 'ACCION_INVALIDA',
    error: "La acción debe ser 'suspender' o 'reactivar'.",
  }
}
