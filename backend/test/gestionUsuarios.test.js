// US24 - T103: gestión de usuarios registrados contra la API real (BD de .env.local).
// Crea usuarios test-<id>@emolivery.test y los borra al terminar.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { app } from '../src/app.js'
import { pool } from '../src/db.js'
import { hashContrasena } from '../src/seguridad.js'
import { crearOrden } from '../src/codigoRecojo.js'
import { calcularTotales, validarFiltros, validarMotivo } from '../src/gestionUsuarios.js'

const SUFIJO = randomBytes(4).toString('hex')
const PASSWORD = 'Prueba1234'
const correo = (n) => `test-${SUFIJO}-${n}@emolivery.test`
const MOTIVO = 'Reportes repetidos de mala atención'
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

const login = (nombre) => api('POST', '/api/auth/login', { body: { correo: correo(nombre), password: PASSWORD } })

async function crearUsuario(nombre, rol, estado = 'activo') {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre, correo, password_hash, rol, estado) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [`Test ${SUFIJO} ${nombre}`, correo(nombre), await hashContrasena(PASSWORD), rol, estado],
  )
  ids[nombre] = rows[0].id
  if (estado === 'activo') tokens[nombre] = (await login(nombre)).datos.token
}

const suspender = (nombre, motivo = MOTIVO, admin = 'admin') => api('POST', `/api/admin/usuarios/${ids[nombre]}/suspender`, { nombre: admin, body: { motivo } })
const reactivar = (nombre, motivo = 'Se resolvió el reclamo con el usuario', admin = 'admin') =>
  api('POST', `/api/admin/usuarios/${ids[nombre]}/reactivar`, { nombre: admin, body: { motivo } })
const estadoDe = async (nombre) => (await pool.query('SELECT estado FROM usuarios WHERE id = $1', [ids[nombre]])).rows[0].estado
const listar = (filtros = {}) => api('GET', `/api/admin/usuarios?${new URLSearchParams(filtros)}`, { nombre: 'admin' })
const mios = (usuarios) => usuarios.filter((u) => u.correo.startsWith(`test-${SUFIJO}-`))

before(async () => {
  servidor = app.listen(0)
  base = `http://localhost:${servidor.address().port}`
  for (const [n, rol] of [['admin', 'admin'], ['admin2', 'admin'], ['cliente', 'cliente'], ['emo', 'emolientero'], ['emoOcupado', 'emolientero']]) {
    await crearUsuario(n, rol)
  }
  await crearUsuario('pendiente', 'emolientero', 'pendiente_verificacion')
  // Registro con fecha conocida para probar el filtro por fecha (hora de Lima).
  await pool.query("UPDATE usuarios SET creado_en = '2026-01-15 12:00:00-05' WHERE id = $1", [ids.cliente])
})

after(async () => {
  await pool.query('DELETE FROM usuarios WHERE correo LIKE $1', [`test-${SUFIJO}-%`])
  await pool.end()
  servidor.close()
})

describe('US24: reglas (unitarias)', () => {
  test('valida filtros: rol, estado, fechas imposibles y rango invertido', () => {
    assert.deepEqual(validarFiltros({ rol: 'cliente', desde: '2026-01-01', hasta: '2026-01-31' }).errores, {})
    assert.ok(validarFiltros({ rol: 'repartidor' }).errores.rol)
    assert.ok(validarFiltros({ estado: 'borrado' }).errores.estado)
    assert.ok(validarFiltros({ desde: '2026-02-30' }).errores.desde)
    assert.ok(validarFiltros({ desde: '15/01/2026' }).errores.desde)
    assert.ok(validarFiltros({ desde: '2026-02-01', hasta: '2026-01-01' }).errores.hasta)
  })

  test('T101: totales por rol y por estado, con las categorías vacías en 0', () => {
    const t = calcularTotales([{ rol: 'cliente', estado: 'activo' }, { rol: 'cliente', estado: 'suspendido' }, { rol: 'emolientero', estado: 'activo' }])
    assert.equal(t.total, 3)
    assert.deepEqual(t.porRol, { cliente: 2, emolientero: 1, admin: 0 })
    assert.deepEqual(t.porEstado, { activo: 2, pendiente_verificacion: 0, rechazado: 0, suspendido: 1 })
  })

  test('el motivo es obligatorio (10 a 500 caracteres)', () => {
    assert.deepEqual(validarMotivo({ motivo: MOTIVO }).errores, {})
    assert.ok(validarMotivo({ motivo: 'corto' }).errores.motivo)
    assert.ok(validarMotivo({}).errores.motivo)
  })
})

describe('US24: acceso', () => {
  test('sin sesión 401; un cliente o emolientero no entra (403)', async () => {
    assert.equal((await api('GET', '/api/admin/usuarios')).status, 401)
    assert.equal((await api('GET', '/api/admin/usuarios', { nombre: 'cliente' })).status, 403)
    assert.equal((await api('POST', `/api/admin/usuarios/${ids.cliente}/suspender`, { nombre: 'emo', body: { motivo: MOTIVO } })).status, 403)
  })
})

describe('US24 - T100 + T101: listado con filtros y totales', () => {
  test('sin filtros lista a todos, con totales coherentes con el listado', async () => {
    const { status, datos } = await listar()
    assert.equal(status, 200)
    assert.equal(datos.totales.total, datos.usuarios.length)
    assert.equal(Object.values(datos.totales.porRol).reduce((a, b) => a + b), datos.usuarios.length)
    assert.equal(mios(datos.usuarios).length, 6)
  })

  test('filtra por rol y por estado', async () => {
    const porRol = (await listar({ rol: 'emolientero' })).datos
    assert.ok(porRol.usuarios.every((u) => u.rol === 'emolientero'))
    assert.equal(porRol.totales.porRol.cliente, 0)
    assert.deepEqual(mios(porRol.usuarios).map((u) => u.id).sort(), [ids.emo, ids.emoOcupado, ids.pendiente].sort())

    const pendientes = (await listar({ estado: 'pendiente_verificacion' })).datos
    assert.ok(pendientes.usuarios.every((u) => u.estado === 'pendiente_verificacion'))
    assert.ok(pendientes.usuarios.some((u) => u.id === ids.pendiente))
  })

  test('filtra por fecha de registro (ambos extremos inclusive, hora de Lima)', async () => {
    const enRango = (await listar({ desde: '2026-01-15', hasta: '2026-01-15' })).datos
    assert.ok(enRango.usuarios.some((u) => u.id === ids.cliente))
    assert.ok(!enRango.usuarios.some((u) => u.id === ids.emo))
    const despues = (await listar({ desde: '2026-01-16' })).datos
    assert.ok(!despues.usuarios.some((u) => u.id === ids.cliente))
  })

  test('un filtro inválido responde 400', async () => {
    assert.equal((await listar({ rol: 'repartidor' })).status, 400)
    assert.equal((await listar({ desde: '2026-13-01' })).status, 400)
  })
})

describe('US24 - T102: suspensión y reactivación con motivo', () => {
  test('suspende a un cliente: ya no puede iniciar sesión y queda registrado el motivo', async () => {
    const { status, datos } = await suspender('cliente')
    assert.equal(status, 200)
    assert.equal(datos.estado, 'suspendido')
    assert.equal(await estadoDe('cliente'), 'suspendido')
    assert.equal((await login('cliente')).status, 403)

    const { rows: [cambio] } = await pool.query(
      'SELECT accion, motivo, admin_id FROM cambios_estado_cuenta WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 1',
      [ids.cliente],
    )
    assert.deepEqual(cambio, { accion: 'suspender', motivo: MOTIVO, admin_id: ids.admin })
    const listado = (await listar({ estado: 'suspendido' })).datos.usuarios.find((u) => u.id === ids.cliente)
    assert.equal(listado.ultimoMotivo, MOTIVO)
  })

  test('reactiva la cuenta suspendida: vuelve a iniciar sesión y recibe un aviso', async () => {
    const { status } = await reactivar('cliente')
    assert.equal(status, 200)
    assert.equal(await estadoDe('cliente'), 'activo')
    assert.equal((await login('cliente')).status, 200)
    const { rowCount } = await pool.query("SELECT 1 FROM notificaciones WHERE usuario_id = $1 AND tipo = 'cuenta_reactivada'", [ids.cliente])
    assert.equal(rowCount, 1)
  })

  test('sin motivo suficiente responde 400 y no cambia nada', async () => {
    assert.equal((await suspender('cliente', 'porque sí')).status, 400)
    assert.equal(await estadoDe('cliente'), 'activo')
  })

  test('no se suspende a un administrador, a uno mismo ni a una cuenta que no está activa', async () => {
    assert.equal((await suspender('admin2')).status, 422)
    assert.equal((await suspender('admin')).status, 422)
    assert.equal((await suspender('pendiente')).status, 409)
    assert.equal((await reactivar('emo')).status, 409, 'una cuenta activa no se reactiva')
    assert.equal((await api('POST', '/api/admin/usuarios/no-es-uuid/suspender', { nombre: 'admin', body: { motivo: MOTIVO } })).status, 404)
  })

  test('al suspender a un emolientero se cierra su jornada abierta', async () => {
    await pool.query('INSERT INTO jornadas (emolientero_id) VALUES ($1)', [ids.emo])
    assert.equal((await suspender('emo')).status, 200)
    const { rowCount } = await pool.query('SELECT 1 FROM jornadas WHERE emolientero_id = $1 AND cerrada_en IS NULL', [ids.emo])
    assert.equal(rowCount, 0)
  })
})

describe('US24 - T103: bloqueo por órdenes pagadas pendientes', () => {
  test('no suspende a un emolientero con pedidos pagados por entregar y lista cuáles resolver', async () => {
    const orden = await crearOrden(pool, { clienteId: ids.cliente, emolienteroId: ids.emoOcupado })
    await pool.query("UPDATE ordenes SET estado = 'pendiente', total = 5, pagada_en = now() WHERE id = $1", [orden.id])

    const { status, datos } = await suspender('emoOcupado')
    assert.equal(status, 409)
    assert.match(datos.error, /pedido\(s\) pagado\(s\) por entregar/)
    assert.deepEqual(datos.ordenes.map((o) => o.id), [orden.id])
    assert.equal(datos.ordenes[0].cliente, `Test ${SUFIJO} cliente`)
    assert.equal(await estadoDe('emoOcupado'), 'activo')
    const { rowCount } = await pool.query('SELECT 1 FROM cambios_estado_cuenta WHERE usuario_id = $1', [ids.emoOcupado])
    assert.equal(rowCount, 0, 'no se registra un cambio que no ocurrió')

    const listado = (await listar({ rol: 'emolientero' })).datos.usuarios.find((u) => u.id === ids.emoOcupado)
    assert.equal(listado.ordenesPorEntregar, 1)
  })

  test('cuando el pedido se entrega, ya se puede suspender', async () => {
    await pool.query("UPDATE ordenes SET estado = 'entregada', entregada_en = now() WHERE emolientero_id = $1", [ids.emoOcupado])
    assert.equal((await suspender('emoOcupado')).status, 200)
  })
})
