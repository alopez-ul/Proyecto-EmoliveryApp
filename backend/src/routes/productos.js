import { crearRouter } from '../router.js'
import { query } from '../db.js'

const router = crearRouter()

router.get('/', async (_req, res) => {
  const { rows } = await query('SELECT id, nombre, precio FROM productos ORDER BY id')
  res.json(rows)
})

export default router
