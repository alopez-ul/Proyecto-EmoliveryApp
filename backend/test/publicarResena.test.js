// US17 - T84/T85/T86: publicar reseña contra la API real (BD de .env.local). Crea usuarios
// test-<id>@emolivery.test y los borra al terminar (órdenes, reseñas y notificaciones se borran en cascada).
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { app } from '../src/app.js'
import { pool } from '../src/db.js'
import { hashContrasena } from '../src/seguridad.js'
import { crearOrden } from '../src/codigoRecojo.js'
import { validarResena } from '../src/validaciones/resena.js'

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

// Pedido pagado de `cliente`; si `entregar`, el emolientero lo entrega con su código (US15), lo que habilita la reseña.
async function pedido(cliente, entregar = true) {
  const orden = await crearOrden(pool, { clienteId: ids[cliente], emolienteroId: ids.emo })
  await pool.query("UPDATE ordenes SET estado = 'pendiente', pagada_en = now() WHERE id = $1", [orden.id])
  if (entregar) assert.equal((await api('POST', '/api/ordenes/entregar', { nombre: 'emo', body: { codigo: orden.codigoRecojo } })).status, 200)
  return orden.id
}
const publicar = (cliente, ordenId, body) => api('POST', `/api/resenas/orden/${ordenId}`, { nombre: cliente, body })
const valida = { calificacion: 5, comentario: 'Muy rico y calientito, me atendieron rápido.' }

before(async () => {
  servidor = app.listen(0)
  base = `http://localhost:${servidor.address().port}`
  for (const [n, rol] of [['emo', 'emolientero'], ['ana', 'cliente'], ['beto', 'cliente']]) await crearUsuario(n, rol)
})

after(async () => {
  await pool.query('DELETE FROM usuarios WHERE correo LIKE $1', [`test-${SUFIJO}-%`])
  await pool.end()
  servidor.close()
})

describe('T84: validación (sin BD)', () => {
  test('acepta 1 a 5 estrellas con comentario', () => {
    assert.deepEqual(validarResena(valida).errores, {})
    assert.equal(validarResena({ ...valida, comentario: '  Bueno  ' }).datos.comentario, 'Bueno')
  })

  test('rechaza calificaciones fuera de 1-5 o no enteras', () => {
    for (const calificacion of [0, 6, 3.5, '4', undefined]) assert.ok(validarResena({ ...valida, calificacion }).errores.calificacion, String(calificacion))
  })

  test('el comentario es obligatorio y de hasta 500 caracteres', () => {
    assert.ok(validarResena({ ...valida, comentario: '   ' }).errores.comentario)
    assert.ok(validarResena({ ...valida, comentario: 'x'.repeat(501) }).errores.comentario)
  })
})

describe('T85/T86: publicar la reseña de un pedido entregado', () => {
  let ordenId

  test('el cliente publica su reseña y se avisa al emolientero', async () => {
    ordenId = await pedido('ana')
    const { status, datos } = await publicar('ana', ordenId, valida)
    assert.equal(status, 201)
    assert.equal(datos.calificacion, 5)
    assert.ok(datos.publicadaEn)
    const aviso = await pool.query("SELECT titulo FROM notificaciones WHERE usuario_id = $1 AND tipo = 'nueva_resena'", [ids.emo])
    assert.equal(aviso.rowCount, 1)
  })

  test('aparece en las reseñas públicas del emolientero (US18), con su promedio', async () => {
    const { datos } = await api('GET', `/api/resenas/emolientero/${ids.emo}`)
    assert.equal(datos.total, 1)
    assert.equal(datos.promedio, 5)
  })

  test('"Mis pedidos" muestra que ya la publicó', async () => {
    const mio = (await api('GET', '/api/ordenes/mias', { nombre: 'ana' })).datos.find((o) => o.id === ordenId)
    assert.equal(mio.resenaPublicada, true)
    assert.equal(mio.calificacion, 5)
  })

  test('T85: no se puede publicar dos veces la misma (409)', async () => {
    const { status, datos } = await publicar('ana', ordenId, { calificacion: 1, comentario: 'Cambio de opinión' })
    assert.equal(status, 409)
    assert.match(datos.error, /Ya has publicado una reseña/)
  })

  test('el promedio se recalcula con una segunda reseña', async () => {
    const otro = await pedido('ana')
    assert.equal((await publicar('ana', otro, { calificacion: 2, comentario: 'Llegó frío.' })).status, 201)
    assert.equal((await api('GET', `/api/resenas/emolientero/${ids.emo}`)).datos.promedio, 3.5)
  })
})

describe('T84: solo sobre una compra propia y entregada', () => {
  test('el pedido de otro cliente no existe para él (404)', async () => {
    const ordenId = await pedido('ana')
    assert.equal((await publicar('beto', ordenId, valida)).status, 404)
  })

  test('un pedido aún no entregado no se puede calificar (409)', async () => {
    const ordenId = await pedido('beto', false)
    const { status, datos } = await publicar('beto', ordenId, valida)
    assert.equal(status, 409)
    assert.match(datos.error, /ya hayan sido entregados/)
  })

  test('datos inválidos → 400 con el error de cada campo; sin sesión 401; un emolientero 403', async () => {
    const ordenId = await pedido('beto')
    const { status, datos } = await publicar('beto', ordenId, { calificacion: 9, comentario: '' })
    assert.equal(status, 400)
    assert.deepEqual(Object.keys(datos.campos).sort(), ['calificacion', 'comentario'])
    assert.equal((await api('POST', `/api/resenas/orden/${ordenId}`, { body: valida })).status, 401)
    assert.equal((await publicar('emo', ordenId, valida)).status, 403)
  })
})
