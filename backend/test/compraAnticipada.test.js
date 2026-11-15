// US13 - T58 a T62: modelo de Orden y LineaDeOrden, carrito y reglas de la compra (no necesitan base de datos).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { LineaDeOrden, Orden, VIGENCIA_PAGO_MIN, verificarCompra } from '../src/orden.js'
import { validarCarrito } from '../src/validaciones/compra.js'

const EMOLIENTERO = '11111111-2222-4333-8444-555555555555'
const maca = { id: 1, nombre: 'Emoliente con maca', precio: 2.5, disponible: true }
const quinua = { id: 2, nombre: 'Quinua con manzana', precio: 2, disponible: true }
const enJornada = { id: EMOLIENTERO, nombre: 'Elmer', enJornada: true }

// Captura el ErrorHttp que lanza una función y devuelve { status, message }.
function errorDe(fn) {
  try {
    fn()
  } catch (err) {
    return { status: err.status, message: err.message }
  }
  assert.fail('se esperaba un error')
}

describe('T58: LineaDeOrden con precio congelado', () => {
  test('copia el nombre y el precio del producto', () => {
    const linea = LineaDeOrden.desdeProducto(maca, 3)
    assert.deepEqual({ ...linea }, { productoId: 1, nombre: 'Emoliente con maca', precioUnitario: 2.5, cantidad: 3 })
  })

  test('si después cambia el precio del producto, la línea conserva el precio de la compra', () => {
    const producto = { ...maca }
    const linea = LineaDeOrden.desdeProducto(producto, 2)
    producto.precio = 9
    assert.equal(linea.precioUnitario, 2.5)
    assert.equal(linea.subtotal, 5)
  })

  test('la línea no se puede modificar', () => {
    const linea = LineaDeOrden.desdeProducto(maca, 1)
    assert.throws(() => {
      linea.precioUnitario = 0.1
    }, TypeError)
  })
})

describe('T59: cálculo del total', () => {
  test('suma los subtotales de las líneas', () => {
    const orden = Orden.crear({ clienteId: 'c', emolienteroId: EMOLIENTERO, lineas: [LineaDeOrden.desdeProducto(maca, 2), LineaDeOrden.desdeProducto(quinua, 3)] })
    assert.equal(orden.total, 11)
  })

  test('no acumula errores de redondeo con decimales', () => {
    const diezCentimos = { id: 3, nombre: 'Galleta', precio: 0.1, disponible: true }
    const veinteCentimos = { id: 4, nombre: 'Caramelo', precio: 0.2, disponible: true }
    const orden = Orden.crear({ clienteId: 'c', emolienteroId: EMOLIENTERO, lineas: [LineaDeOrden.desdeProducto(diezCentimos, 1), LineaDeOrden.desdeProducto(veinteCentimos, 1)] })
    assert.equal(orden.total, 0.3)
  })
})

describe('T60: orden Pendiente de pago con vigencia de 15 minutos', () => {
  const ahora = new Date('2026-11-15T10:00:00Z')
  const orden = Orden.crear({ clienteId: 'c', emolienteroId: EMOLIENTERO, lineas: [LineaDeOrden.desdeProducto(maca, 1)], ahora })

  test('se crea en estado pendiente_pago', () => {
    assert.equal(orden.estado, 'pendiente_pago')
  })

  test(`vence a los ${VIGENCIA_PAGO_MIN} minutos`, () => {
    assert.equal(orden.expiraEn.toISOString(), '2026-11-15T10:15:00.000Z')
  })

  test('no está vencida un segundo antes y sí al cumplirse el plazo', () => {
    assert.equal(orden.estaVencida(new Date('2026-11-15T10:14:59Z')), false)
    assert.equal(orden.estaVencida(new Date('2026-11-15T10:15:00Z')), true)
  })

  test('una orden ya pagada no vence', () => {
    const pagada = new Orden({ ...orden, estado: 'pendiente' })
    assert.equal(pagada.estaVencida(new Date('2026-11-15T11:00:00Z')), false)
  })
})

describe('T61: validar disponibilidad y jornada activa al confirmar', () => {
  test('devuelve las líneas con el precio del catálogo', () => {
    const lineas = verificarCompra({ emolientero: enJornada, carrito: [{ productoId: 1, cantidad: 2 }], productos: [maca, quinua] })
    assert.equal(lineas.length, 1)
    assert.equal(lineas[0].precioUnitario, 2.5)
  })

  test('rechaza un producto agotado', () => {
    const agotado = { ...maca, disponible: false }
    const error = errorDe(() => verificarCompra({ emolientero: enJornada, carrito: [{ productoId: 1, cantidad: 1 }], productos: [agotado] }))
    assert.equal(error.status, 422)
    assert.match(error.message, /ya no está disponible/)
  })

  test('rechaza un producto que no es del catálogo de ese emolientero', () => {
    const error = errorDe(() => verificarCompra({ emolientero: enJornada, carrito: [{ productoId: 99, cantidad: 1 }], productos: [maca] }))
    assert.equal(error.status, 422)
  })

  test('rechaza un emolientero inexistente o inactivo', () => {
    assert.equal(errorDe(() => verificarCompra({ emolientero: null, carrito: [{ productoId: 1, cantidad: 1 }], productos: [] })).status, 404)
  })
})

describe('T62: carrito vacío y cierre de jornada durante la compra', () => {
  test('el carrito vacío no pasa la validación', () => {
    assert.deepEqual(validarCarrito({ emolienteroId: EMOLIENTERO, lineas: [] }).errores, {
      carrito: 'Tu carrito está vacío. Agrega al menos un producto.',
    })
  })

  test('sin lista de productos también es carrito vacío', () => {
    assert.ok(validarCarrito({ emolienteroId: EMOLIENTERO }).errores.carrito)
  })

  test('no se puede crear una orden sin líneas', () => {
    const error = errorDe(() => Orden.crear({ clienteId: 'c', emolienteroId: EMOLIENTERO, lineas: [] }))
    assert.equal(error.status, 400)
    assert.match(error.message, /carrito está vacío/)
  })

  test('si el emolientero cerró la jornada mientras el cliente compraba, la compra se rechaza', () => {
    const cerro = { ...enJornada, enJornada: false }
    const error = errorDe(() => verificarCompra({ emolientero: cerro, carrito: [{ productoId: 1, cantidad: 1 }], productos: [maca] }))
    assert.equal(error.status, 422)
    assert.match(error.message, /cerró su jornada/)
  })
})

describe('Carrito: forma de los datos', () => {
  test('junta el mismo producto agregado dos veces', () => {
    const { datos, errores } = validarCarrito({ emolienteroId: EMOLIENTERO, lineas: [{ productoId: 1, cantidad: 2 }, { productoId: 1, cantidad: 3 }] })
    assert.deepEqual(errores, {})
    assert.deepEqual(datos.carrito, [{ productoId: 1, cantidad: 5 }])
  })

  test('rechaza más de 20 unidades de un producto', () => {
    assert.ok(validarCarrito({ emolienteroId: EMOLIENTERO, lineas: [{ productoId: 1, cantidad: 21 }] }).errores.carrito)
  })

  for (const cantidad of [0, -1, 1.5, '2', null]) {
    test(`rechaza la cantidad ${JSON.stringify(cantidad)}`, () => {
      assert.ok(validarCarrito({ emolienteroId: EMOLIENTERO, lineas: [{ productoId: 1, cantidad }] }).errores.carrito)
    })
  }

  test('exige un emolientero válido', () => {
    assert.ok(validarCarrito({ emolienteroId: 'abc', lineas: [{ productoId: 1, cantidad: 1 }] }).errores.emolienteroId)
  })
})
