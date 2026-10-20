// US02 - T09: registro de emolientero de punta a punta, con rechazo por DNI duplicado y código inválido.
// Levanta la API en un puerto libre contra la BD de .env.local. Crea usuarios propios
// (correos test-<id>@emolivery.test) y los borra al terminar.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { app } from '../src/app.js'
import { pool } from '../src/db.js'
import { hashContrasena } from '../src/seguridad.js'

const SUFIJO = randomBytes(4).toString('hex')
const correo = (nombre) => `test-${SUFIJO}-${nombre}@emolivery.test`
const dniAleatorio = () => String(Math.floor(10_000_000 + Math.random() * 89_999_999))
// Correlativo aleatorio para no chocar con códigos ya registrados en la BD.
const codigoAleatorio = () => `MLM-2025-${String(Math.floor(1 + Math.random() * 99_998)).padStart(5, '0')}`
let servidor, base, adminId

const formulario = (nombre, cambios = {}) => ({
  nombreNegocio: `Test ${SUFIJO} ${nombre}`,
  dni: dniAleatorio(),
  codigoMunicipal: codigoAleatorio(),
  telefono: '987654321',
  correo: correo(nombre),
  password: 'Prueba1234',
  ...cambios,
})

async function registrar(body) {
  const res = await fetch(`${base}/api/emolienteros/registro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, datos: await res.json().catch(() => null) }
}

const usuariosConCorreo = async (c) => (await pool.query('SELECT * FROM usuarios WHERE correo = $1', [c])).rows

before(async () => {
  servidor = app.listen(0)
  base = `http://localhost:${servidor.address().port}`
  const { rows } = await pool.query(
    "INSERT INTO usuarios (nombre, correo, password_hash, rol, estado) VALUES ('Test admin', $1, $2, 'admin', 'activo') RETURNING id",
    [correo('admin'), await hashContrasena('Prueba1234')],
  )
  adminId = rows[0].id
})

after(async () => {
  // Los avisos también llegan a los administradores reales de la BD; se borran los de esta corrida.
  await pool.query("DELETE FROM notificaciones WHERE tipo = 'registro_emolientero' AND mensaje LIKE $1", [`Test ${SUFIJO} %`])
  await pool.query('DELETE FROM usuarios WHERE correo LIKE $1', [`test-${SUFIJO}-%`])
  await pool.end()
  servidor.close()
})

describe('T07 + T08: registro exitoso', () => {
  test('crea la cuenta en estado pendiente_verificacion y notifica al administrador', async () => {
    const datos = formulario('ok', { codigoMunicipal: codigoAleatorio().toLowerCase() })
    const { status, datos: respuesta } = await registrar(datos)
    assert.equal(status, 201)
    assert.equal(respuesta.emolientero.estado, 'pendiente_verificacion')
    assert.ok(respuesta.administradoresNotificados >= 1)

    const [guardado] = await usuariosConCorreo(correo('ok'))
    assert.equal(guardado.rol, 'emolientero')
    assert.equal(guardado.dni, datos.dni)
    assert.equal(guardado.codigo_municipal, datos.codigoMunicipal.toUpperCase())
    assert.match(guardado.password_hash, /^scrypt\$/)

    const { rows: avisos } = await pool.query("SELECT * FROM notificaciones WHERE usuario_id = $1 AND tipo = 'registro_emolientero'", [adminId])
    assert.equal(avisos.length, 1)
    assert.ok(avisos[0].mensaje.includes(datos.dni) && avisos[0].mensaje.includes(datos.codigoMunicipal.toUpperCase()))
  })

  test('la cuenta pendiente aparece en la bandeja del administrador con su código', async () => {
    const { rows } = await pool.query(
      "SELECT codigo_municipal FROM usuarios WHERE correo = $1 AND estado = 'pendiente_verificacion'",
      [correo('ok')],
    )
    assert.match(rows[0].codigo_municipal, /^MLM-\d{4}-\d{5}$/)
  })

  test('un emolientero recién registrado no puede iniciar sesión', async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: correo('ok'), password: 'Prueba1234' }),
    })
    assert.equal(res.status, 403)
    assert.match((await res.json()).error, /pendiente de verificación/)
  })
})

describe('T09: rechazo por DNI duplicado', () => {
  test('responde 409 con el error en el campo dni y no crea la cuenta', async () => {
    const dni = dniAleatorio()
    assert.equal((await registrar(formulario('dni-1', { dni }))).status, 201)

    const { status, datos } = await registrar(formulario('dni-2', { dni }))
    assert.equal(status, 409)
    assert.deepEqual(Object.keys(datos.campos), ['dni'])
    assert.equal(datos.error, 'Ya existe una cuenta registrada con este DNI.')
    assert.equal((await usuariosConCorreo(correo('dni-2'))).length, 0)
  })

  test('dos registros simultáneos con el mismo DNI: solo uno se crea', async () => {
    const dni = dniAleatorio()
    const resultados = await Promise.all([
      registrar(formulario('carrera-1', { dni })),
      registrar(formulario('carrera-2', { dni })),
    ])
    assert.deepEqual(resultados.map((r) => r.status).sort(), [201, 409])
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM usuarios WHERE dni = $1', [dni])
    assert.equal(rows[0].n, 1)
  })

  test('informa a la vez DNI, código y correo duplicados', async () => {
    const original = formulario('triple')
    assert.equal((await registrar(original)).status, 201)
    const { status, datos } = await registrar({ ...original, nombreNegocio: 'Otro nombre' })
    assert.equal(status, 409)
    assert.deepEqual(Object.keys(datos.campos).sort(), ['codigoMunicipal', 'correo', 'dni'])
  })
})

describe('T09: rechazo por código municipal inválido', () => {
  for (const codigo of ['MUN-2024-890', 'MLM-2025-123', 'MLM-2099-00123', '']) {
    test(`"${codigo}" responde 400 con el error en codigoMunicipal y no crea la cuenta`, async () => {
      const nombre = `codigo-${codigo || 'vacio'}`
      const { status, datos } = await registrar(formulario(nombre, { codigoMunicipal: codigo }))
      assert.equal(status, 400)
      assert.deepEqual(Object.keys(datos.campos), ['codigoMunicipal'])
      assert.equal((await usuariosConCorreo(correo(nombre))).length, 0)
    })
  }

  test('un código ya registrado por otro emolientero responde 409', async () => {
    const codigoMunicipal = codigoAleatorio()
    assert.equal((await registrar(formulario('cod-1', { codigoMunicipal }))).status, 201)
    const { status, datos } = await registrar(formulario('cod-2', { codigoMunicipal }))
    assert.equal(status, 409)
    assert.deepEqual(Object.keys(datos.campos), ['codigoMunicipal'])
  })

  test('una contraseña débil se rechaza en el campo password', async () => {
    const { status, datos } = await registrar(formulario('pass', { password: 'solotexto' }))
    assert.equal(status, 400)
    assert.deepEqual(Object.keys(datos.campos), ['password'])
  })
})
