import { crearRouter } from '../router.js'
import { query } from '../db.js'

const router = crearRouter()

const COLUMNAS = 'id, punto_id AS "puntoId", producto_id AS "productoId", cantidad, total, fecha'

router.get('/', async (req, res) => {
  const { puntoId } = req.query
  const { rows } = puntoId
    ? await query(`SELECT ${COLUMNAS} FROM ventas WHERE punto_id = $1 ORDER BY fecha`, [Number(puntoId)])
    : await query(`SELECT ${COLUMNAS} FROM ventas ORDER BY fecha`)
  res.json(rows)
})

// "Hoy" se calcula con la hora de Lima, no con UTC.
router.get('/resumen', async (_req, res) => {
  const { rows } = await query(`
    WITH hoy AS (
      SELECT date_trunc('day', now() AT TIME ZONE 'America/Lima') AT TIME ZONE 'America/Lima' AS inicio
    )
    SELECT
      (SELECT count(*) FROM puntos WHERE activo)::int                                            AS "puntosActivos",
      (SELECT count(*) FROM puntos)::int                                                         AS "puntosTotales",
      (SELECT coalesce(sum(cantidad), 0) FROM ventas, hoy WHERE fecha >= hoy.inicio)::int        AS "ventasHoy",
      (SELECT coalesce(sum(total), 0) FROM ventas, hoy WHERE fecha >= hoy.inicio)::float8        AS "ingresosHoy",
      (SELECT coalesce(sum(total), 0) FROM ventas)::float8                                       AS "ingresosTotales"
  `)
  res.json(rows[0])
})

router.post('/', async (req, res) => {
  const { puntoId, productoId, cantidad } = req.body
  const qty = Number(cantidad)
  if (!Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ error: 'puntoId, productoId y cantidad (entero > 0) son obligatorios' })
  }
  // El total se calcula en la BD con el precio vigente; solo inserta si el punto y el producto existen.
  const { rows } = await query(
    `INSERT INTO ventas (punto_id, producto_id, cantidad, total)
     SELECT pt.id, pr.id, $3::int, round(pr.precio * $3::int, 2)
     FROM puntos pt, productos pr
     WHERE pt.id = $1 AND pr.id = $2
     RETURNING ${COLUMNAS}`,
    [Number(puntoId), Number(productoId), qty],
  )
  if (!rows.length) {
    return res.status(400).json({ error: 'puntoId, productoId y cantidad (entero > 0) son obligatorios' })
  }
  res.status(201).json(rows[0])
})

export default router
