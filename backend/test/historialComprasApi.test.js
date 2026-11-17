// US20: pruebas del historial de compras contra la API real (BD de .env.local).
// Requiere las migraciones de órdenes de US13 (013). Crea usuarios propios (test-<id>@emolivery.test)
// y los borra al terminar (sus órdenes y líneas se borran en cascada).
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { app } from '../src/app.js'
import { pool } from '../src/db.js'
import { hashContrasena } from '../src/seguridad.js'

const SUFIJO = randomBytes(4).toString('hex')
const PASSWORD = 'Prueba1234'
const correo = (n) => `test-${SUFIJO}-${n}@emolivery.test`
const SIN_COMPRAS = 'No se encontraron compras en este periodo.'
let servidor, base
const ids = {}
const tokens = {}

async function crearUsuario(nombre, rol) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre, correo, password_hash, rol, estado) VALUES ($1, $2, $3, $4, 'activo') RETURNING id`,
    [`Test ${nombre}`, correo(nombre), await hashContrasena(PASSWORD), rol],
  )
  ids[nombre] = rows[0].id
}

async function api(ruta, token) {
  const res = await fetch(base + ruta, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  return { status: res.status, datos: await res.json().catch(() => null) }
}

// Crea una orden con sus líneas. fecha: instante ISO con zona (p. ej. '2026-11-10T23:30:00-05:00').
async function crearOrden({ estado = 'entregada', fecha, lineas }) {
  const total = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0)
  const { rows: [orden] } = await pool.query(
    `INSERT INTO ordenes (cliente_id, emolientero_id, estado, total, expira_en, creada_en)
     VALUES ($1, $2, $3, $4, $5::timestamptz + interval '15 minutes', $5) RETURNING id`,
    [ids.cliente, ids.emolientero, estado, total, fecha],
  )
  for (const l of lineas) {
    await pool.query(
      'INSERT INTO lineas_orden (orden_id, nombre, precio_unitario, cantidad) VALUES ($1, $2, $3, $4)',
      [orden.id, l.nombre, l.precio, l.cantidad],
    )
  }
  return orden.id
}

before(async () => {
  servidor = app.listen(0)
  base = `http://localhost:${servidor.address().port}`
  await crearUsuario('cliente', 'cliente')
  await crearUsuario('otro', 'cliente')
  await crearUsuario('emolientero', 'emolientero')
  for (const n of ['cliente', 'otro', 'emolientero']) {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: correo(n), password: PASSWORD }),
    })
    tokens[n] = (await res.json()).token
  }

  // 10/11 a las 23:30 en Lima (ya es 11/11 en UTC): debe contar como compra del 10/11.
  ids.noche = await crearOrden({
    fecha: '2026-11-10T23:30:00-05:00',
    lineas: [{ nombre: 'Emoliente clásico', precio: 1.5, cantidad: 2 }, { nombre: 'Maca con leche', precio: 2.5, cantidad: 1 }],
  })
  ids.pagada = await crearOrden({ estado: 'pendiente', fecha: '2026-11-12T08:00:00-05:00', lineas: [{ nombre: 'Quinua con manzana', precio: 2, cantidad: 1 }] })
  ids.cancelada = await crearOrden({ estado: 'cancelada', fecha: '2026-11-12T09:00:00-05:00', lineas: [{ nombre: 'Emoliente clásico', precio: 1.5, cantidad: 4 }] })
  ids.sinPagar = await crearOrden({ estado: 'pendiente_pago', fecha: '2026-11-13T09:00:00-05:00', lineas: [{ nombre: 'Emoliente clásico', precio: 1.5, cantidad: 1 }] })
})

after(async () => {
  await pool.query('DELETE FROM usuarios WHERE correo LIKE $1', [`test-${SUFIJO}-%`])
  await pool.end()
  servidor.close()
})

describe('US20: acceso al historial', () => {
  test('sin sesión responde 401', async () => {
    assert.equal((await api('/api/historial-compras')).status, 401)
  })
  test('un emolientero no tiene historial de compras (403)', async () => {
    assert.equal((await api('/api/historial-compras', tokens.emolientero)).status, 403)
  })
})

describe('T76: perfil con conteo y monto acumulado', () => {
  test('cuenta y suma solo las compras realizadas (no las canceladas ni las pendientes de pago)', async () => {
    const { status, datos } = await api('/api/historial-compras', tokens.cliente)
    assert.equal(status, 200)
    assert.equal(datos.conteo, 2) // entregada (S/ 5.50) y pagada (S/ 2.00)
    assert.equal(datos.montoAcumulado, 7.5)
    assert.equal(datos.compras.length, 4)
    assert.equal(datos.mensaje, null)
  })
  test('cada compra trae fecha, emolientero, productos, monto y estado, de la más reciente a la más antigua', async () => {
    const { datos } = await api('/api/historial-compras', tokens.cliente)
    assert.deepEqual(datos.compras.map((c) => c.id), [ids.sinPagar, ids.cancelada, ids.pagada, ids.noche])
    const noche = datos.compras.at(-1)
    assert.equal(noche.emolientero.nombre, 'Test emolientero')
    assert.equal(noche.estado, 'entregada')
    assert.equal(noche.monto, 5.5)
    assert.deepEqual(noche.productos, [
      { nombre: 'Emoliente clásico', cantidad: 2, precioUnitario: 1.5 },
      { nombre: 'Maca con leche', cantidad: 1, precioUnitario: 2.5 },
    ])
    assert.ok(!Number.isNaN(new Date(noche.fecha).getTime()))
  })
  test('una orden pendiente de pago con el plazo vencido se marca como vencida', async () => {
    const { datos } = await api('/api/historial-compras', tokens.cliente)
    assert.equal(datos.compras.find((c) => c.id === ids.sinPagar).vencida, true)
  })
  test('el cliente solo ve sus propias compras', async () => {
    const { datos } = await api('/api/historial-compras', tokens.otro)
    assert.equal(datos.compras.length, 0)
  })
})

describe('T77: filtro por rango de fechas', () => {
  test('filtra por días completos en hora de Lima (incluye la compra de las 23:30)', async () => {
    const { datos } = await api('/api/historial-compras?desde=2026-11-10&hasta=2026-11-10', tokens.cliente)
    assert.deepEqual(datos.compras.map((c) => c.id), [ids.noche])
    assert.equal(datos.conteo, 1)
    assert.equal(datos.montoAcumulado, 5.5)
  })
  test('con solo "desde" trae desde ese día en adelante', async () => {
    const { datos } = await api('/api/historial-compras?desde=2026-11-12', tokens.cliente)
    assert.deepEqual(datos.compras.map((c) => c.id), [ids.sinPagar, ids.cancelada, ids.pagada])
    assert.equal(datos.conteo, 1)
    assert.equal(datos.montoAcumulado, 2)
  })
  test('rango inválido: 400 con el error por campo', async () => {
    const { status, datos } = await api('/api/historial-compras?desde=2026-11-15&hasta=2026-11-01', tokens.cliente)
    assert.equal(status, 400)
    assert.ok(datos.campos.hasta)
    assert.equal((await api('/api/historial-compras?desde=10-11-2026', tokens.cliente)).status, 400)
  })
})

describe('T78: historial vacío y filtro sin resultados', () => {
  test('cliente sin órdenes: conteo 0, monto 0 y el mensaje del criterio de aceptación', async () => {
    const { datos } = await api('/api/historial-compras', tokens.otro)
    assert.deepEqual(
      { conteo: datos.conteo, montoAcumulado: datos.montoAcumulado, compras: datos.compras, mensaje: datos.mensaje },
      { conteo: 0, montoAcumulado: 0, compras: [], mensaje: SIN_COMPRAS },
    )
  })
  test('filtro sin resultados: el mismo mensaje', async () => {
    const { datos } = await api('/api/historial-compras?desde=2025-01-01&hasta=2025-01-31', tokens.cliente)
    assert.equal(datos.compras.length, 0)
    assert.equal(datos.conteo, 0)
    assert.equal(datos.mensaje, SIN_COMPRAS)
  })
})
