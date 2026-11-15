// US15 - T71: validación del código de recojo contra la API real (BD de .env.local).
// Crea usuarios test-<id>@emolivery.test y los borra al terminar (sus órdenes y reseñas se borran en cascada).
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { app } from '../src/app.js'
import { pool } from '../src/db.js'
import { hashContrasena } from '../src/seguridad.js'
import { crearOrden, formatearCodigo } from '../src/codigoRecojo.js'

const SUFIJO = randomBytes(4).toString('hex')
const PASSWORD = 'Prueba1234'
const correo = (n) => `test-${SUFIJO}-${n}@emolivery.test`
let servidor, base
const ids = {}
const tokens = {}

async function crearUsuario(nombre, rol) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre, correo, password_hash, rol, estado) VALUES ($1, $2, $3, $4, 'activo') RETURNING id`,
    [`Test ${nombre}`, correo(nombre), await hashContrasena(PASSWORD), rol],
  )
  ids[nombre] = rows[0].id
  tokens[nombre] = (await api('POST', '/api/auth/login', { body: { correo: correo(nombre), password: PASSWORD } })).datos.token
}

async function api(metodo, ruta, { nombre, body } = {}) {
  const res = await fetch(base + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(nombre && { Authorization: `Bearer ${tokens[nombre]}` }) },
    body: body && JSON.stringify(body),
  })
  return { status: res.status, datos: await res.json().catch(() => null) }
}

const nuevaOrden = (emolientero = 'emo') => crearOrden(pool, { clienteId: ids.cliente, emolienteroId: ids[emolientero] })
const entregar = (nombre, codigo) => api('POST', '/api/ordenes/entregar', { nombre, body: { codigo } })
const ordenEnBd = async (id) =>
  (await pool.query('SELECT estado, entregada_en AS "entregadaEn" FROM ordenes WHERE id = $1', [id])).rows[0]
const resenasDe = async (ordenId) => (await pool.query('SELECT * FROM resenas WHERE orden_id = $1', [ordenId])).rows

before(async () => {
  servidor = app.listen(0)
  base = `http://localhost:${servidor.address().port}`
  for (const [n, rol] of [['emo', 'emolientero'], ['otro', 'emolientero'], ['cliente', 'cliente']]) await crearUsuario(n, rol)
})

after(async () => {
  await pool.query('DELETE FROM usuarios WHERE correo LIKE $1', [`test-${SUFIJO}-%`])
  await pool.end()
  servidor.close()
})

describe('US15: acceso', () => {
  test('sin sesión 401; un cliente no puede entregar (403)', async () => {
    assert.equal((await api('POST', '/api/ordenes/entregar', { body: { codigo: 'ABC23X' } })).status, 401)
    assert.equal((await entregar('cliente', 'ABC23X')).status, 403)
  })
})

describe('T68: el cliente ve su código', () => {
  test('cada orden nueva tiene un código distinto y el cliente lo ve formateado', async () => {
    const [a, b] = [await nuevaOrden(), await nuevaOrden()]
    assert.notEqual(a.codigoRecojo, b.codigoRecojo)
    const { status, datos } = await api('GET', '/api/ordenes/mias', { nombre: 'cliente' })
    assert.equal(status, 200)
    const codigos = datos.map((o) => o.codigoRecojo)
    assert.ok(codigos.includes(formatearCodigo(a.codigoRecojo)) && codigos.includes(formatearCodigo(b.codigoRecojo)))
  })

  test('el emolientero ve sus pedidos por entregar, sin el código', async () => {
    const { datos } = await api('GET', '/api/ordenes/por-entregar', { nombre: 'emo' })
    assert.ok(datos.length >= 2)
    assert.ok(datos.every((o) => !('codigoRecojo' in o) && o.cliente === 'Test cliente'))
  })
})

describe('T70: entrega con código válido (transacción atómica)', () => {
  let orden

  test('entrega la orden, habilita la reseña y notifica al cliente', async () => {
    orden = await nuevaOrden()
    // El emolientero puede escribirlo en minúsculas y con guion.
    const { status, datos } = await entregar('emo', formatearCodigo(orden.codigoRecojo).toLowerCase())
    assert.equal(status, 200)
    assert.equal(datos.orden.id, orden.id)
    assert.equal(datos.orden.estado, 'entregada')
    assert.ok(datos.resena.id)

    const enBd = await ordenEnBd(orden.id)
    assert.equal(enBd.estado, 'entregada')
    assert.ok(enBd.entregadaEn)
    const [resena] = await resenasDe(orden.id)
    assert.equal(resena.cliente_id, ids.cliente)
    assert.equal(resena.emolientero_id, ids.emo)
    assert.equal(resena.calificacion, null, 'habilitada, pero aún sin calificar')

    const { rows } = await pool.query("SELECT 1 FROM notificaciones WHERE usuario_id = $1 AND tipo = 'resena_habilitada'", [ids.cliente])
    assert.equal(rows.length, 1)
    const mia = (await api('GET', '/api/ordenes/mias', { nombre: 'cliente' })).datos.find((o) => o.id === orden.id)
    assert.equal(mia.resenaHabilitada, true)
  })

  test('si no se puede habilitar la reseña, la orden NO queda entregada (todo o nada)', async () => {
    const o = await nuevaOrden()
    // Se fuerza el fallo del segundo paso: ya existe una reseña para esa orden (orden_id es único).
    await pool.query('INSERT INTO resenas (orden_id, cliente_id, emolientero_id) VALUES ($1, $2, $3)', [o.id, ids.cliente, ids.emo])
    const { status } = await entregar('emo', o.codigoRecojo)
    assert.notEqual(status, 200)
    const enBd = await ordenEnBd(o.id)
    assert.equal(enBd.estado, 'pendiente', 'se revirtió la entrega')
    assert.equal(enBd.entregadaEn, null, 'el código sigue sin usar')
  })
})

describe('T71: códigos que no se pueden usar', () => {
  test('código inexistente → 404', async () => {
    const { status, datos } = await entregar('emo', 'ZZZ-ZZZ')
    assert.equal(status, 404)
    assert.match(datos.error, /No existe un pedido con ese código/)
  })

  test('código ya usado → 409, y no se crea otra reseña', async () => {
    const o = await nuevaOrden()
    assert.equal((await entregar('emo', o.codigoRecojo)).status, 200)
    const { status, datos } = await entregar('emo', o.codigoRecojo)
    assert.equal(status, 409)
    assert.match(datos.error, /ya se usó/)
    assert.equal((await resenasDe(o.id)).length, 1)
  })

  test('código de otro emolientero → 403, y su pedido sigue pendiente', async () => {
    const o = await nuevaOrden('otro')
    const { status, datos } = await entregar('emo', o.codigoRecojo)
    assert.equal(status, 403)
    assert.match(datos.error, /otro emolientero/)
    assert.equal((await ordenEnBd(o.id)).estado, 'pendiente')
    assert.equal((await resenasDe(o.id)).length, 0)
  })

  test('pedido cancelado → 409', async () => {
    const o = await nuevaOrden()
    await pool.query("UPDATE ordenes SET estado = 'cancelada' WHERE id = $1", [o.id])
    assert.equal((await entregar('emo', o.codigoRecojo)).status, 409)
  })

  test('formato inválido → 400 con el error en el campo codigo', async () => {
    for (const malo of ['', 'ABC', 'ABC-23X-9', 'O0O-1I1', 123]) {
      const { status, datos } = await entregar('emo', malo)
      assert.equal(status, 400, String(malo))
      assert.ok(datos.campos.codigo)
    }
  })

  test('dos validaciones simultáneas del mismo código: solo una entrega', async () => {
    const o = await nuevaOrden()
    const resultados = await Promise.all([entregar('emo', o.codigoRecojo), entregar('emo', o.codigoRecojo)])
    assert.deepEqual(resultados.map((r) => r.status).sort(), [200, 409])
    assert.equal((await resenasDe(o.id)).length, 1)
  })
})
