// US14 - T63, T65, T66, T67: Subclase concreta Yape extends MetodoPago
// Implementa la generación de QR de Yape, validación estricta de constancia de operación
// (unicidad de número de operación, monto exacto y vigencia de 15 minutos) y registro en bitácora (RNF06).

import { MetodoPago, PLAZO_VIGENCIA_ORDEN_MIN } from './MetodoPago.js'

export const NUMEROS_OPERACION_PRE_USADOS = ['12345678', '99887766', '87654321']

const DIGITOS_SIN_CONFUSION = '23456789'
const LETRAS_SIN_CONFUSION = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

/**
 * Genera un código de recojo de un solo uso vinculado a la orden pagada (US14 -> US15).
 * Formato principal visible: EMO-XXXX (ej. EMO-7492) y código alfanumérico de 6 caracteres.
 */
export function generarCodigoRecojoUnico(semilla = null) {
  if (semilla && /^EMO-\d{4}$/.test(semilla)) return semilla
  let cuatroDigitos = ''
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * 10)
    cuatroDigitos += String(idx)
  }
  return `EMO-${cuatroDigitos}`
}

export function generarCodigoAlfanumericoUS15() {
  const pool = LETRAS_SIN_CONFUSION + DIGITOS_SIN_CONFUSION
  let s = ''
  for (let i = 0; i < 6; i++) {
    s += pool[Math.floor(Math.random() * pool.length)]
  }
  return `${s.slice(0, 3)}-${s.slice(3)}`
}

export class Yape extends MetodoPago {
  static CODIGO = 'YAPE_QR'

  /**
   * @param {Iterable<string>} [operacionesIniciales]
   */
  constructor(operacionesIniciales = NUMEROS_OPERACION_PRE_USADOS) {
    super('Yape QR')
    this.numerosOperacionUsados = new Set(Array.from(operacionesIniciales, (op) => String(op).trim()))
    this.bitacora = []
  }

  /**
   * T64: Genera los metadatos y payload para renderizar el código QR de Yape del emolientero.
   */
  generarDatosQR(orden) {
    const montoFormateado = Number(orden?.totalCalculado ?? 0).toFixed(2)
    const telefono = orden?.emolientero?.telefonoYape ?? '987654321'
    const titular = orden?.emolientero?.encargado ?? 'Luis Alberto Quispe Mamani'
    const puesto = orden?.emolientero?.nombre ?? 'Don Lucho - Tradición Molulana'
    const codigoMunicipal = orden?.emolientero?.codigoMunicipal ?? 'MLM-2026-00104'
    const ordenId = orden?.id ?? 'ORD-2026-0842'

    const payloadQR = `00020101021226380010PE.YAPE.QR0111+51${telefono}520458125303604540${montoFormateado.length}${montoFormateado}5802PE5925${titular.slice(0, 25)}6009LA MOLINA62160512${ordenId}6304A1B2`

    return {
      metodo: 'Yape',
      ordenId,
      telefonoDestino: telefono,
      telefonoEnmascarado: `${telefono.slice(0, 3)} ${telefono.slice(3, 6)} ${telefono.slice(6)}`,
      titularVerificado: titular,
      nombrePuesto: puesto,
      codigoMunicipal,
      montoTotal: Number(montoFormateado),
      moneda: 'PEN',
      simbolo: 'S/',
      vigenciaMinutos: PLAZO_VIGENCIA_ORDEN_MIN,
      payloadQR,
    }
  }

  /**
   * Verifica si un número de operación ya fue registrado anteriormente.
   */
  esOperacionDuplicada(numeroOperacion) {
    const limpio = String(numeroOperacion ?? '').trim()
    return this.numerosOperacionUsados.has(limpio)
  }

  /**
   * T65 + T66 + T67: Valida la constancia de operación de Yape bajo las 3 reglas de negocio estrictas:
   * 1. Vigencia de la orden (<= 15 minutos desde su creación y estado PENDIENTE_PAGO).
   * 2. Unicidad y formato válido del número de operación (6 a 10 dígitos numéricos y no repetido).
   * 3. Coincidencia exacta entre el monto transferido y el total calculado de la orden.
   */
  validarYProcesarConstancia({ orden, numeroOperacion, montoIngresado, ahora = new Date() } = {}) {
    const fechaEvento = ahora instanceof Date ? ahora : new Date(ahora)
    const opLimpia = String(numeroOperacion ?? '').trim()
    const montoNum = Number(montoIngresado)
    const totalEsperado = Number(orden?.totalCalculado ?? 0)

    const registrarEnBitacora = ({ resultado, codigoCausa, detalle, codigoRecojo = null }) => {
      const registro = {
        idTransaccion: `TX-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
        fechaHora: fechaEvento.toISOString(),
        ordenId: orden?.id ?? 'ORD-SIN-ID',
        emolientero: orden?.emolientero?.nombre ?? 'Puesto Emolivery',
        numeroOperacion: opLimpia || '(vacío)',
        montoIngresado: Number.isFinite(montoNum) ? Number(montoNum.toFixed(2)) : 0,
        montoEsperado: Number(totalEsperado.toFixed(2)),
        resultado, // 'ACEPTADO' | 'RECHAZADO'
        codigoCausa,
        detalle,
        codigoRecojo,
      }
      this.bitacora.unshift(registro)
      return registro
    }

    // Regla 1: Verificar que la orden no haya expirado (> 15 minutos)
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

    // Regla 2a: Formato del número de operación de Yape (6 a 10 dígitos numéricos)
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

    // Regla 2b: Unicidad del número de operación
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

    // Regla 3: Coincidencia exacta del monto con el total calculado de la orden
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

    // ESCENARIO EXITOSO: las 3 validaciones se cumplen
    this.numerosOperacionUsados.add(opLimpia)
    const codigoRecojo = generarCodigoRecojoUnico()
    const codigoUS15 = generarCodigoAlfanumericoUS15()

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
      codigoUS15,
      transaccion,
      ordenActualizada: {
        ...orden,
        estado: 'Pagada',
        reservaLiberada: false,
        codigoRecojo,
        codigoUS15,
        numeroOperacionYape: opLimpia,
        pagadaEn: fechaEvento.toISOString(),
      },
    }
  }
}
