import { Router } from 'express'
import { readDb, writeDb, nextId } from '../db.js'

const router = Router()

router.get('/', async (_req, res) => {
  const db = await readDb()
  res.json(db.puntos)
})

router.get('/:id', async (req, res) => {
  const db = await readDb()
  const punto = db.puntos.find((p) => p.id === Number(req.params.id))
  if (!punto) return res.status(404).json({ error: 'Punto no encontrado' })
  res.json(punto)
})

router.post('/', async (req, res) => {
  const { nombre, encargado, direccion = '', lat, lng, horario = '' } = req.body
  if (!nombre || !encargado || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'nombre, encargado, lat y lng son obligatorios' })
  }
  const db = await readDb()
  const punto = { id: nextId(db.puntos), nombre, encargado, direccion, lat, lng, horario, activo: true }
  db.puntos.push(punto)
  await writeDb(db)
  res.status(201).json(punto)
})

router.patch('/:id', async (req, res) => {
  const db = await readDb()
  const punto = db.puntos.find((p) => p.id === Number(req.params.id))
  if (!punto) return res.status(404).json({ error: 'Punto no encontrado' })
  const { id: _ignored, ...cambios } = req.body
  Object.assign(punto, cambios)
  await writeDb(db)
  res.json(punto)
})

router.delete('/:id', async (req, res) => {
  const db = await readDb()
  const id = Number(req.params.id)
  if (!db.puntos.some((p) => p.id === id)) return res.status(404).json({ error: 'Punto no encontrado' })
  db.puntos = db.puntos.filter((p) => p.id !== id)
  await writeDb(db)
  res.status(204).end()
})

export default router
