// US05 - Registro de ubicación del emolientero. US08 - Confiabilidad de la ubicación (GET /).
import { crearRouter } from '../router.js'
import { query } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { requiereRol, requiereSesion } from '../autenticacion.js'
import { validarUbicacion } from '../zonaCobertura.js'
import { PatronHistorico, ubicacionesVigentes } from '../fuentesUbicacion.js'

const router = crearRouter()

const COLUMNAS = `id, lat, lng, precision_m AS "precisionM", fuente, registrada_en AS "registradaEn"`

// US08: ubicación de cada emolientero activo con la jornada abierta (US06) según la fuente más
// confiable (T43), con su antigüedad y nivel de confiabilidad (T44). Excluye las ubicaciones no
// confirmadas (T45). Es pública: la usa el mapa de los clientes.
router.get('/', async (_req, res) => {
  res.json(await ubicacionesVigentes())
})

// US10 - T48: ubicación APROXIMADA (fuente 'horario_habitual', baja precisión) de los emolienteros
// sin jornada abierta que, según sus puntos habituales, suelen estar en una zona a esta hora.
// Pública, para el mapa. Quien tiene la jornada abierta sale en GET / con su GPS y no aquí.
router.get('/estimadas', async (_req, res) => {
  res.json(await PatronHistorico.estimar())
})

// Última ubicación registrada por el emolientero con sesión con SU GPS (o null si aún no registró ninguna).
// Los avistamientos de clientes (US09) no cuentan: son reportes de otros.
router.get('/mia', requiereSesion, requiereRol('emolientero'), async (req, res) => {
  const { rows } = await query(
    `SELECT ${COLUMNAS} FROM ubicaciones WHERE emolientero_id = $1 AND fuente = 'gps_emolientero'
     ORDER BY registrada_en DESC LIMIT 1`,
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
