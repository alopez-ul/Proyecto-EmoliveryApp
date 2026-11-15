// US22 - T98/T99: noticias contra la API real (BD de .env.local).
// Crea usuarios test-<id>@emolivery.test y sus noticias, y los borra al terminar.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { app } from '../src/app.js'
import { pool } from '../src/db.js'
import { hashContrasena } from '../src/seguridad.js'
import { hoyEnLima } from '../src/validaciones/noticia.js'

const SUFIJO = randomBytes(4).toString('hex')
const PASSWORD = 'Prueba1234'
const correo = (n) => `test-${SUFIJO}-${n}@emolivery.test`
let servidor, base
const tokens = {}
const creadas = {} // nombre → id

const HOY = hoyEnLima()
const enDias = (dias) => hoyEnLima(new Date(Date.now() + dias * 86_400_000))

async function crearUsuario(nombre, rol) {
  await pool.query(`INSERT INTO usuarios (nombre, correo, password_hash, rol, estado) VALUES ($1, $2, $3, $4, 'activo')`, [
    `Test ${nombre}`, correo(nombre), await hashContrasena(PASSWORD), rol,
  ])
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

const noticia = (cambios) => ({
  titulo: `Noticia de prueba ${SUFIJO}`,
  contenido: 'Contenido de la noticia de prueba para el panel.',
  publico: 'todos',
  fechaPublicacion: HOY,
  ...cambios,
})
const publicar = (cambios) => api('POST', '/api/noticias', { nombre: 'admin', body: noticia(cambios) })
// Solo las noticias de esta prueba (la BD compartida puede tener otras).
const mias = (lista) => lista.filter((n) => n.titulo.endsWith(SUFIJO)).map((n) => n.titulo.split(' ')[0])

before(async () => {
  servidor = app.listen(0)
  base = `http://localhost:${servidor.address().port}`
  for (const [n, rol] of [['admin', 'admin'], ['cliente', 'cliente'], ['emo', 'emolientero']]) await crearUsuario(n, rol)
})

after(async () => {
  await pool.query('DELETE FROM noticias WHERE titulo LIKE $1', [`%${SUFIJO}`])
  await pool.query('DELETE FROM usuarios WHERE correo LIKE $1', [`test-${SUFIJO}-%`])
  await pool.end()
  servidor.close()
})

describe('T97: publicar una noticia', () => {
  test('solo el administrador publica (sin sesión 401, cliente 403)', async () => {
    assert.equal((await api('POST', '/api/noticias', { body: noticia() })).status, 401)
    assert.equal((await api('POST', '/api/noticias', { nombre: 'cliente', body: noticia() })).status, 403)
  })

  test('publica para hoy y para una fecha futura, con su público', async () => {
    for (const [nombre, cambios] of Object.entries({
      Todos: { publico: 'todos' },
      Clientes: { publico: 'clientes' },
      Emolienteros: { publico: 'emolienteros' },
      Futura: { publico: 'todos', fechaPublicacion: enDias(3) },
    })) {
      const { status, datos } = await publicar({ ...cambios, titulo: `${nombre} ${SUFIJO}` })
      assert.equal(status, 201, nombre)
      creadas[nombre] = datos.id
    }
  })
})

describe('T99: validación de campos y fecha anterior a hoy', () => {
  test('fecha anterior a hoy → 400 con el error en fechaPublicacion', async () => {
    const { status, datos } = await publicar({ fechaPublicacion: enDias(-1) })
    assert.equal(status, 400)
    assert.equal(datos.campos.fechaPublicacion, 'La fecha de publicación no puede ser anterior a hoy.')
  })

  test('campos vacíos o inválidos → 400 con el error de cada uno', async () => {
    const { status, datos } = await publicar({ titulo: '', contenido: 'corto', publico: 'admins', fechaPublicacion: '2026-02-30' })
    assert.equal(status, 400)
    assert.deepEqual(Object.keys(datos.campos).sort(), ['contenido', 'fechaPublicacion', 'publico', 'titulo'])
  })
})

describe('T98: listado por fecha en el panel del usuario', () => {
  before(async () => {
    // Una noticia ya publicada hace dos días (la API no deja crearla con fecha pasada, por eso va directo).
    await pool.query(
      `INSERT INTO noticias (titulo, contenido, publico, fecha_publicacion) VALUES ($1, 'Noticia publicada hace dos días.', 'todos', $2)`,
      [`Antigua ${SUFIJO}`, enDias(-2)],
    )
  })

  test('el cliente ve las de todos y las de clientes, de la más reciente a la más antigua', async () => {
    const { status, datos } = await api('GET', '/api/noticias', { nombre: 'cliente' })
    assert.equal(status, 200)
    assert.deepEqual(mias(datos), ['Clientes', 'Todos', 'Antigua'])
  })

  test('el emolientero no ve las de clientes', async () => {
    const { datos } = await api('GET', '/api/noticias', { nombre: 'emo' })
    assert.deepEqual(mias(datos), ['Emolienteros', 'Todos', 'Antigua'])
  })

  test('las programadas para más adelante no aparecen todavía', async () => {
    const { datos } = await api('GET', '/api/noticias', { nombre: 'cliente' })
    assert.ok(!mias(datos).includes('Futura'))
  })

  test('el administrador ve todas, marcando las programadas', async () => {
    assert.equal((await api('GET', '/api/noticias/todas', { nombre: 'cliente' })).status, 403)
    const { datos } = await api('GET', '/api/noticias/todas', { nombre: 'admin' })
    const futura = datos.find((n) => n.id === creadas.Futura)
    assert.equal(futura.programada, true)
    assert.equal(datos.find((n) => n.id === creadas.Todos).programada, false)
    assert.equal(mias(datos)[0], 'Futura', 'la de fecha más lejana va primero')
  })

  test('el administrador puede eliminar una noticia', async () => {
    assert.equal((await api('DELETE', `/api/noticias/${creadas.Futura}`, { nombre: 'admin' })).status, 204)
    assert.equal((await api('DELETE', `/api/noticias/${creadas.Futura}`, { nombre: 'admin' })).status, 404)
  })
})
