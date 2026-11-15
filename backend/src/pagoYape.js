// US14 - T63, T64, T65, T66, T67: Dominio de Pago con QR de Yape en Backend
// Implementa la jerarquía MetodoPago (RNF18), la subclase concreta Yape, validación estricta
// de constancia (unicidad de número de operación, monto exacto y vigencia de 15 minutos),
// generación de código de recojo de un solo uso y bitácora de transacciones (RNF06).

import { randomInt } from 'node:crypto'

export const PLAZO_VIGENCIA_ORDEN_MIN = 15
export const PLAZO_VIGENCIA_ORDEN_MS = PLAZO_VIGENCIA_ORDEN_MIN * 60 * 1000
export const NUMEROS_OPERACION_PRE_USADOS = ['12345678', '99887766', '87654321']

export function generarCodigoRecojoUnico() {
  let digitos = ''
  for (let i = 0; i < 4; i++) {
    digitos += String(randomInt(0, 10))
  }
  return `EMO-${digitos}`
}

export class MetodoPago {
  constructor(nombreMetodo) {
    if (new.target === MetodoPago) {
      throw new TypeError('MetodoPago es una clase abstracta: debe instanciarse una subclase como Yape.')
    }
    this.nombreMetodo = nombreMetodo
  }

  esOrdenVigente(orden, ahora = new Date()) {
    if (!orden) return false
    if (orden.forzarExpiracion === true) return false
    const estadosPermitidos = ['PENDIENTE_PAGO', 'Pendiente de pago', 'pendiente']
    if (orden.estado && !estadosPermitidos.includes(orden.estado)) {
      return false
    }
    const creadaEn = orden.creadaEn instanceof Date ? orden.creadaEn : new Date(orden.creadaEn)
    const transcurridoMs = ahora.getTime() - creadaEn.getTime()
    return transcurridoMs <= PLAZO_VIGENCIA_ORDEN_MS
  }

  validarYProcesarConstancia(_contexto) {
    throw new Error(`${this.constructor.name} debe implementar validarYProcesarConstancia(contexto).`)
  }
}

export class Yape extends MetodoPago {
  static CODIGO = 'YAPE_QR'

  constructor(operacionesIniciales = NUMEROS_OPERACION_PRE_USADOS) {
    super('Yape QR')
    this.numerosOperacionUsados = new Set(Array.from(operacionesIniciales, (op) => String(op).trim()))
    this.bitacora = []
  }

  generarDatosQR(orden) {
    const montoFormateado = Number(orden?.totalCalculado ?? 0).toFixed(2)
    const telefono = orden?.emolientero?.telefonoYape ?? '987654321'
    const titular = orden?.emolientero?.encargado ?? 'Luis Alberto Quispe Mamani'
    const puesto = orden?.emolientero?.nombre ?? 'Don Lucho - Tradición Molulana'
    const ordenId = orden?.id ?? 'ORD-2026-0842'

    return {
      metodo: 'Yape',
      ordenId,
      telefonoDestino: telefono,
      titularVerificado: titular,
      nombrePuesto: puesto,
      montoTotal: Number(montoFormateado),
      moneda: 'PEN',
      vigenciaMinutos: PLAZO_VIGENCIA_ORDEN_MIN,
      payloadQR: `00020101021226380010PE.YAPE.QR0111+51${telefono}540${montoFormateado.length}${montoFormateado}5802PE5925${titular.slice(0, 25)}62160512${ordenId}`,
    }
  }

  esOperacionDuplicada(numeroOperacion) {
    return this.numerosOperacionUsados.has(String(numeroOperacion ?? '').trim())
  }

  validarYProcesarConstancia({ orden, numeroOperacion, montoIngresado, ahora = new Date() } = {}) {
    const fechaEvento = ahora instanceof Date ? ahora : new Date(ahora)
    const opLimpia = String(numeroOperacion ?? '').trim()
    const montoNum = Number(montoIngresado)
    const totalEsperado = Number(orden?.totalCalculado ?? 0)

    const registrarEnBitacora = ({ resultado, codigoCausa, detalle, codigoRecojo = null }) => {
      const registro = {
        idTransaccion: `TX-${Date.now()}-${randomInt(100, 999)}`,
        fechaHora: fechaEvento.toISOString(),
        ordenId: orden?.id ?? 'ORD-SIN-ID',
        numeroOperacion: opLimpia || '(vacío)',
        montoIngresado: Number.isFinite(montoNum) ? Number(montoNum.toFixed(2)) : 0,
        montoEsperado: Number(totalEsperado.toFixed(2)),
        resultado,
        codigoCausa,
        detalle,
        codigoRecojo,
      }
      this.bitacora.unshift(registro)
      return registro
    }

    // 1. Verificar vigencia de la orden (<= 15 minutos)
    if (!this.esOrdenVigente(orden, fechaEvento)) {
      const detalleError = `La reserva de la orden venció al superar el límite de ${PLAZO_VIGENCIA_ORDEN_MIN} minutos. La reserva de productos ha sido liberada.`
      const transaccion = registrarEnBitacora({
        resultado: 'RECHAZADO',
        codigoCausa: 'ORDEN_VENCIDA',
        detalle: detalleError,
      })

      return {
        valido: false,
        mensaje: 'Pago no válido',
        codigoCausa: 'ORDEN_VENCIDA',
        detalleError,
        estadoOrden: 'Rechazada / Reserva Liberada',
        reservaLiberada: true,
        codigoRecojo: null,
        transaccion,
        ordenActualizada: {
          ...orden,
          estado: 'Rechazada / Reserva Liberada',
          reservaLiberada: true,
        },
      }
    }

    // 2a. Verificar formato del número de operación (6 a 10 dígitos numéricos)
    if (!/^\d{6,10}$/.test(opLimpia)) {
      const detalleError =
        'El número de operación de Yape debe contener entre 6 y 10 dígitos numéricos válidos. La reserva ha sido liberada.'
      const transaccion = registrarEnBitacora({
        resultado: 'RECHAZADO',
        codigoCausa: 'FORMATO_OPERACION_INVALIDO',
        detalle: detalleError,
      })

      return {
        valido: false,
        mensaje: 'Pago no válido',
        codigoCausa: 'FORMATO_OPERACION_INVALIDO',
        detalleError,
        estadoOrden: 'Rechazada / Reserva Liberada',
        reservaLiberada: true,
        codigoRecojo: null,
        transaccion,
        ordenActualizada: {
          ...orden,
          estado: 'Rechazada / Reserva Liberada',
          reservaLiberada: true,
        },
      }
    }

    // 2b. Verificar unicidad del número de operación
    if (this.esOperacionDuplicada(opLimpia)) {
      const detalleError = `El número de operación N.° ${opLimpia} ya fue utilizado en una transacción previa (operación duplicada). La reserva ha sido liberada.`
      const transaccion = registrarEnBitacora({
        resultado: 'RECHAZADO',
        codigoCausa: 'OPERACION_DUPLICADA',
        detalle: detalleError,
      })

      return {
        valido: false,
        mensaje: 'Pago no válido',
        codigoCausa: 'OPERACION_DUPLICADA',
        detalleError,
        estadoOrden: 'Rechazada / Reserva Liberada',
        reservaLiberada: true,
        codigoRecojo: null,
        transaccion,
        ordenActualizada: {
          ...orden,
          estado: 'Rechazada / Reserva Liberada',
          reservaLiberada: true,
        },
      }
    }

    // 3. Verificar coincidencia exacta del monto con el total de la orden
    if (!Number.isFinite(montoNum) || Math.abs(montoNum - totalEsperado) >= 0.005) {
      const montoTexto = Number.isFinite(montoNum) ? `S/ ${montoNum.toFixed(2)}` : 'inválido'
      const detalleError = `El monto registrado (${montoTexto}) no coincide con el total calculado de la orden (S/ ${totalEsperado.toFixed(2)}). La reserva ha sido liberada.`
      const transaccion = registrarEnBitacora({
        resultado: 'RECHAZADO',
        codigoCausa: 'MONTO_INCORRECTO',
        detalle: detalleError,
      })

      return {
        valido: false,
        mensaje: 'Pago no válido',
        codigoCausa: 'MONTO_INCORRECTO',
        detalleError,
        estadoOrden: 'Rechazada / Reserva Liberada',
        reservaLiberada: true,
        codigoRecojo: null,
        transaccion,
        ordenActualizada: {
          ...orden,
          estado: 'Rechazada / Reserva Liberada',
          reservaLiberada: true,
        },
      }
    }

    // Éxito: las 3 validaciones se cumplen
    this.numerosOperacionUsados.add(opLimpia)
    const codigoRecojo = generarCodigoRecojoUnico()
    const detalleExito = `Constancia Yape N.° ${opLimpia} verificada por S/ ${totalEsperado.toFixed(2)}. Orden marcada como Pagada.`
    const transaccion = registrarEnBitacora({
      resultado: 'ACEPTADO',
      codigoCausa: 'PAGO_VERIFICADO',
      detalle: detalleExito,
      codigoRecojo,
    })

    return {
      valido: true,
      mensaje: 'Pago confirmado exitosamente',
      codigoCausa: 'PAGO_VERIFICADO',
      detalleError: null,
      estadoOrden: 'Pagada',
      reservaLiberada: false,
      codigoRecojo,
      transaccion,
      ordenActualizada: {
        ...orden,
        estado: 'Pagada',
        reservaLiberada: false,
        codigoRecojo,
        numeroOperacionYape: opLimpia,
        pagadaEn: fechaEvento.toISOString(),
      },
    }
  }
}

export class PagoController {
  constructor(metodoPago = new Yape()) {
    this.metodoPago = metodoPago
  }

  obtenerDatosQR(orden) {
    return this.metodoPago.generarDatosQR(orden)
  }

  procesarConstancia({ orden, numeroOperacion, montoIngresado, ahora = new Date() }) {
    return this.metodoPago.validarYProcesarConstancia({
      orden,
      numeroOperacion,
      montoIngresado,
      ahora,
    })
  }

  obtenerBitacora() {
    return this.metodoPago.bitacora ?? []
  }
}
