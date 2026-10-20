// US23 - T32: pruebas de los flujos de aprobación y rechazo de emolienteros.
// Levanta la API en un puerto libre contra la BD de .env.local. Crea usuarios propios
// (correos test-<id>@emolivery.test) y los borra al terminar.
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

async function crearUsuario(nombre, rol, estado, dni = null) {
  const { rows } = await pool.query(
    'INSERT INTO usuarios (nombre, correo, password_hash, rol, estado, dni) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [`Test ${nombre}`, correo(nombre), await hashContrasena(PASSWORD), rol, estado, dni],
  )
  return rows[0].id
}

async function api(metodo, ruta, { token, body } = {}) {
  const res = await fetch(base + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  })
  return { status: res.status, datos: await res.json().catch(() => null) }
}

async function login(nombre) {
  return api('POST', '/api/auth/login', { body: { correo: correo(nombre), password: PASSWORD } })
}

const estadoDe = async (id) => (await pool.query('SELECT estado FROM usuarios WHERE id = $1', [id])).rows[0].estado
const dniAleatorio = () => String(Math.floor(10_000_000 + Math.random() * 89_999_999))

const ids = {}
let tokenAdmin, tokenCliente

before(async () => {
  servidor = app.listen(0)
  base = `http://localhost:${servidor.address().port}`
  await crearUsuario('admin', 'admin', 'activo')
  await crearUsuario('cliente', 'cliente', 'activo')
  for (const nombre of ['aprobar', 'rechazar', 'carrera']) {
    ids[nombre] = await crearUsuario(nombre, 'emolientero', 'pendiente_verificacion', dniAleatorio())
  }
  tokenAdmin = (await login('admin')).datos.token
  tokenCliente = (await login('cliente')).datos.token
})

after(async () => {
  await pool.query('DELETE FROM usuarios WHERE correo LIKE $1', [`test-${SUFIJO}-%`])
  await pool.end()
  servidor.close()
})

describe('T28: bandeja de pendientes', () => {
  test('sin sesión responde 401', async () => {
    assert.equal((await api('GET', '/api/admin/emolienteros/pendientes')).status, 401)
  })

  test('un cliente no puede verla (403)', async () => {
    assert.equal((await api('GET', '/api/admin/emolienteros/pendientes', { token: tokenCliente })).status, 403)
  })

  test('el admin ve los pendientes con sus datos, del más antiguo al más reciente', async () => {
    const { status, datos } = await api('GET', '/api/admin/emolienteros/pendientes', { token: tokenAdmin })
    assert.equal(status, 200)
    const mios = datos.filter((e) => e.correo.startsWith(`test-${SUFIJO}`))
    assert.deepEqual(mios.map((e) => e.correo), [correo('aprobar'), correo('rechazar'), correo('carrera')])
    assert.match(mios[0].dni, /^\d{8}$/)
    const fechas = datos.map((e) => new Date(e.creadoEn).getTime())
    assert.deepEqual(fechas, [...fechas].sort((a, b) => a - b))
  })

  test('un emolientero pendiente no puede iniciar sesión', async () => {
    const { status, datos } = await login('aprobar')
    assert.equal(status, 403)
    assert.match(datos.error, /pendiente de verificación/)
  })
})

describe('Flujo de aprobación (T29, T30, T31)', () => {
  test('aprobar cambia el estado a activo', async () => {
    const { status, datos } = await api('POST', `/api/admin/emolienteros/${ids.aprobar}/aprobar`, { token: tokenAdmin })
    assert.equal(status, 200)
    assert.equal(datos.emolientero.estado, 'activo')
    assert.equal(await estadoDe(ids.aprobar), 'activo')
  })

  test('sale de la bandeja de pendientes', async () => {
    const { datos } = await api('GET', '/api/admin/emolienteros/pendientes', { token: tokenAdmin })
    assert.ok(!datos.some((e) => e.id === ids.aprobar))
  })

  test('aprobar de nuevo responde 409 (no se decide dos veces)', async () => {
    const { status } = await api('POST', `/api/admin/emolienteros/${ids.aprobar}/aprobar`, { token: tokenAdmin })
    assert.equal(status, 409)
  })

  test('el emolientero aprobado ya puede iniciar sesión y ve su notificación', async () => {
    const sesion = await login('aprobar')
    assert.equal(sesion.status, 200)
    const { datos } = await api('GET', '/api/notificaciones', { token: sesion.datos.token })
    assert.equal(datos.length, 1)
    assert.equal(datos[0].tipo, 'verificacion_aprobada')
    assert.equal(datos[0].leida, false)
    const marcada = await api('POST', `/api/notificaciones/${datos[0].id}/leida`, { token: sesion.datos.token })
    assert.equal(marcada.status, 200)
  })

  test('nadie más puede marcar como leída su notificación', async () => {
    const { rows } = await pool.query('SELECT id FROM notificaciones WHERE usuario_id = $1', [ids.aprobar])
    const { status } = await api('POST', `/api/notificaciones/${rows[0].id}/leida`, { token: tokenCliente })
    assert.equal(status, 404)
  })
})

describe('Flujo de rechazo (T29, T30, T31)', () => {
  test('rechazar sin motivo responde 400 y el estado no cambia', async () => {
    for (const body of [{}, { motivo: '   ' }, { motivo: 'corto' }, { motivo: 'x'.repeat(501) }]) {
      const { status } = await api('POST', `/api/admin/emolienteros/${ids.rechazar}/rechazar`, { token: tokenAdmin, body })
      assert.equal(status, 400)
    }
    assert.equal(await estadoDe(ids.rechazar), 'pendiente_verificacion')
  })

  test('rechazar con motivo cambia el estado a rechazado', async () => {
    const motivo = 'El DNI no coincide con el nombre registrado.'
    const { status, datos } = await api('POST', `/api/admin/emolienteros/${ids.rechazar}/rechazar`, {
      token: tokenAdmin,
      body: { motivo },
    })
    assert.equal(status, 200)
    assert.equal(datos.emolientero.estado, 'rechazado')
    const { rows } = await pool.query('SELECT decision, motivo FROM verificaciones WHERE usuario_id = $1', [ids.rechazar])
    assert.deepEqual(rows, [{ decision: 'rechazado', motivo }])
  })

  test('el rechazado ve el motivo al intentar iniciar sesión', async () => {
    const { status, datos } = await login('rechazar')
    assert.equal(status, 403)
    assert.match(datos.error, /rechazada.*El DNI no coincide/)
  })

  test('se le guardó la notificación con el motivo', async () => {
    const { rows } = await pool.query('SELECT tipo, mensaje FROM notificaciones WHERE usuario_id = $1', [ids.rechazar])
    assert.equal(rows[0].tipo, 'verificacion_rechazada')
    assert.match(rows[0].mensaje, /El DNI no coincide/)
  })

  test('un rechazado no puede aprobarse ni rechazarse otra vez (409)', async () => {
    assert.equal((await api('POST', `/api/admin/emolienteros/${ids.rechazar}/aprobar`, { token: tokenAdmin })).status, 409)
    const otra = await api('POST', `/api/admin/emolienteros/${ids.rechazar}/rechazar`, {
      token: tokenAdmin,
      body: { motivo: 'Otro motivo de rechazo cualquiera.' },
    })
    assert.equal(otra.status, 409)
  })
})

describe('Casos límite (T30)', () => {
  test('dos decisiones simultáneas: solo una se aplica', async () => {
    const [a, b] = await Promise.all([
      api('POST', `/api/admin/emolienteros/${ids.carrera}/aprobar`, { token: tokenAdmin }),
      api('POST', `/api/admin/emolienteros/${ids.carrera}/rechazar`, {
        token: tokenAdmin,
        body: { motivo: 'Rechazo enviado al mismo tiempo.' },
      }),
    ])
    assert.deepEqual([a.status, b.status].sort(), [200, 409])
    const { rows } = await pool.query('SELECT count(*)::int n FROM verificaciones WHERE usuario_id = $1', [ids.carrera])
    assert.equal(rows[0].n, 1)
  })

  test('id inexistente o mal formado responde 404', async () => {
    const inexistente = '00000000-0000-0000-0000-000000000000'
    assert.equal((await api('POST', `/api/admin/emolienteros/${inexistente}/aprobar`, { token: tokenAdmin })).status, 404)
    assert.equal((await api('POST', '/api/admin/emolienteros/no-es-un-id/aprobar', { token: tokenAdmin })).status, 404)
  })

  test('no se puede verificar a un usuario que no es emolientero', async () => {
    const { rows } = await pool.query('SELECT id FROM usuarios WHERE correo = $1', [correo('cliente')])
    assert.equal((await api('POST', `/api/admin/emolienteros/${rows[0].id}/aprobar`, { token: tokenAdmin })).status, 404)
  })

  test('el historial registra cada decisión con el admin que la tomó', async () => {
    const { status, datos } = await api('GET', '/api/admin/emolienteros/historial', { token: tokenAdmin })
    assert.equal(status, 200)
    const mios = datos.filter((d) => d.correo.startsWith(`test-${SUFIJO}`))
    assert.equal(mios.length, 3)
    assert.ok(mios.every((d) => d.decididoPor === 'Test admin'))
  })
})
