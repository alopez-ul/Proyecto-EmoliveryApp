// US13 - Compra anticipada.
// T58: modelo de Orden y LineaDeOrden. La línea congela el precio del producto al momento de la compra,
// y la orden calcula su total a partir de sus líneas. No usa la base de datos (se prueba de forma unitaria).
import { ErrorHttp } from './errores.js'

export const VIGENCIA_PAGO_MIN = 15 // T60: minutos para pagar antes de que la orden venza
export const CANTIDAD_MAXIMA = 20 // por producto; debe coincidir con el CHECK de 013_compra_anticipada.sql

const MS_POR_MIN = 60_000

// Suma en céntimos para evitar errores de redondeo de los decimales (0.1 + 0.2).
const aCentimos = (soles) => Math.round(soles * 100)

export class LineaDeOrden {
  constructor({ productoId, nombre, precioUnitario, cantidad }) {
    Object.assign(this, { productoId, nombre, precioUnitario, cantidad })
    Object.freeze(this) // el precio no puede cambiar después de creada la línea
  }

  // T58: copia el nombre y el precio que el producto tiene ahora (precio congelado).
  static desdeProducto(producto, cantidad) {
    return new LineaDeOrden({ productoId: producto.id, nombre: producto.nombre, precioUnitario: producto.precio, cantidad })
  }

  get subtotal() {
    return (aCentimos(this.precioUnitario) * this.cantidad) / 100
  }
}

export class Orden {
  constructor({ id = null, clienteId, emolienteroId, lineas = [], estado = 'pendiente_pago', creadaEn = new Date(), expiraEn = null }) {
    Object.assign(this, { id, clienteId, emolienteroId, lineas, estado, creadaEn: new Date(creadaEn) })
    this.expiraEn = expiraEn && new Date(expiraEn)
  }

  // T60: crea la orden en estado Pendiente de pago, con vigencia de 15 minutos.
  // T62: una orden sin líneas (carrito vacío) no se puede crear.
  static crear({ clienteId, emolienteroId, lineas, ahora = new Date() }) {
    if (!lineas?.length) throw new ErrorHttp(400, 'Tu carrito está vacío. Agrega al menos un producto.')
    return new Orden({
      clienteId,
      emolienteroId,
      lineas,
      estado: 'pendiente_pago',
      creadaEn: ahora,
      expiraEn: new Date(ahora.getTime() + VIGENCIA_PAGO_MIN * MS_POR_MIN),
    })
  }

  // T59: total de la orden (suma de los subtotales de sus líneas).
  get total() {
    return this.lineas.reduce((suma, linea) => suma + aCentimos(linea.subtotal), 0) / 100
  }

  // Una orden pendiente de pago vence a los 15 minutos (US14 ya no la acepta para pagar).
  estaVencida(ahora = new Date()) {
    return this.estado === 'pendiente_pago' && ahora >= this.expiraEn
  }
}

// T61: al confirmar la compra se revisa que el emolientero siga en jornada y que cada producto
// del carrito siga en su catálogo y disponible. Devuelve las líneas con el precio congelado.
// - emolientero: { id, nombre, enJornada } o null si no existe o su cuenta no está activa
// - carrito: [{ productoId, cantidad }]
// - productos: productos del catálogo de ese emolientero [{ id, nombre, precio, disponible }]
export function verificarCompra({ emolientero, carrito, productos }) {
  if (!emolientero) throw new ErrorHttp(404, 'Emolientero no encontrado.')
  if (!carrito?.length) throw new ErrorHttp(400, 'Tu carrito está vacío. Agrega al menos un producto.')
  if (!emolientero.enJornada) {
    throw new ErrorHttp(422, `${emolientero.nombre} cerró su jornada. No se puede confirmar la compra hasta que vuelva a abrir.`)
  }
  return carrito.map(({ productoId, cantidad }) => {
    const producto = productos.find((p) => p.id === productoId)
    if (!producto) throw new ErrorHttp(422, 'Un producto de tu carrito ya no está en el catálogo. Revisa tu carrito.')
    if (!producto.disponible) throw new ErrorHttp(422, `"${producto.nombre}" ya no está disponible. Quítalo de tu carrito para continuar.`)
    return LineaDeOrden.desdeProducto(producto, cantidad)
  })
}
