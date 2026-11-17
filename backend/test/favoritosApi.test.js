// US21 con datos reales: favoritos, preferencias y avisos al abrir jornada, contra la API (BD de .env.local).
// Crea usuarios test-<id>@emolivery.test y los borra al terminar (sus favoritos y avisos se borran en cascada).
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { app } from '../src/app.js'
import { pool } from '../src/db.js'
import { hashContrasena } from '../src/seguridad.js'
import { decidirAviso, zonaDe } from '../src/avisosFavoritos.js'

const SUFIJO = randomBytes(4).toString('hex')
const PASSWORD = 'Prueba1234'
const correo = (n) => `test-${SUFIJO}-${n}@emolivery.test`
const LA_FONTANA = { lat: -12.0748, lng: -76.9508 }
const RINCONADA = { lat: -12.0915, lng: -76.9235 }
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

// El emolientero registra su GPS en `punto` y abre su jornada (cerrando antes la anterior si hay).
async function abrirJornadaEn(nombre, punto) {
  await pool.query('UPDATE jornadas SET cerrada_en = now() WHERE emolientero_id = $1 AND cerrada_en IS NULL', [ids[nombre]])
  await pool.query('INSERT INTO ubicaciones (emolientero_id, lat, lng, precision_m) VALUES ($1, $2, $3, 10)', [ids[nombre], punto.lat, punto.lng])
  return api('POST', '/api/jornadas/abrir', { nombre })
}
const avisosDe = async (cliente) => (await api('GET', '/api/favoritos', { nombre: cliente })).datos.avisos
const notificacionesDe = async (cliente) =>
  (await pool.query("SELECT titulo FROM notificaciones WHERE usuario_id = $1 AND tipo = 'favorito_abrio'", [ids[cliente]])).rows

before(async () => {
  servidor = app.listen(0)
  base = `http://localhost:${servidor.address().port}`
  for (const [n, rol] of [['emo', 'emolientero'], ['ana', 'cliente'], ['beto', 'cliente'], ['ciro', 'cliente']]) await crearUsuario(n, rol)
})

after(async () => {
  await pool.query('DELETE FROM usuarios WHERE correo LIKE $1', [`test-${SUFIJO}-%`])
  await pool.end()
  servidor.close()
})

describe('Reglas de aviso (sin BD)', () => {
  test('la zona es la del centro más cercano', () => {
    assert.equal(zonaDe(LA_FONTANA), 'La Fontana')
    assert.equal(zonaDe(RINCONADA), 'Rinconada')
  })

  test('T95: se avisa con los avisos activos y en una zona de interés (o sin zonas elegidas)', () => {
    assert.equal(decidirAviso({ avisosActivos: true, zonas: ['La Fontana'] }, 'La Fontana').enviar, true)
    assert.equal(decidirAviso({ avisosActivos: true, zonas: [] }, 'Musa').enviar, true)
  })

  test('T96: no se avisa con los avisos desactivados o fuera de sus zonas', () => {
    assert.equal(decidirAviso({ avisosActivos: false, zonas: [] }, 'Musa').enviar, false)
    assert.equal(decidirAviso({ avisosActivos: true, zonas: ['Camacho'] }, 'Musa').enviar, false)
  })
})

describe('T93: marcar y desmarcar favoritos', () => {
  test('solo un cliente con sesión (401 / 403)', async () => {
    assert.equal((await api('GET', '/api/favoritos')).status, 401)
    assert.equal((await api('GET', '/api/favoritos', { nombre: 'emo' })).status, 403)
  })

  test('marca un emolientero real y aparece en sus favoritos y en el directorio', async () => {
    assert.equal((await api('POST', `/api/favoritos/${ids.emo}`, { nombre: 'ana' })).status, 201)
    assert.equal((await api('POST', `/api/favoritos/${ids.emo}`, { nombre: 'ana' })).status, 201, 'marcar dos veces no duplica')
    const { datos } = await api('GET', '/api/favoritos', { nombre: 'ana' })
    assert.deepEqual(datos.favoritos.map((f) => f.id), [ids.emo])
    const directorio = (await api('GET', '/api/favoritos/directorio', { nombre: 'ana' })).datos
    assert.equal(directorio.find((e) => e.id === ids.emo).favorito, true)
  })

  test('no se puede marcar a quien no es un emolientero activo (404)', async () => {
    assert.equal((await api('POST', `/api/favoritos/${ids.beto}`, { nombre: 'ana' })).status, 404)
    assert.equal((await api('POST', '/api/favoritos/no-es-un-id', { nombre: 'ana' })).status, 404)
  })

  test('desmarcar lo quita', async () => {
    await api('POST', `/api/favoritos/${ids.emo}`, { nombre: 'ciro' })
    assert.equal((await api('DELETE', `/api/favoritos/${ids.emo}`, { nombre: 'ciro' })).status, 200)
    assert.equal((await api('GET', '/api/favoritos', { nombre: 'ciro' })).datos.favoritos.length, 0)
  })
})

describe('Preferencias de aviso', () => {
  test('por defecto: avisos activos y cualquier zona', async () => {
    assert.deepEqual((await api('GET', '/api/favoritos', { nombre: 'beto' })).datos.preferencias, { avisosActivos: true, zonas: [] })
  })

  test('guarda zonas válidas y rechaza las que no existen (400)', async () => {
    const ok = await api('PUT', '/api/favoritos/preferencias', { nombre: 'beto', body: { avisosActivos: true, zonas: ['Camacho'] } })
    assert.deepEqual(ok.datos, { avisosActivos: true, zonas: ['Camacho'] })
    const mal = await api('PUT', '/api/favoritos/preferencias', { nombre: 'beto', body: { avisosActivos: true, zonas: ['Miraflores'] } })
    assert.equal(mal.status, 400)
  })
})

describe('T95/T96: avisos al abrir jornada', () => {
  before(async () => {
    // ana: avisos en La Fontana. beto: solo Camacho. ciro: avisos desactivados. Los tres lo tienen de favorito.
    await api('PUT', '/api/favoritos/preferencias', { nombre: 'ana', body: { avisosActivos: true, zonas: ['La Fontana'] } })
    await api('POST', `/api/favoritos/${ids.emo}`, { nombre: 'beto' })
    await api('POST', `/api/favoritos/${ids.emo}`, { nombre: 'ciro' })
    await api('PUT', '/api/favoritos/preferencias', { nombre: 'ciro', body: { avisosActivos: false, zonas: [] } })
  })

  test('al abrir en La Fontana solo se avisa a quien corresponde, y a todos se les registra', async () => {
    const { status, datos } = await abrirJornadaEn('emo', LA_FONTANA)
    assert.equal(status, 201)
    assert.equal(datos.avisosEnviados, 1)

    assert.equal((await notificacionesDe('ana')).length, 1)
    assert.match((await notificacionesDe('ana'))[0].titulo, /abrió su jornada en La Fontana/)
    assert.equal((await notificacionesDe('beto')).length, 0)
    assert.equal((await notificacionesDe('ciro')).length, 0)

    const [deBeto] = await avisosDe('beto')
    assert.equal(deBeto.enviado, false)
    assert.match(deBeto.motivo, /fuera de tus zonas/)
    const [deCiro] = await avisosDe('ciro')
    assert.match(deCiro.motivo, /avisos desactivados/)
  })

  test('al abrir en Camacho ahora sí se le avisa a beto, y ya no a ana', async () => {
    const { datos } = await abrirJornadaEn('emo', { lat: -12.0855, lng: -76.9665 })
    assert.equal(datos.avisosEnviados, 1)
    assert.equal((await notificacionesDe('beto')).length, 1)
    assert.equal((await notificacionesDe('ana')).length, 1, 'ana sigue con su único aviso')
  })

  test('el favorito aparece atendiendo y con su zona', async () => {
    const [fav] = (await api('GET', '/api/favoritos', { nombre: 'beto' })).datos.favoritos
    assert.equal(fav.atendiendo, true)
    assert.equal(fav.zona, 'Camacho')
  })
})
