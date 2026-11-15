// US12: consulta pública del catálogo contra la BD de .env.local. Crea usuarios test-<id>@emolivery.test
// (con su catálogo y jornadas, que se borran en cascada) y los borra al terminar.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { app } from '../src/app.js'
import { pool } from '../src/db.js'
import { MOTIVO_FUERA_DE_JORNADA } from '../src/routes/catalogo.js'

const SUFIJO = randomBytes(4).toString('hex')
const correo = (nombre) => `test-${SUFIJO}-${nombre}@emolivery.test`
let servidor, base
const ids = {}

async function crearEmolientero(nombre, estado = 'activo') {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre, correo, password_hash, rol, estado) VALUES ($1, $2, 'sin-login', 'emolientero', $3) RETURNING id`,
    [`Test ${nombre}`, correo(nombre), estado],
  )
  ids[nombre] = rows[0].id
}

const agregarProducto = (nombre, producto) =>
  pool.query(
    'INSERT INTO catalogo_productos (emolientero_id, nombre, categoria, precio, disponible) VALUES ($1, $2, $3, $4, $5)',
    [ids[nombre], producto.nombre, producto.categoria, producto.precio, producto.disponible ?? true],
  )

const abrirJornada = (nombre) => pool.query('INSERT INTO jornadas (emolientero_id) VALUES ($1)', [ids[nombre]])
const cerrarJornada = (nombre) => pool.query('UPDATE jornadas SET cerrada_en = now() WHERE emolientero_id = $1 AND cerrada_en IS NULL', [ids[nombre]])

async function catalogo(id) {
  const res = await fetch(`${base}/api/catalogo/${id}`)
  return { status: res.status, datos: await res.json().catch(() => null) }
}

before(async () => {
  servidor = app.listen(0)
  base = `http://localhost:${servidor.address().port}`
  await crearEmolientero('surtido')
  await crearEmolientero('vacio')
  for (const estado of ['pendiente_verificacion', 'rechazado', 'suspendido']) await crearEmolientero(estado, estado)

  // Desordenados a propósito: la vista debe agruparlos y ordenarlos.
  await agregarProducto('surtido', { nombre: 'Pan con queso', categoria: 'acompanamiento', precio: 1.5 })
  await agregarProducto('surtido', { nombre: 'Maca con leche', categoria: 'maca', precio: 2.5 })
  await agregarProducto('surtido', { nombre: 'Emoliente con sábila', categoria: 'emoliente', precio: 2 })
  await agregarProducto('surtido', { nombre: 'Avena con piña', categoria: 'quinua_avena', precio: 2, disponible: false })
  await agregarProducto('surtido', { nombre: 'Emoliente clásico', categoria: 'emoliente', precio: 1.5 })
  await agregarProducto('suspendido', { nombre: 'Emoliente clásico', categoria: 'emoliente', precio: 1.5 })
})

after(async () => {
  await pool.query('DELETE FROM usuarios WHERE correo LIKE $1', [`test-${SUFIJO}-%`])
  await pool.end()
  servidor.close()
})

describe('T54: vista pública agrupada por categoría', () => {
  test('es pública (sin sesión) y agrupa en el orden fijo de categorías, omitiendo las vacías', async () => {
    const { status, datos } = await catalogo(ids.surtido)
    assert.equal(status, 200)
    assert.equal(datos.emolientero.nombre, 'Test surtido')
    assert.deepEqual(datos.categorias.map((c) => c.id), ['emoliente', 'quinua_avena', 'maca', 'acompanamiento'])
    assert.equal(datos.categorias[0].nombre, 'Emolientes')
  })

  test('dentro de cada categoría los productos van por nombre', async () => {
    const { datos } = await catalogo(ids.surtido)
    assert.deepEqual(datos.categorias[0].productos.map((p) => p.nombre), ['Emoliente clásico', 'Emoliente con sábila'])
  })
})

describe('T55: precio y disponibilidad', () => {
  test('cada producto trae precio numérico y disponibilidad', async () => {
    const { datos } = await catalogo(ids.surtido)
    const productos = datos.categorias.flatMap((c) => c.productos)
    assert.equal(productos.length, 5)
    assert.equal(productos.find((p) => p.nombre === 'Maca con leche').precio, 2.5)
    assert.equal(productos.find((p) => p.nombre === 'Avena con piña').disponible, false)
    for (const p of productos) assert.deepEqual(Object.keys(p).sort(), ['comprable', 'descripcion', 'disponible', 'id', 'nombre', 'precio'])
  })
})

describe('T56: compra según la jornada', () => {
  test('en jornada se pueden comprar los disponibles, pero no los agotados', async () => {
    await abrirJornada('surtido')
    const { datos } = await catalogo(ids.surtido)
    assert.equal(datos.emolientero.enJornada, true)
    assert.equal(datos.puedeComprar, true)
    assert.equal(datos.motivoNoCompra, null)
    const productos = datos.categorias.flatMap((c) => c.productos)
    assert.ok(productos.filter((p) => p.disponible).every((p) => p.comprable))
    assert.equal(productos.find((p) => p.nombre === 'Avena con piña').comprable, false)
  })

  test('fuera de jornada el catálogo se ve, pero ningún producto es comprable', async () => {
    await cerrarJornada('surtido')
    const { status, datos } = await catalogo(ids.surtido)
    assert.equal(status, 200)
    assert.equal(datos.emolientero.enJornada, false)
    assert.equal(datos.puedeComprar, false)
    assert.equal(datos.motivoNoCompra, MOTIVO_FUERA_DE_JORNADA)
    const productos = datos.categorias.flatMap((c) => c.productos)
    assert.equal(productos.length, 5)
    assert.ok(productos.every((p) => !p.comprable))
  })
})

describe('T57: catálogo vacío y emolientero inactivo', () => {
  test('un emolientero sin productos responde 200 con la lista de categorías vacía', async () => {
    await abrirJornada('vacio')
    const { status, datos } = await catalogo(ids.vacio)
    assert.equal(status, 200)
    assert.deepEqual(datos.categorias, [])
    assert.equal(datos.emolientero.enJornada, true)
  })

  for (const estado of ['pendiente_verificacion', 'rechazado', 'suspendido']) {
    test(`un emolientero ${estado} no publica su catálogo (404)`, async () => {
      const { status, datos } = await catalogo(ids[estado])
      assert.equal(status, 404)
      assert.equal(datos.error, 'Emolientero no encontrado.')
    })
  }

  test('un id inexistente o mal formado responde 404', async () => {
    assert.equal((await catalogo('00000000-0000-4000-8000-000000000000')).status, 404)
    assert.equal((await catalogo('no-es-un-uuid')).status, 404)
  })

  test('el catálogo de un cliente no existe (404)', async () => {
    const { rows } = await pool.query("SELECT id FROM usuarios WHERE rol = 'cliente' LIMIT 1")
    if (rows[0]) assert.equal((await catalogo(rows[0].id)).status, 404)
  })
})
