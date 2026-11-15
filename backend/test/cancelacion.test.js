// US16 - T75: cancelación de compra anticipada contra la API real (BD de .env.local).
// Crea usuarios test-<id>@emolivery.test y los borra al terminar (sus órdenes y devoluciones se borran en cascada).
// Como el pago con QR (US14) aún no existe, las órdenes pagadas se preparan directo en la BD.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { app } from '../src/app.js'
import { pool } from '../src/db.js'
import { hashContrasena } from '../src/seguridad.js'
import { crearOrden } from '../src/codigoRecojo.js'
import { PLAZO_CANCELACION_MIN, motivoNoCancelable } from '../src/cancelacion.js'

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

// Orden pagada hace `haceMin` minutos (como la dejaría US14), con su código de recojo (US15).
async function ordenPagada({ haceMin = 5, total = 4.5, cliente = 'cliente', emolientero = 'emo' } = {}) {
  const orden = await crearOrden(pool, { clienteId: ids[cliente], emolienteroId: ids[emolientero] })
  await pool.query(
    `UPDATE ordenes SET estado = 'pendiente', total = $2, pagada_en = now() - make_interval(mins => $3) WHERE id = $1`,
    [orden.id, total, haceMin],
  )
  return orden
}

const cancelar = (id, nombre = 'cliente') => api('POST', `/api/ordenes/${id}/cancelar`, { nombre })
const ordenEnBd = async (id) => (await pool.query('SELECT estado, cancelada_en AS "canceladaEn" FROM ordenes WHERE id = $1', [id])).rows[0]
const devolucionDe = async (ordenId) => (await pool.query('SELECT * FROM devoluciones WHERE orden_id = $1', [ordenId])).rows[0]

before(async () => {
  servidor = app.listen(0)
  base = `http://localhost:${servidor.address().port}`
  for (const [n, rol] of [['emo', 'emolientero'], ['otroEmo', 'emolientero'], ['cliente', 'cliente'], ['otroCliente', 'cliente']]) {
    await crearUsuario(n, rol)
  }
})

after(async () => {
  await pool.query('DELETE FROM usuarios WHERE correo LIKE $1', [`test-${SUFIJO}-%`])
  await pool.end()
  servidor.close()
})

describe('US16: reglas del plazo (unitarias)', () => {
  const ahora = new Date('2026-11-16T12:00:00Z')
  const pagada = (min) => new Date(ahora.getTime() - min * 60_000)

  test('se puede cancelar una orden pagada y no entregada dentro de los 30 minutos', () => {
    assert.equal(motivoNoCancelable({ estado: 'pendiente', pagadaEn: pagada(29) }, ahora), null)
    assert.equal(motivoNoCancelable({ estado: 'en_camino', pagadaEn: pagada(PLAZO_CANCELACION_MIN) }, ahora), null)
  })

  test('rechaza fuera de plazo, entregada, ya cancelada y sin pagar', () => {
    assert.match(motivoNoCancelable({ estado: 'pendiente', pagadaEn: pagada(31) }, ahora), /más de 30 minutos/)
    assert.match(motivoNoCancelable({ estado: 'entregada', pagadaEn: pagada(5) }, ahora), /ya fue entregado/)
    assert.match(motivoNoCancelable({ estado: 'pendiente', pagadaEn: pagada(5), entregadaEn: ahora }, ahora), /ya fue entregado/)
    assert.match(motivoNoCancelable({ estado: 'cancelada', pagadaEn: pagada(5) }, ahora), /ya fue cancelada/)
    assert.match(motivoNoCancelable({ estado: 'pendiente_pago', pagadaEn: null }, ahora), /aún no está pagada/)
  })
})

describe('US16: acceso', () => {
  test('sin sesión 401; un emolientero no puede cancelar (403)', async () => {
    const orden = await ordenPagada()
    assert.equal((await api('POST', `/api/ordenes/${orden.id}/cancelar`)).status, 401)
    assert.equal((await cancelar(orden.id, 'emo')).status, 403)
  })

  test('la orden de otro cliente o inexistente responde 404 y no se toca', async () => {
    const orden = await ordenPagada()
    assert.equal((await cancelar(orden.id, 'otroCliente')).status, 404)
    assert.equal((await ordenEnBd(orden.id)).estado, 'pendiente')
    assert.equal((await cancelar(999999999)).status, 404)
    assert.equal((await cancelar('abc')).status, 404)
  })
})

describe('US16 - T72 + T74: cancelación dentro del plazo', () => {
  test('anula la orden, registra la devolución por el total y avisa al emolientero', async () => {
    const orden = await ordenPagada({ haceMin: 10, total: 6.5 })
    const { status, datos } = await cancelar(orden.id)
    assert.equal(status, 200)
    assert.equal(datos.orden.estado, 'cancelada')
    assert.equal(datos.devolucion.monto, 6.5)
    assert.equal(datos.devolucion.estado, 'pendiente')

    const enBd = await ordenEnBd(orden.id)
    assert.equal(enBd.estado, 'cancelada')
    assert.ok(enBd.canceladaEn)
    assert.equal((await devolucionDe(orden.id)).emolientero_id, ids.emo)

    const { rows: avisos } = await pool.query(
      "SELECT mensaje FROM notificaciones WHERE usuario_id = $1 AND tipo = 'devolucion_solicitada'",
      [ids.emo],
    )
    assert.ok(avisos.some((a) => a.mensaje.includes(`#${orden.id}`)))
  })

  test('si la orden no tiene total guardado, la devolución usa la suma de sus líneas', async () => {
    const orden = await ordenPagada()
    await pool.query('UPDATE ordenes SET total = NULL WHERE id = $1', [orden.id])
    await pool.query(
      "INSERT INTO lineas_orden (orden_id, nombre, precio_unitario, cantidad) VALUES ($1, 'Emoliente', 1.5, 3)",
      [orden.id],
    )
    const { status, datos } = await cancelar(orden.id)
    assert.equal(status, 200)
    assert.equal(datos.devolucion.monto, 4.5)
  })
})

describe('US16 - T73: la cancelación libera lo que la orden ocupaba', () => {
  test('el pedido sale de la lista por entregar y su código de recojo deja de servir', async () => {
    const orden = await ordenPagada()
    assert.equal((await cancelar(orden.id)).status, 200)

    const porEntregar = (await api('GET', '/api/ordenes/por-entregar', { nombre: 'emo' })).datos
    assert.ok(!porEntregar.some((o) => o.id === orden.id))
    const entrega = await api('POST', '/api/ordenes/entregar', { nombre: 'emo', body: { codigo: orden.codigoRecojo } })
    assert.equal(entrega.status, 409)
    assert.match(entrega.datos.error, /cancelado/)
  })

  test('el emolientero ya puede cerrar su jornada (US06) sin ese pedido pendiente', async () => {
    await crearUsuario('emoJornada', 'emolientero')
    await pool.query('INSERT INTO jornadas (emolientero_id) VALUES ($1)', [ids.emoJornada])
    const orden = await ordenPagada({ emolientero: 'emoJornada' })

    assert.equal((await api('POST', '/api/jornadas/cerrar', { nombre: 'emoJornada' })).status, 422)
    assert.equal((await cancelar(orden.id)).status, 200)
    assert.equal((await api('POST', '/api/jornadas/cerrar', { nombre: 'emoJornada' })).status, 200)
  })
})

describe('US16 - T75: cancelación fuera de plazo y de orden ya entregada', () => {
  test('pagada hace más de 30 minutos: 409 y la orden sigue por entregar, sin devolución', async () => {
    const orden = await ordenPagada({ haceMin: PLAZO_CANCELACION_MIN + 1 })
    const { status, datos } = await cancelar(orden.id)
    assert.equal(status, 409)
    assert.match(datos.error, /^La compra ya no puede cancelarse/)
    assert.equal((await ordenEnBd(orden.id)).estado, 'pendiente')
    assert.equal(await devolucionDe(orden.id), undefined)
  })

  test('ya entregada con su código: 409 y sigue entregada', async () => {
    const orden = await ordenPagada()
    assert.equal((await api('POST', '/api/ordenes/entregar', { nombre: 'emo', body: { codigo: orden.codigoRecojo } })).status, 200)
    const { status, datos } = await cancelar(orden.id)
    assert.equal(status, 409)
    assert.match(datos.error, /ya fue entregado/)
    assert.equal((await ordenEnBd(orden.id)).estado, 'entregada')
  })

  test('cancelar dos veces: la segunda responde 409', async () => {
    const orden = await ordenPagada()
    assert.equal((await cancelar(orden.id)).status, 200)
    const { status, datos } = await cancelar(orden.id)
    assert.equal(status, 409)
    assert.match(datos.error, /ya fue cancelada/)
  })

  test('una orden aún sin pagar no se cancela (vence sola)', async () => {
    const orden = await crearOrden(pool, { clienteId: ids.cliente, emolienteroId: ids.emo })
    await pool.query("UPDATE ordenes SET estado = 'pendiente_pago', expira_en = now() + interval '15 minutes' WHERE id = $1", [orden.id])
    const { status, datos } = await cancelar(orden.id)
    assert.equal(status, 409)
    assert.match(datos.error, /aún no está pagada/)
  })

  test('cancelación y entrega simultáneas: solo una de las dos se aplica', async () => {
    const orden = await ordenPagada()
    const [cancelacion, entrega] = await Promise.all([
      cancelar(orden.id),
      api('POST', '/api/ordenes/entregar', { nombre: 'emo', body: { codigo: orden.codigoRecojo } }),
    ])
    assert.deepEqual([cancelacion.status, entrega.status].sort(), [200, 409])
    const estado = (await ordenEnBd(orden.id)).estado
    assert.equal(estado, cancelacion.status === 200 ? 'cancelada' : 'entregada')
    assert.equal(Boolean(await devolucionDe(orden.id)), cancelacion.status === 200)
  })
})

describe('US16 - T74: devoluciones del emolientero', () => {
  test('el emolientero ve su devolución pendiente y la marca como realizada; el cliente recibe aviso', async () => {
    const orden = await ordenPagada({ total: 3 })
    const { datos } = await cancelar(orden.id)
    const id = datos.devolucion.id

    const lista = (await api('GET', '/api/devoluciones', { nombre: 'emo' })).datos
    const mia = lista.find((d) => d.id === id)
    assert.equal(mia.estado, 'pendiente')
    assert.equal(mia.monto, 3)
    assert.equal(mia.cliente, 'Test cliente')

    assert.equal((await api('POST', `/api/devoluciones/${id}/realizada`, { nombre: 'otroEmo' })).status, 404)
    const marcada = await api('POST', `/api/devoluciones/${id}/realizada`, { nombre: 'emo' })
    assert.equal(marcada.status, 200)
    assert.equal(marcada.datos.estado, 'realizada')
    assert.equal((await api('POST', `/api/devoluciones/${id}/realizada`, { nombre: 'emo' })).status, 409)

    const { rowCount } = await pool.query(
      "SELECT 1 FROM notificaciones WHERE usuario_id = $1 AND tipo = 'devolucion_realizada'",
      [ids.cliente],
    )
    assert.ok(rowCount >= 1)
  })

  test('un cliente no puede ver devoluciones (403)', async () => {
    assert.equal((await api('GET', '/api/devoluciones', { nombre: 'cliente' })).status, 403)
  })
})
