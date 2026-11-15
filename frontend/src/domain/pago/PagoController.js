// US14 - T63..T67: Controlador PagoController y creación de órdenes anticipadas de prueba
// Coordina la jerarquía MetodoPago (subclase Yape), administra el ciclo de vida de la orden
// (Pendiente de pago -> Pagada | Rechazada / Reserva Liberada) y mantiene la bitácora RNF06.

import { EMOLIENTEROS_SEMILLA_LA_MOLINA } from '../ubicacion/Localizador.js'
import { NUMEROS_OPERACION_PRE_USADOS, Yape } from './Yape.js'

export const PRODUCTOS_DEMO_ORDEN = [
  {
    id: 'prod-1',
    nombre: 'Emoliente Especial con Maca Negra, Linaza y Polen',
    categoria: 'Emolientes',
    cantidad: 2,
    precioUnitario: 3.5,
  },
  {
    id: 'prod-2',
    nombre: 'Quinua Carretillera con Manzana y Membrillo',
    categoria: 'Quinua y avena',
    cantidad: 1,
    precioUnitario: 2.5,
  },
  {
    id: 'prod-3',
    nombre: 'Pan Campesino con Palta Fuerte',
    categoria: 'Acompañamientos',
    cantidad: 1,
    precioUnitario: 2.0,
  },
]

export function calcularTotalItems(items = PRODUCTOS_DEMO_ORDEN) {
  const suma = items.reduce((acc, item) => acc + Number(item.cantidad) * Number(item.precioUnitario), 0)
  return Number(suma.toFixed(2))
}

export function crearOrdenPendiente({
  emolienteroId = 'emo-01',
  items = PRODUCTOS_DEMO_ORDEN,
  creadaEn = new Date(),
  idPersonalizado = null,
} = {}) {
  const emolienterosActivos = EMOLIENTEROS_SEMILLA_LA_MOLINA.filter((e) => e.jornadaAbierta)
  const emolientero =
    emolienterosActivos.find((e) => e.id === emolienteroId) ?? emolienterosActivos[0]

  const totalCalculado = calcularTotalItems(items)
  const sufijo = Math.floor(1000 + Math.random() * 9000)

  return {
    id: idPersonalizado ?? `ORD-2026-${sufijo}`,
    clienteNombre: 'Cliente Verificado Emolivery',
    emolientero: {
      id: emolientero.id,
      nombre: emolientero.nombre,
      encargado: emolientero.encargado,
      codigoMunicipal: emolientero.codigoMunicipal,
      telefonoYape: emolientero.telefonoYape ?? '987654321',
      direccionReferencia: emolientero.direccionReferencia,
      zona: emolientero.zona,
    },
    items: items.map((it) => ({
      ...it,
      subtotal: Number((Number(it.cantidad) * Number(it.precioUnitario)).toFixed(2)),
    })),
    totalCalculado,
    estado: 'PENDIENTE_PAGO',
    reservaLiberada: false,
    creadaEn: creadaEn instanceof Date ? creadaEn.toISOString() : new Date(creadaEn).toISOString(),
    forzarExpiracion: false,
    codigoRecojo: null,
  }
}

export class PagoController {
  constructor(metodoPago = new Yape()) {
    this.metodoPago = metodoPago
  }

  cambiarMetodoPago(nuevoMetodo) {
    this.metodoPago = nuevoMetodo
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

  obtenerOperacionesUsadas() {
    return Array.from(this.metodoPago.numerosOperacionUsados ?? NUMEROS_OPERACION_PRE_USADOS)
  }
}
