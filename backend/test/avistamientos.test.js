// US09 - T82: confirmación de avistamiento contra la API real (BD de .env.local).
// Crea usuarios test-<id>@emolivery.test y los borra al terminar (sus ubicaciones y avistamientos se borran en cascada).
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { app } from '../src/app.js'
import { pool } from '../src/db.js'
import { hashContrasena } from '../src/seguridad.js'

const SUFIJO = randomBytes(4).toString('hex')
const PASSWORD = 'Prueba1234'
const correo = (n) => `test-${SUFIJO}-${n}@emolivery.test`
const CENTRO = { lat: -12.0867, lng: -76.9405 }
const alNorte = (metros) => ({ lat: CENTRO.lat + metros / 111_320, lng: CENTRO.lng, precision: 15 })
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

const confirmar = (cliente, emolientero, punto) =>
  api('POST', '/api/avistamientos', { nombre: cliente, body: { emolienteroId: ids[emolientero], ...punto } })
const filasDe = async (emolientero, fuente) =>
  (await pool.query('SELECT * FROM ubicaciones WHERE emolientero_id = $1 AND fuente = $2', [ids[emolientero], fuente])).rows

before(async () => {
  servidor = app.listen(0)
  base = `http://localhost:${servidor.address().port}`
  for (const [n, rol] of [['emo', 'emolientero'], ['cerrado', 'emolientero'], ['c1', 'cliente'], ['c2', 'cliente'], ['c3', 'cliente']]) {
    await crearUsuario(n, rol)
  }
  // 'emo' atiende en el CENTRO con GPS de 10 m; 'cerrado' tiene GPS pero no abrió su jornada.
  for (const n of ['emo', 'cerrado']) {
    await pool.query('INSERT INTO ubicaciones (emolientero_id, lat, lng, precision_m) VALUES ($1, $2, $3, 10)', [ids[n], CENTRO.lat, CENTRO.lng])
  }
  await pool.query('INSERT INTO jornadas (emolientero_id) VALUES ($1)', [ids.emo])
})

after(async () => {
  await pool.query('DELETE FROM usuarios WHERE correo LIKE $1', [`test-${SUFIJO}-%`])
  await pool.end()
  servidor.close()
})

describe('US09: acceso', () => {
  test('sin sesión 401; un emolientero no confirma avistamientos (403)', async () => {
    assert.equal((await api('POST', '/api/avistamientos', { body: {} })).status, 401)
    assert.equal((await confirmar('emo', 'emo', alNorte(10))).status, 403)
  })
})

describe('T79/T82: radio de 100 metros', () => {
  test('T82: fuera de radio (150 m) → 422 con la distancia, y no se guarda nada', async () => {
    const { status, datos } = await confirmar('c1', 'emo', alNorte(150))
    assert.equal(status, 422)
    assert.match(datos.error, /Estás a 150 m del emolientero/)
    assert.equal((await filasDe('emo', 'avistamiento_cliente')).length, 0)
  })

  test('dentro del radio (50 m) se confirma como avistamiento de cliente', async () => {
    const { status, datos } = await confirmar('c1', 'emo', alNorte(50))
    assert.equal(status, 201)
    assert.equal(datos.avistamiento.distanciaM, 50)
    assert.equal(datos.verificado, false)
    assert.equal((await filasDe('emo', 'avistamiento_cliente')).length, 1)
  })

  test('justo en el límite (99 m) también se acepta', async () => {
    assert.equal((await confirmar('c3', 'emo', alNorte(99))).status, 201)
  })

  test('un emolientero sin jornada abierta no se puede confirmar (422)', async () => {
    const { status, datos } = await confirmar('c1', 'cerrado', alNorte(10))
    assert.equal(status, 422)
    assert.match(datos.error, /no está atendiendo/)
  })

  test('emolientero inexistente → 404; GPS impreciso o fuera de La Molina → 422', async () => {
    const r = await api('POST', '/api/avistamientos', { nombre: 'c1', body: { emolienteroId: '00000000-0000-4000-8000-000000000000', ...alNorte(10) } })
    assert.equal(r.status, 404)
    assert.equal((await confirmar('c2', 'emo', { ...alNorte(10), precision: 80 })).status, 422)
    assert.equal((await confirmar('c2', 'emo', { lat: -12.0464, lng: -77.0306, precision: 10 })).status, 422)
  })
})

describe('T81/T82: confirmación repetida', () => {
  test('T82: el mismo cliente confirma otra vez en la misma ventana → 409', async () => {
    const { status, datos } = await confirmar('c1', 'emo', alNorte(20))
    assert.equal(status, 409)
    assert.match(datos.error, /Ya confirmaste a este emolientero/)
    assert.equal((await filasDe('emo', 'avistamiento_cliente')).length, 2, 'solo las de c1 y c3')
  })

  test('dos confirmaciones simultáneas del mismo cliente: solo una se guarda', async () => {
    await pool.query('DELETE FROM avistamientos WHERE cliente_id = $1', [ids.c3])
    const resultados = await Promise.all([confirmar('c3', 'emo', alNorte(10)), confirmar('c3', 'emo', alNorte(12))])
    assert.deepEqual(resultados.map((r) => r.status).sort(), [201, 409])
    const { rows } = await pool.query('SELECT count(*)::int n FROM avistamientos WHERE cliente_id = $1', [ids.c3])
    assert.equal(rows[0].n, 1)
  })
})

describe('T80: AvistamientoVerificado por coincidencia de reportes', () => {
  test('al coincidir clientes distintos se registra un avistamiento verificado', async () => {
    // c1 y c3 ya confirmaron dentro del radio: con c2 ya hay coincidencia (las de c3 se verificaron antes).
    const antes = (await filasDe('emo', 'avistamiento_verificado')).length
    const { status, datos } = await confirmar('c2', 'emo', alNorte(30))
    assert.equal(status, 201)
    assert.equal(datos.verificado, true)
    assert.ok(datos.confirmaciones >= 2)
    const verificados = await filasDe('emo', 'avistamiento_verificado')
    assert.equal(verificados.length, antes + 1)
    const ultimo = verificados.at(-1)
    assert.ok(Math.abs(ultimo.lat - CENTRO.lat) * 111_320 < 100, 'en el punto medio de los reportes, cerca del emolientero')
  })
})
