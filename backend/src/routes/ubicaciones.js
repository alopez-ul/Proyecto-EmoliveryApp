// US05 - Registro de ubicación del emolientero.
import { crearRouter } from '../router.js'
import { query } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { requiereRol, requiereSesion } from '../autenticacion.js'
import { validarUbicacion } from '../zonaCobertura.js'

const router = crearRouter()

const COLUMNAS = `id, lat, lng, precision_m AS "precisionM", fuente, registrada_en AS "registradaEn"`

// Ubicación actual (la más reciente) de cada emolientero activo que está atendiendo, es decir,
// con la jornada abierta (US06). Es pública: la usa el mapa de los clientes.
router.get('/', async (_req, res) => {
  const { rows } = await query(
    `SELECT DISTINCT ON (u.id)
            ub.id, u.nombre, ub.lat, ub.lng, ub.precision_m AS "precisionM",
            ub.fuente, ub.registrada_en AS "registradaEn"
     FROM ubicaciones ub
     JOIN usuarios u ON u.id = ub.emolientero_id
     WHERE u.rol = 'emolientero' AND u.estado = 'activo'
       AND EXISTS (SELECT 1 FROM jornadas j WHERE j.emolientero_id = u.id AND j.cerrada_en IS NULL)
     ORDER BY u.id, ub.registrada_en DESC`,
  )
  res.json(rows)
})

// Última ubicación registrada por el emolientero con sesión (o null si aún no registró ninguna).
router.get('/mia', requiereSesion, requiereRol('emolientero'), async (req, res) => {
  const { rows } = await query(
    `SELECT ${COLUMNAS} FROM ubicaciones WHERE emolientero_id = $1 ORDER BY registrada_en DESC LIMIT 1`,
    [req.usuario.id],
  )
  res.json(rows[0] ?? null)
})

// Registra la ubicación actual. Solo emolienteros con cuenta activa (verificada en US23):
// requiereSesion ya rechaza cuentas pendientes, rechazadas o suspendidas.
router.post('/', requiereSesion, requiereRol('emolientero'), async (req, res) => {
  const { lat, lng, precision } = req.body ?? {}
  const problema = validarUbicacion({ lat, lng, precision })
  if (problema) throw new ErrorHttp(problema.status, problema.error)

  const { rows } = await query(
    `INSERT INTO ubicaciones (emolientero_id, lat, lng, precision_m)
     VALUES ($1, $2, $3, $4) RETURNING ${COLUMNAS}`,
    [req.usuario.id, lat, lng, precision],
  )
  res.status(201).json(rows[0])
})

export default router
