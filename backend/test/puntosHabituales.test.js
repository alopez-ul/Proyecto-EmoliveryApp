// US10 - T49: puntos habituales contra la API real (BD de .env.local).
// Crea usuarios test-<id>@emolivery.test y los borra al terminar (sus puntos se borran en cascada).
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { app } from '../src/app.js'
import { pool } from '../src/db.js'
import { hashContrasena } from '../src/seguridad.js'
import { PatronHistorico } from '../src/fuentes/patronHistorico.js'

const SUFIJO = randomBytes(4).toString('hex')
const PASSWORD = 'Prueba1234'
const correo = (n) => `test-${SUFIJO}-${n}@emolivery.test`
const EN_LA_MOLINA = { lat: -12.0867, lng: -76.9405 }
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

const punto = (cambios) => ({ referencia: 'Parque Los Fresnos', ...EN_LA_MOLINA, diaSemana: 1, horaInicio: '07:00', horaFin: '10:00', ...cambios })
const crear = (nombre, cambios) => api('POST', '/api/puntos-habituales', { nombre, body: punto(cambios) })

before(async () => {
  servidor = app.listen(0)
  base = `http://localhost:${servidor.address().port}`
  for (const [n, rol] of [['emo', 'emolientero'], ['emo2', 'emolientero'], ['patron', 'emolientero'], ['cliente', 'cliente']]) {
    await crearUsuario(n, rol)
  }
})

after(async () => {
  await pool.query('DELETE FROM usuarios WHERE correo LIKE $1', [`test-${SUFIJO}-%`])
  await pool.end()
  servidor.close()
})

describe('US10: acceso', () => {
  test('sin sesión responde 401 y un cliente recibe 403', async () => {
    assert.equal((await api('GET', '/api/puntos-habituales')).status, 401)
    assert.equal((await crear('cliente')).status, 403)
  })
})

describe('US10: registro de puntos habituales', () => {
  test('registra un punto válido', async () => {
    const { status, datos } = await crear('emo')
    assert.equal(status, 201)
    assert.equal(datos.horaInicio, '07:00')
    assert.equal(datos.horaFin, '10:00')
    assert.equal(datos.diaSemana, 1)
  })

  test('T49: hora de fin anterior al inicio → 400 con el error en horaFin', async () => {
    const { status, datos } = await crear('emo', { diaSemana: 2, horaInicio: '10:00', horaFin: '07:00' })
    assert.equal(status, 400)
    assert.equal(datos.campos.horaFin, 'La hora de fin debe ser posterior a la hora de inicio.')
  })

  test('T49: un horario que se cruza con otro del mismo día → 409 con el punto en conflicto', async () => {
    const { status, datos } = await crear('emo', { referencia: 'Óvalo La Molina', horaInicio: '09:00', horaFin: '12:00' })
    assert.equal(status, 409)
    assert.match(datos.error, /Parque Los Fresnos/)
  })

  test('un horario contiguo y el mismo horario en otro día sí se aceptan', async () => {
    assert.equal((await crear('emo', { referencia: 'Óvalo La Molina', horaInicio: '10:00', horaFin: '12:00' })).status, 201)
    assert.equal((await crear('emo', { diaSemana: 3 })).status, 201)
  })

  test('el mismo horario de otro emolientero no es conflicto', async () => {
    assert.equal((await crear('emo2')).status, 201)
  })

  test('dos registros simultáneos que se cruzan: solo uno se crea', async () => {
    const resultados = await Promise.all([
      crear('emo2', { diaSemana: 6, horaInicio: '15:00', horaFin: '17:00' }),
      crear('emo2', { diaSemana: 6, horaInicio: '16:00', horaFin: '18:00' }),
    ])
    assert.deepEqual(resultados.map((r) => r.status).sort(), [201, 409])
  })

  test('la lista sale ordenada por día y hora', async () => {
    const { datos } = await api('GET', '/api/puntos-habituales', { nombre: 'emo' })
    assert.deepEqual(datos.map((p) => `${p.diaSemana} ${p.horaInicio}`), ['1 07:00', '1 10:00', '3 07:00'])
  })

  test('solo se puede eliminar un punto propio', async () => {
    const [propio] = (await api('GET', '/api/puntos-habituales', { nombre: 'emo' })).datos
    assert.equal((await api('DELETE', `/api/puntos-habituales/${propio.id}`, { nombre: 'emo2' })).status, 404)
    assert.equal((await api('DELETE', `/api/puntos-habituales/${propio.id}`, { nombre: 'emo' })).status, 204)
    assert.equal((await api('GET', '/api/puntos-habituales', { nombre: 'emo' })).datos.length, 2)
  })
})

describe('US10 - T48: ubicaciones estimadas por PatronHistorico', () => {
  const estimadaDe = async (nombre) =>
    (await api('GET', '/api/ubicaciones/estimadas')).datos.find((u) => u.emolienteroId === ids[nombre])

  test('sin jornada abierta, aparece en su punto habitual de este momento con baja precisión', async () => {
    const { diaSemana } = PatronHistorico.momentoEnLima(new Date())
    assert.equal((await crear('patron', { referencia: 'Todo el día', diaSemana, horaInicio: '00:00', horaFin: '23:59' })).status, 201)
    const estimada = await estimadaDe('patron')
    assert.ok(estimada, 'debería salir en las estimadas')
    assert.equal(estimada.fuente, 'horario_habitual')
    assert.equal(estimada.precisionM, PatronHistorico.PRECISION_M)
    assert.equal(estimada.referencia, 'Todo el día')
  })

  test('con la jornada abierta deja de estimarse (manda el GPS)', async () => {
    await pool.query('INSERT INTO jornadas (emolientero_id) VALUES ($1)', [ids.patron])
    assert.equal(await estimadaDe('patron'), undefined)
  })
})
