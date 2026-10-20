// US06: apertura y cierre de jornada contra la BD de .env.local. Crea usuarios test-<id>@emolivery.test y los borra al terminar.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { app } from '../src/app.js'
import { pool } from '../src/db.js'
import { hashContrasena } from '../src/seguridad.js'

const SUFIJO = randomBytes(4).toString('hex')
const PASSWORD = 'Prueba1234'
const correo = (nombre) => `test-${SUFIJO}-${nombre}@emolivery.test`
let servidor, base
const ids = {}
const tokens = {}

async function crearUsuario(nombre, rol) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre, correo, password_hash, rol, estado) VALUES ($1, $2, $3, $4, 'activo') RETURNING id`,
    [`Test ${nombre}`, correo(nombre), await hashContrasena(PASSWORD), rol],
  )
  ids[nombre] = rows[0].id
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: correo(nombre), password: PASSWORD }),
  })
  tokens[nombre] = (await res.json()).token
}

// Ubicación dentro de La Molina, insertada directo (la ruta de US05 tiene sus propias pruebas).
const registrarUbicacion = (nombre, haceHoras = 0) =>
  pool.query(
    `INSERT INTO ubicaciones (emolientero_id, lat, lng, precision_m, registrada_en)
     VALUES ($1, -12.08, -76.93, 10, now() - make_interval(hours => $2))`,
    [ids[nombre], haceHoras],
  )

async function api(metodo, ruta, nombre) {
  const res = await fetch(base + ruta, { method: metodo, headers: nombre ? { Authorization: `Bearer ${tokens[nombre]}` } : {} })
  return { status: res.status, datos: await res.json().catch(() => null) }
}

before(async () => {
  servidor = app.listen(0)
  base = `http://localhost:${servidor.address().port}`
  await crearUsuario('emo', 'emolientero')
  await crearUsuario('emo2', 'emolientero')
  await crearUsuario('cliente', 'cliente')
})

after(async () => {
  await pool.query('DELETE FROM usuarios WHERE correo LIKE $1', [`test-${SUFIJO}-%`])
  await pool.end()
  servidor.close()
})

describe('US06: acceso', () => {
  test('sin sesión responde 401 y un cliente recibe 403', async () => {
    assert.equal((await api('GET', '/api/jornadas/estado')).status, 401)
    assert.equal((await api('GET', '/api/jornadas/estado', 'cliente')).status, 403)
  })
})

describe('US06: apertura', () => {
  test('al inicio no hay jornada abierta ni ubicación de hoy', async () => {
    const { status, datos } = await api('GET', '/api/jornadas/estado', 'emo')
    assert.equal(status, 200)
    assert.deepEqual(datos, { jornada: null, ubicacionHoy: null, jornadasHoy: [], ordenesPendientes: 0 })
  })

  test('no se puede abrir sin ubicación registrada hoy (422)', async () => {
    assert.equal((await api('POST', '/api/jornadas/abrir', 'emo')).status, 422)
  })

  test('una ubicación de hace dos días no cuenta como de hoy', async () => {
    await registrarUbicacion('emo', 48)
    assert.equal((await api('POST', '/api/jornadas/abrir', 'emo')).status, 422)
  })

  test('con ubicación de hoy se abre la jornada', async () => {
    await registrarUbicacion('emo')
    const { status, datos } = await api('POST', '/api/jornadas/abrir', 'emo')
    assert.equal(status, 201)
    assert.ok(datos.abiertaEn)
    assert.equal(datos.cerradaEn, null)
  })

  test('no se puede abrir una segunda jornada a la vez (409)', async () => {
    assert.equal((await api('POST', '/api/jornadas/abrir', 'emo')).status, 409)
  })

  test('dos aperturas simultáneas: solo una se crea', async () => {
    await registrarUbicacion('emo2')
    const resultados = await Promise.all([api('POST', '/api/jornadas/abrir', 'emo2'), api('POST', '/api/jornadas/abrir', 'emo2')])
    assert.deepEqual(resultados.map((r) => r.status).sort(), [201, 409])
  })

  test('el estado muestra la jornada abierta y la ubicación de hoy', async () => {
    const { datos } = await api('GET', '/api/jornadas/estado', 'emo')
    assert.ok(datos.jornada)
    assert.ok(datos.ubicacionHoy)
    assert.equal(datos.jornadasHoy.length, 1)
  })
})

describe('US06: no se cierra con órdenes sin entregar', () => {
  let ordenId

  test('una orden pendiente aparece en el estado y bloquea el cierre (422)', async () => {
    const { rows } = await pool.query(
      "INSERT INTO ordenes (cliente_id, emolientero_id, estado) VALUES ($1, $2, 'pendiente') RETURNING id",
      [ids.cliente, ids.emo],
    )
    ordenId = rows[0].id
    assert.equal((await api('GET', '/api/jornadas/estado', 'emo')).datos.ordenesPendientes, 1)
    const { status, datos } = await api('POST', '/api/jornadas/cerrar', 'emo')
    assert.equal(status, 422)
    assert.match(datos.error, /órdenes pendientes/)
    assert.ok((await api('GET', '/api/jornadas/estado', 'emo')).datos.jornada, 'la jornada sigue abierta')
  })

  test('una orden en camino también bloquea el cierre', async () => {
    await pool.query("UPDATE ordenes SET estado = 'en_camino' WHERE id = $1", [ordenId])
    assert.equal((await api('POST', '/api/jornadas/cerrar', 'emo')).status, 422)
  })

  test('las órdenes de otro emolientero no lo bloquean', async () => {
    const { rows } = await pool.query("SELECT count(*)::int n FROM ordenes WHERE emolientero_id = $1 AND estado IN ('pendiente','en_camino')", [ids.emo2])
    assert.equal(rows[0].n, 0)
  })

  test('al entregarla ya no hay órdenes pendientes', async () => {
    await pool.query("UPDATE ordenes SET estado = 'entregada' WHERE id = $1", [ordenId])
    assert.equal((await api('GET', '/api/jornadas/estado', 'emo')).datos.ordenesPendientes, 0)
  })
})

describe('US06: cierre', () => {
  test('cerrar registra la hora de cierre', async () => {
    const { status, datos } = await api('POST', '/api/jornadas/cerrar', 'emo')
    assert.equal(status, 200)
    assert.ok(datos.cerradaEn)
  })

  test('no se puede cerrar si no hay jornada abierta (409)', async () => {
    assert.equal((await api('POST', '/api/jornadas/cerrar', 'emo')).status, 409)
  })

  test('se puede volver a abrir el mismo día y queda en el registro de hoy', async () => {
    assert.equal((await api('POST', '/api/jornadas/abrir', 'emo')).status, 201)
    const { datos } = await api('GET', '/api/jornadas/estado', 'emo')
    assert.equal(datos.jornadasHoy.length, 2)
    assert.ok(datos.jornadasHoy[0].cerradaEn)
    assert.equal(datos.jornadasHoy[1].cerradaEn, null)
  })
})
