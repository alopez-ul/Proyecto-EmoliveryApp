// US05 - Registro de ubicación del emolientero. US08 - Confiabilidad de la ubicación (GET /).
import { crearRouter } from '../router.js'
import { query } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { requiereRol, requiereSesion } from '../autenticacion.js'
import { validarUbicacion } from '../zonaCobertura.js'
import { PatronHistorico } from '../fuentes/patronHistorico.js'
import { VIGENCIA_MAXIMA_MIN, resolverUbicaciones } from '../fuentesUbicacion.js'

const router = crearRouter()

const COLUMNAS = `id, lat, lng, precision_m AS "precisionM", fuente, registrada_en AS "registradaEn"`

// US08: ubicación de cada emolientero activo con la jornada abierta (US06) según la fuente más
// confiable (T43), con su antigüedad y nivel de confiabilidad (T44). Excluye las ubicaciones no
// confirmadas (T45). Es pública: la usa el mapa de los clientes.
router.get('/', async (_req, res) => {
  // Una lectura con más de 4 h tiene puntaje 0 y nunca está confirmada, así que no hace falta traerla.
  const { rows } = await query(
    `SELECT ub.id, ub.emolientero_id AS "emolienteroId", u.nombre, ub.lat, ub.lng,
            ub.precision_m AS "precisionM", ub.fuente, ub.registrada_en AS "registradaEn"
     FROM ubicaciones ub
     JOIN usuarios u ON u.id = ub.emolientero_id
     WHERE u.rol = 'emolientero' AND u.estado = 'activo'
       AND EXISTS (SELECT 1 FROM jornadas j WHERE j.emolientero_id = u.id AND j.cerrada_en IS NULL)
       AND ub.registrada_en > now() - make_interval(mins => $1)`,
    [VIGENCIA_MAXIMA_MIN],
  )
  res.json(resolverUbicaciones(rows))
})

// US10 - T48: ubicación APROXIMADA (fuente 'horario_habitual', baja precisión) de los emolienteros
// sin jornada abierta que, según sus puntos habituales, suelen estar en una zona a esta hora.
// Pública, para el mapa. Quien tiene la jornada abierta sale en GET / con su GPS y no aquí.
router.get('/estimadas', async (_req, res) => {
  res.json(await PatronHistorico.estimar())
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
