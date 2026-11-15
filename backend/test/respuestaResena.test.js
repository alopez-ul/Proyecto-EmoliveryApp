// US19 - T92: respuesta del emolientero a una reseña, contra la API real (BD de .env.local).
// Crea usuarios test-<id>@emolivery.test y los borra al terminar (órdenes y reseñas se borran en cascada).
// Las reseñas publicadas (US17) y las ocultas (US25) se preparan directo en la BD.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { app } from '../src/app.js'
import { pool } from '../src/db.js'
import { hashContrasena } from '../src/seguridad.js'
import { crearOrden } from '../src/codigoRecojo.js'
import { validarRespuesta, verificarRespondible } from '../src/respuestaResena.js'

const SUFIJO = randomBytes(4).toString('hex')
const PASSWORD = 'Prueba1234'
const correo = (n) => `test-${SUFIJO}-${n}@emolivery.test`
let servidor, base
const ids = {}
const tokens = {}

async function api(metodo, ruta, { nombre, body } = {}) {
  const res = await fetch(base + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(nombre && { Authorization: `Bearer ${tokens[nombre]}` }) },
    body: body && JSON.stringify(body),
  })
  return { status: res.status, datos: await res.json().catch(() => null) }
}

async function crearUsuario(nombre, rol) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre, correo, password_hash, rol, estado) VALUES ($1, $2, $3, $4, 'activo') RETURNING id`,
    [`Test ${nombre}`, correo(nombre), await hashContrasena(PASSWORD), rol],
  )
  ids[nombre] = rows[0].id
  tokens[nombre] = (await api('POST', '/api/auth/login', { body: { correo: correo(nombre), password: PASSWORD } })).datos.token
}

// Reseña sobre una orden entregada. publicada=false deja la reseña solo habilitada (US15, sin calificación).
async function crearResena({ emolientero = 'emo', publicada = true, oculta = false } = {}) {
  const orden = await crearOrden(pool, { clienteId: ids.cliente, emolienteroId: ids[emolientero] })
  await pool.query("UPDATE ordenes SET estado = 'entregada', entregada_en = now() WHERE id = $1", [orden.id])
  const { rows: [resena] } = await pool.query(
    `INSERT INTO resenas (orden_id, cliente_id, emolientero_id, calificacion, comentario, publicada_en, oculta_en)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [orden.id, ids.cliente, ids[emolientero], publicada ? 4 : null, publicada ? 'Muy rico el emoliente' : null,
      publicada ? new Date() : null, oculta ? new Date() : null],
  )
  return resena.id
}

const responder = (id, respuesta = 'Gracias por tu visita, te esperamos.', nombre = 'emo') =>
  api('POST', `/api/resenas/${id}/respuesta`, { nombre, body: { respuesta } })

before(async () => {
  servidor = app.listen(0)
  base = `http://localhost:${servidor.address().port}`
  for (const [n, rol] of [['emo', 'emolientero'], ['otroEmo', 'emolientero'], ['cliente', 'cliente']]) await crearUsuario(n, rol)
})

after(async () => {
  await pool.query('DELETE FROM usuarios WHERE correo LIKE $1', [`test-${SUFIJO}-%`])
  await pool.end()
  servidor.close()
})

describe('US19: reglas de la respuesta (unitarias)', () => {
  test('valida el largo de la respuesta y la normaliza', () => {
    assert.deepEqual(validarRespuesta({ respuesta: '  ¡Gracias   por venir!  ' }), { datos: { respuesta: '¡Gracias por venir!' }, errores: {} })
    assert.ok(validarRespuesta({ respuesta: ' ' }).errores.respuesta)
    assert.ok(validarRespuesta({ respuesta: 'x'.repeat(501) }).errores.respuesta)
    assert.ok(validarRespuesta({}).errores.respuesta)
  })

  test('verificarRespondible distingue cada bloqueo', () => {
    const base = { emolienteroId: 'e1', publicadaEn: new Date(), ocultaEn: null, respuesta: null }
    assert.doesNotThrow(() => verificarRespondible(base, 'e1'))
    assert.throws(() => verificarRespondible(base, 'otro'), { status: 404 })
    assert.throws(() => verificarRespondible(null, 'e1'), { status: 404 })
    assert.throws(() => verificarRespondible({ ...base, publicadaEn: null }, 'e1'), { status: 404 })
    assert.throws(() => verificarRespondible({ ...base, ocultaEn: new Date() }, 'e1'), { status: 409 })
    assert.throws(() => verificarRespondible({ ...base, respuesta: 'Hola' }, 'e1'), { status: 409 })
  })
})

describe('US19: acceso', () => {
  test('sin sesión 401; un cliente no puede responder (403)', async () => {
    const id = await crearResena()
    assert.equal((await api('POST', `/api/resenas/${id}/respuesta`, { body: { respuesta: 'Hola a todos' } })).status, 401)
    assert.equal((await responder(id, 'Hola a todos', 'cliente')).status, 403)
  })
})

describe('US19 - T90: respuesta vinculada a la reseña', () => {
  test('publica la respuesta, avisa al cliente y se ve bajo la reseña en la vista pública (US18)', async () => {
    const id = await crearResena()
    const { status, datos } = await responder(id, 'Gracias, vuelve pronto.')
    assert.equal(status, 201)
    assert.equal(datos.respuesta, 'Gracias, vuelve pronto.')
    assert.ok(datos.respondidaEn)

    const publica = (await api('GET', `/api/resenas/emolientero/${ids.emo}`)).datos
    assert.equal(publica.resenas.find((r) => r.id === id).respuesta, 'Gracias, vuelve pronto.')

    const { rowCount } = await pool.query("SELECT 1 FROM notificaciones WHERE usuario_id = $1 AND tipo = 'resena_respondida'", [ids.cliente])
    assert.ok(rowCount >= 1)
  })

  test('el emolientero ve sus reseñas, incluidas las ocultas marcadas como tales', async () => {
    const visible = await crearResena()
    const oculta = await crearResena({ oculta: true })
    const habilitada = await crearResena({ publicada: false })
    const mias = (await api('GET', '/api/resenas/mias', { nombre: 'emo' })).datos
    assert.equal(mias.find((r) => r.id === visible).oculta, false)
    assert.equal(mias.find((r) => r.id === oculta).oculta, true)
    assert.ok(!mias.some((r) => r.id === habilitada), 'una reseña sin publicar no aparece')
    assert.equal(mias[0].autor, 'Test C.', 'el autor se muestra con nombre e inicial, como en la vista pública')
  })

  test('una respuesta vacía o demasiado larga responde 400', async () => {
    const id = await crearResena()
    assert.equal((await responder(id, ' ')).status, 400)
    assert.equal((await responder(id, 'x'.repeat(501))).status, 400)
  })
})

describe('US19 - T91 + T92: bloqueos', () => {
  test('respuesta duplicada: la segunda responde 409 y se conserva la primera', async () => {
    const id = await crearResena()
    assert.equal((await responder(id, 'Primera respuesta')).status, 201)
    const { status, datos } = await responder(id, 'Segunda respuesta')
    assert.equal(status, 409)
    assert.match(datos.error, /Ya respondiste/)
    const { rows: [r] } = await pool.query('SELECT respuesta FROM resenas WHERE id = $1', [id])
    assert.equal(r.respuesta, 'Primera respuesta')
  })

  test('reseña oculta por moderación: 409 y no se guarda la respuesta', async () => {
    const id = await crearResena({ oculta: true })
    const { status, datos } = await responder(id)
    assert.equal(status, 409)
    assert.match(datos.error, /ocultada por moderación/)
    const { rows: [r] } = await pool.query('SELECT respuesta FROM resenas WHERE id = $1', [id])
    assert.equal(r.respuesta, null)
  })

  test('dos respuestas simultáneas: solo una se guarda', async () => {
    const id = await crearResena()
    const resultados = await Promise.all([responder(id, 'Respuesta A'), responder(id, 'Respuesta B')])
    assert.deepEqual(resultados.map((r) => r.status).sort(), [201, 409])
  })

  test('la reseña de otro emolientero, una sin publicar o inexistente responde 404', async () => {
    assert.equal((await responder(await crearResena({ emolientero: 'otroEmo' }))).status, 404)
    assert.equal((await responder(await crearResena({ publicada: false }))).status, 404)
    assert.equal((await responder(999999999)).status, 404)
  })
})
