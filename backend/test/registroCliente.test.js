// US01: registro de cliente contra la BD de .env.local. Crea usuarios test-<id>@emolivery.test y los borra al terminar.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { app } from '../src/app.js'
import { pool } from '../src/db.js'

const SUFIJO = randomBytes(4).toString('hex')
const correo = (nombre) => `test-${SUFIJO}-${nombre}@emolivery.test`
let servidor, base

const formulario = (nombre, cambios = {}) => ({
  nombre: 'Carla Pérez Quispe',
  telefono: '987654321',
  correo: correo(nombre),
  password: 'Prueba1234',
  ...cambios,
})

async function post(ruta, body) {
  const res = await fetch(base + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { status: res.status, datos: await res.json().catch(() => null) }
}

before(() => {
  servidor = app.listen(0)
  base = `http://localhost:${servidor.address().port}`
})

after(async () => {
  await pool.query('DELETE FROM usuarios WHERE correo LIKE $1', [`test-${SUFIJO}-%`])
  await pool.end()
  servidor.close()
})

describe('US01: registro de cliente', () => {
  test('crea la cuenta como cliente activo, con la contraseña cifrada', async () => {
    const { status, datos } = await post('/api/clientes/registro', formulario('ok', { correo: correo('ok').toUpperCase() }))
    assert.equal(status, 201)
    assert.equal(datos.cliente.estado, 'activo')
    assert.equal(datos.cliente.correo, correo('ok'))
    const { rows } = await pool.query('SELECT rol, estado, telefono, password_hash FROM usuarios WHERE correo = $1', [correo('ok')])
    assert.equal(rows[0].rol, 'cliente')
    assert.equal(rows[0].telefono, '987654321')
    assert.match(rows[0].password_hash, /^scrypt\$/)
  })

  test('el cliente registrado puede iniciar sesión de inmediato', async () => {
    const { status, datos } = await post('/api/auth/login', { correo: correo('ok'), password: 'Prueba1234' })
    assert.equal(status, 200)
    assert.equal(datos.usuario.rol, 'cliente')
  })

  test('rechaza un correo ya registrado (sin distinguir mayúsculas) con 409 en el campo correo', async () => {
    const { status, datos } = await post('/api/clientes/registro', formulario('otro', { correo: correo('OK') }))
    assert.equal(status, 409)
    assert.ok(datos.campos.correo)
  })

  test('valida cada campo y responde 400 con el error de cada uno', async () => {
    const { status, datos } = await post('/api/clientes/registro', {
      nombre: 'Al',
      telefono: '812345678',
      correo: 'no-es-correo',
      password: 'solo letras',
    })
    assert.equal(status, 400)
    assert.deepEqual(Object.keys(datos.campos).sort(), ['correo', 'nombre', 'password', 'telefono'])
  })

  test('acepta el celular con espacios y lo guarda limpio', async () => {
    const { status } = await post('/api/clientes/registro', formulario('espacios', { telefono: '987 654 321' }))
    assert.equal(status, 201)
    const { rows } = await pool.query('SELECT telefono FROM usuarios WHERE correo = $1', [correo('espacios')])
    assert.equal(rows[0].telefono, '987654321')
  })
})
