// US06 - Apertura y cierre de jornada del emolientero.
import { crearRouter } from '../router.js'
import { query } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { requiereRol, requiereSesion } from '../autenticacion.js'

const router = crearRouter()
router.use(requiereSesion, requiereRol('emolientero'))

const COLUMNAS = 'id, abierta_en AS "abiertaEn", cerrada_en AS "cerradaEn"'

// Inicio del día de hoy en hora de Lima (las jornadas y la ubicación "de hoy" se cuentan así).
const INICIO_HOY = "date_trunc('day', now() AT TIME ZONE 'America/Lima') AT TIME ZONE 'America/Lima'"

async function ubicacionDeHoy(emolienteroId) {
  const { rows } = await query(
    `SELECT registrada_en AS "registradaEn" FROM ubicaciones
     WHERE emolientero_id = $1 AND registrada_en >= ${INICIO_HOY}
     ORDER BY registrada_en DESC LIMIT 1`,
    [emolienteroId],
  )
  return rows[0] ?? null
}

// Órdenes que el emolientero aún debe entregar (o cancelar).
const ORDENES_SIN_ENTREGAR = "SELECT 1 FROM ordenes WHERE emolientero_id = $1 AND estado IN ('pendiente', 'en_camino')"

// Estado para la pantalla: jornada abierta (si hay), ubicación de hoy, jornadas de hoy y órdenes sin entregar.
router.get('/estado', async (req, res) => {
  const id = req.usuario.id
  const [{ rows: abierta }, ubicacion, { rows: hoy }, { rowCount: ordenesPendientes }] = await Promise.all([
    query(`SELECT ${COLUMNAS} FROM jornadas WHERE emolientero_id = $1 AND cerrada_en IS NULL`, [id]),
    ubicacionDeHoy(id),
    query(`SELECT ${COLUMNAS} FROM jornadas WHERE emolientero_id = $1 AND abierta_en >= ${INICIO_HOY} ORDER BY abierta_en`, [id]),
    query(ORDENES_SIN_ENTREGAR, [id]),
  ])
  res.json({ jornada: abierta[0] ?? null, ubicacionHoy: ubicacion, jornadasHoy: hoy, ordenesPendientes })
})

// Abrir: exige haber registrado la ubicación hoy (US05; esa ruta ya valida que sea en La Molina).
router.post('/abrir', async (req, res) => {
  if (!(await ubicacionDeHoy(req.usuario.id))) {
    throw new ErrorHttp(422, 'No puedes iniciar jornada sin registrar tu ubicación en La Molina. Regístrala primero desde tu panel.')
  }
  try {
    const { rows } = await query(`INSERT INTO jornadas (emolientero_id) VALUES ($1) RETURNING ${COLUMNAS}`, [req.usuario.id])
    res.status(201).json(rows[0])
  } catch (err) {
    // El índice único impide dos jornadas abiertas, incluso con pedidos simultáneos.
    if (err.code === '23505' && err.constraint === 'jornadas_una_abierta') throw new ErrorHttp(409, 'Ya tienes una jornada abierta.')
    throw err
  }
})

// Cerrar la jornada abierta, solo si no quedan órdenes sin entregar. La condición va en el mismo
// UPDATE para que una orden que llegue en ese instante no se cuele entre la revisión y el cierre.
router.post('/cerrar', async (req, res) => {
  const id = req.usuario.id
  const { rows } = await query(
    `UPDATE jornadas SET cerrada_en = now()
     WHERE emolientero_id = $1 AND cerrada_en IS NULL AND NOT EXISTS (${ORDENES_SIN_ENTREGAR})
     RETURNING ${COLUMNAS}`,
    [id],
  )
  if (rows.length) return res.json(rows[0])

  // No se cerró: ¿no había jornada abierta o había órdenes sin entregar?
  const { rowCount: abierta } = await query('SELECT 1 FROM jornadas WHERE emolientero_id = $1 AND cerrada_en IS NULL', [id])
  if (!abierta) throw new ErrorHttp(409, 'No tienes una jornada abierta.')
  throw new ErrorHttp(422, 'No puedes cerrar la jornada con órdenes pendientes de entrega. Completa o cancela las órdenes primero.')
})

export default router
