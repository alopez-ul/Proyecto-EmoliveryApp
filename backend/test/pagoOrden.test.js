// US13 → US14 → US15 → US16 de punta a punta contra la API real (BD de .env.local): compra anticipada,
// pago con Yape de la orden real, entrega con el código de recojo y cancelación dentro del plazo.
// Crea usuarios test-<id>@emolivery.test y los borra al terminar (sus órdenes y productos se borran en cascada).
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomInt } from 'node:crypto'
import { app } from '../src/app.js'
import { pool } from '../src/db.js'
import { hashContrasena } from '../src/seguridad.js'

const SUFIJO = randomBytes(4).toString('hex')
const PASSWORD = 'Prueba1234'
const correo = (n) => `test-${SUFIJO}-${n}@emolivery.test`
let servidor, base, productoId
const ids = {}
const tokens = {}

// Número de operación de Yape que no choque con otros guardados en la BD compartida.
const nuevaOperacion = () => String(randomInt(100_000_000, 999_999_999)) + String(randomInt(0, 9))

async function crearUsuario(nombre, rol) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre, correo, password_hash, rol, estado, telefono) VALUES ($1, $2, $3, $4, 'activo', '987111222') RETURNING id`,
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

// US13: el cliente compra 2 emolientes de S/ 2.50 → orden pendiente de pago por S/ 5.00.
const comprar = (cliente = 'cliente') =>
  api('POST', '/api/ordenes', { nombre: cliente, body: { emolienteroId: ids.emo, lineas: [{ productoId, cantidad: 2 }] } })
const pagar = (ordenId, numeroOperacion, montoIngresado, cliente = 'cliente') =>
  api('POST', `/api/pagos/yape/ordenes/${ordenId}`, { nombre: cliente, body: { numeroOperacion, montoIngresado } })
const ordenEnBd = async (id) =>
  (await pool.query(
    `SELECT estado, pagada_en AS "pagadaEn", numero_operacion AS "numeroOperacion", codigo_recojo AS "codigoRecojo"
     FROM ordenes WHERE id = $1`,
    [id],
  )).rows[0]

before(async () => {
  servidor = app.listen(0)
  base = `http://localhost:${servidor.address().port}`
  for (const [n, rol] of [['emo', 'emolientero'], ['cliente', 'cliente'], ['otro', 'cliente']]) await crearUsuario(n, rol)
  await pool.query('INSERT INTO jornadas (emolientero_id) VALUES ($1)', [ids.emo])
  const { rows } = await pool.query(
    `INSERT INTO catalogo_productos (emolientero_id, nombre, categoria, precio) VALUES ($1, 'Emoliente de prueba', 'emoliente', 2.5) RETURNING id`,
    [ids.emo],
  )
  productoId = rows[0].id
})

after(async () => {
  await pool.query('DELETE FROM usuarios WHERE correo LIKE $1', [`test-${SUFIJO}-%`])
  await pool.end()
  servidor.close()
})

describe('Flujo completo: compra → pago → entrega', () => {
  let orden, codigo

  test('US13: la compra crea la orden pendiente de pago, con el teléfono de Yape del emolientero', async () => {
    const { status, datos } = await comprar()
    assert.equal(status, 201)
    assert.equal(datos.estado, 'pendiente_pago')
    assert.equal(Number(datos.total), 5)
    assert.equal(datos.emolientero.telefono, '987111222')
    orden = datos
  })

  test('US15: antes de pagar, el código no sirve y el mensaje lo explica', async () => {
    const { codigoRecojo } = await ordenEnBd(orden.id)
    const { status, datos } = await api('POST', '/api/ordenes/entregar', { nombre: 'emo', body: { codigo: codigoRecojo } })
    assert.equal(status, 409)
    assert.match(datos.error, /todavía no está pagado/)
  })

  test('US14: un pago válido deja la orden pagada y devuelve SU código de recojo', async () => {
    const operacion = nuevaOperacion()
    const { status, datos } = await pagar(orden.id, operacion, 5)
    assert.equal(status, 200)
    assert.equal(datos.valido, true)
    const enBd = await ordenEnBd(orden.id)
    assert.equal(enBd.estado, 'pendiente')
    assert.ok(enBd.pagadaEn)
    assert.equal(enBd.numeroOperacion, operacion)
    assert.equal(datos.codigoRecojo.replace('-', ''), enBd.codigoRecojo, 'el mismo código guardado en la orden')
    codigo = datos.codigoRecojo

    const { rows } = await pool.query("SELECT resultado FROM transacciones_pago WHERE orden_id = $1", [orden.id])
    assert.deepEqual(rows.map((r) => r.resultado), ['ACEPTADO'])
    const aviso = await pool.query("SELECT 1 FROM notificaciones WHERE usuario_id = $1 AND tipo = 'orden_pagada'", [ids.emo])
    assert.equal(aviso.rowCount, 1, 'se avisa al emolientero')
  })

  test('el cliente ve su código en "Mis pedidos" y el emolientero el pedido por entregar', async () => {
    const mio = (await api('GET', '/api/ordenes/mias', { nombre: 'cliente' })).datos.find((o) => o.id === orden.id)
    assert.equal(mio.codigoRecojo, codigo)
    const porEntregar = (await api('GET', '/api/ordenes/por-entregar', { nombre: 'emo' })).datos
    assert.ok(porEntregar.some((o) => o.id === orden.id))
  })

  test('una orden ya pagada no se puede pagar otra vez (409)', async () => {
    assert.equal((await pagar(orden.id, nuevaOperacion(), 5)).status, 409)
  })

  test('US15: el emolientero entrega con ese código y se habilita la reseña', async () => {
    const { status, datos } = await api('POST', '/api/ordenes/entregar', { nombre: 'emo', body: { codigo } })
    assert.equal(status, 200)
    assert.equal(datos.orden.id, orden.id)
    assert.equal((await ordenEnBd(orden.id)).estado, 'entregada')
  })
})

describe('US14: constancias no válidas (se libera la reserva)', () => {
  test('monto distinto → 422, orden cancelada y registrada en la bitácora', async () => {
    const { datos: o } = await comprar()
    const { status, datos } = await pagar(o.id, nuevaOperacion(), 4.5)
    assert.equal(status, 422)
    assert.equal(datos.codigoCausa, 'MONTO_INCORRECTO')
    assert.equal((await ordenEnBd(o.id)).estado, 'cancelada')
    const { rows } = await pool.query('SELECT resultado, codigo_causa FROM transacciones_pago WHERE orden_id = $1', [o.id])
    assert.deepEqual(rows, [{ resultado: 'RECHAZADO', codigo_causa: 'MONTO_INCORRECTO' }])
  })

  test('número de operación ya usado en otra orden → 422 OPERACION_DUPLICADA', async () => {
    const operacion = nuevaOperacion()
    const { datos: a } = await comprar()
    assert.equal((await pagar(a.id, operacion, 5)).status, 200)
    const { datos: b } = await comprar()
    const { status, datos } = await pagar(b.id, operacion, 5)
    assert.equal(status, 422)
    assert.equal(datos.codigoCausa, 'OPERACION_DUPLICADA')
  })

  test('formato de operación inválido → 422', async () => {
    const { datos: o } = await comprar()
    const { status, datos } = await pagar(o.id, '12AB', 5)
    assert.equal(status, 422)
    assert.equal(datos.codigoCausa, 'FORMATO_OPERACION_INVALIDO')
  })

  test('orden vencida (más de 15 min) → 422 ORDEN_VENCIDA', async () => {
    const { datos: o } = await comprar()
    await pool.query(
      "UPDATE ordenes SET creada_en = now() - interval '20 minutes', expira_en = now() - interval '5 minutes' WHERE id = $1",
      [o.id],
    )
    const { status, datos } = await pagar(o.id, nuevaOperacion(), 5)
    assert.equal(status, 422)
    assert.equal(datos.codigoCausa, 'ORDEN_VENCIDA')
  })

  test('la orden de otro cliente no existe para él (404)', async () => {
    const { datos: o } = await comprar()
    assert.equal((await pagar(o.id, nuevaOperacion(), 5, 'otro')).status, 404)
  })
})

describe('US16: una orden pagada por Yape se puede cancelar en el plazo', () => {
  test('tras el pago, la cancelación del cliente funciona y genera la devolución', async () => {
    const { datos: o } = await comprar()
    assert.equal((await pagar(o.id, nuevaOperacion(), 5)).status, 200)
    const { status } = await api('POST', `/api/ordenes/${o.id}/cancelar`, { nombre: 'cliente' })
    assert.equal(status, 200)
    assert.equal((await ordenEnBd(o.id)).estado, 'cancelada')
    const { rows } = await pool.query('SELECT monto FROM devoluciones WHERE orden_id = $1', [o.id])
    assert.equal(Number(rows[0].monto), 5)
  })
})
