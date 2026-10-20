// US05: pruebas del registro de ubicación contra la API real (BD de .env.local).
// Crea usuarios propios (test-<id>@emolivery.test) y los borra al terminar.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { app } from '../src/app.js'
import { pool } from '../src/db.js'
import { hashContrasena } from '../src/seguridad.js'

const SUFIJO = randomBytes(4).toString('hex')
const PASSWORD = 'Prueba1234'
const correo = (n) => `test-${SUFIJO}-${n}@emolivery.test`
const EN_LA_MOLINA = { lat: -12.0867, lng: -76.9405, precision: 15 }
let servidor, base
const tokens = {}

async function crearUsuario(nombre, rol, estado) {
  await pool.query('INSERT INTO usuarios (nombre, correo, password_hash, rol, estado) VALUES ($1, $2, $3, $4, $5)', [
    `Test ${nombre}`, correo(nombre), await hashContrasena(PASSWORD), rol, estado,
  ])
}

async function api(metodo, ruta, { token, body } = {}) {
  const res = await fetch(base + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  })
  return { status: res.status, datos: await res.json().catch(() => null) }
}

before(async () => {
  servidor = app.listen(0)
  base = `http://localhost:${servidor.address().port}`
  await crearUsuario('emolientero', 'emolientero', 'activo')
  await crearUsuario('pendiente', 'emolientero', 'pendiente_verificacion')
  await crearUsuario('cliente', 'cliente', 'activo')
  for (const n of ['emolientero', 'cliente']) {
    tokens[n] = (await api('POST', '/api/auth/login', { body: { correo: correo(n), password: PASSWORD } })).datos.token
  }
})

after(async () => {
  await pool.query('DELETE FROM usuarios WHERE correo LIKE $1', [`test-${SUFIJO}-%`])
  await pool.end()
  servidor.close()
})

describe('US05: registrar ubicación', () => {
  test('sin sesión responde 401', async () => {
    assert.equal((await api('POST', '/api/ubicaciones', { body: EN_LA_MOLINA })).status, 401)
  })

  test('un cliente no puede registrar ubicación (403)', async () => {
    assert.equal((await api('POST', '/api/ubicaciones', { token: tokens.cliente, body: EN_LA_MOLINA })).status, 403)
  })

  test('un emolientero pendiente de verificación ni siquiera inicia sesión', async () => {
    const r = await api('POST', '/api/auth/login', { body: { correo: correo('pendiente'), password: PASSWORD } })
    assert.equal(r.status, 403)
  })

  test('caso exitoso: guarda coordenada con fecha y hora (201)', async () => {
    const { status, datos } = await api('POST', '/api/ubicaciones', { token: tokens.emolientero, body: EN_LA_MOLINA })
    assert.equal(status, 201)
    assert.equal(datos.lat, EN_LA_MOLINA.lat)
    assert.equal(datos.fuente, 'gps_emolientero')
    assert.ok(!Number.isNaN(new Date(datos.registradaEn).getTime()))
  })

  test('fuera de La Molina: rechaza con el mensaje del criterio (422) y no guarda', async () => {
    const antes = (await pool.query('SELECT count(*)::int n FROM ubicaciones')).rows[0].n
    const r = await api('POST', '/api/ubicaciones', { token: tokens.emolientero, body: { lat: -12.0464, lng: -77.0306, precision: 10 } })
    assert.equal(r.status, 422)
    assert.equal(r.datos.error, 'Ubicación fuera de la zona de cobertura.')
    assert.equal((await pool.query('SELECT count(*)::int n FROM ubicaciones')).rows[0].n, antes)
  })

  test('precisión peor que 50 m: rechaza (422)', async () => {
    const r = await api('POST', '/api/ubicaciones', { token: tokens.emolientero, body: { ...EN_LA_MOLINA, precision: 120 } })
    assert.equal(r.status, 422)
    assert.match(r.datos.error, /precisión/)
  })

  test('datos mal formados: 400', async () => {
    for (const body of [{}, { lat: 'x', lng: 'y', precision: 5 }, { lat: EN_LA_MOLINA.lat, lng: EN_LA_MOLINA.lng }]) {
      assert.equal((await api('POST', '/api/ubicaciones', { token: tokens.emolientero, body })).status, 400)
    }
  })
})

describe('US05: consultar ubicación', () => {
  test('/mia devuelve la última ubicación registrada', async () => {
    const nueva = { ...EN_LA_MOLINA, lat: -12.09 }
    await api('POST', '/api/ubicaciones', { token: tokens.emolientero, body: nueva })
    const { status, datos } = await api('GET', '/api/ubicaciones/mia', { token: tokens.emolientero })
    assert.equal(status, 200)
    assert.equal(datos.lat, -12.09)
  })

  test('sin jornada abierta (US06) el emolientero no aparece en el listado público', async () => {
    const { datos } = await api('GET', '/api/ubicaciones')
    assert.ok(!datos.some((u) => u.nombre === 'Test emolientero'))
  })

  test('el listado público trae una sola ubicación (la más reciente) por emolientero', async () => {
    // Con la jornada abierta ya aparece en el mapa.
    assert.equal((await api('POST', '/api/jornadas/abrir', { token: tokens.emolientero })).status, 201)
    const { status, datos } = await api('GET', '/api/ubicaciones')
    assert.equal(status, 200)
    const mias = datos.filter((u) => u.nombre === 'Test emolientero')
    assert.equal(mias.length, 1)
    assert.equal(mias[0].lat, -12.09)
  })
})
