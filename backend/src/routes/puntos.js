import { crearRouter } from '../router.js'
import { query } from '../db.js'

const router = crearRouter()

const COLUMNAS = 'id, nombre, encargado, direccion, lat, lng, horario, activo'
const EDITABLES = ['nombre', 'encargado', 'direccion', 'lat', 'lng', 'horario', 'activo']

router.get('/', async (_req, res) => {
  const { rows } = await query(`SELECT ${COLUMNAS} FROM puntos ORDER BY id`)
  res.json(rows)
})

router.get('/:id', async (req, res) => {
  const { rows } = await query(`SELECT ${COLUMNAS} FROM puntos WHERE id = $1`, [Number(req.params.id)])
  if (!rows.length) return res.status(404).json({ error: 'Punto no encontrado' })
  res.json(rows[0])
})

router.post('/', async (req, res) => {
  const { nombre, encargado, direccion = '', lat, lng, horario = '' } = req.body
  if (!nombre || !encargado || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'nombre, encargado, lat y lng son obligatorios' })
  }
  const { rows } = await query(
    `INSERT INTO puntos (nombre, encargado, direccion, lat, lng, horario)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNAS}`,
    [nombre, encargado, direccion, lat, lng, horario],
  )
  res.status(201).json(rows[0])
})

router.patch('/:id', async (req, res) => {
  const cambios = EDITABLES.filter((campo) => req.body[campo] !== undefined)
  if (!cambios.length) return res.status(400).json({ error: `Nada que actualizar. Campos permitidos: ${EDITABLES.join(', ')}` })

  const asignaciones = cambios.map((campo, i) => `${campo} = $${i + 2}`).join(', ')
  const { rows } = await query(
    `UPDATE puntos SET ${asignaciones} WHERE id = $1 RETURNING ${COLUMNAS}`,
    [Number(req.params.id), ...cambios.map((campo) => req.body[campo])],
  )
  if (!rows.length) return res.status(404).json({ error: 'Punto no encontrado' })
  res.json(rows[0])
})

router.delete('/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM puntos WHERE id = $1', [Number(req.params.id)])
  if (!rowCount) return res.status(404).json({ error: 'Punto no encontrado' })
  res.status(204).end()
})

export default router
