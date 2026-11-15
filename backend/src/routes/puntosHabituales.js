// US10 - Puntos habituales del emolientero (zona, día y rango horario).
import { crearRouter } from '../router.js'
import { query } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { requiereRol, requiereSesion } from '../autenticacion.js'
import { buscarTraslape, mensajeTraslape, validarPuntoHabitual } from '../validaciones/puntoHabitual.js'

const router = crearRouter()
router.use(requiereSesion, requiereRol('emolientero'))

const COLUMNAS = `id, referencia, lat, lng, dia_semana AS "diaSemana",
  to_char(hora_inicio, 'HH24:MI') AS "horaInicio", to_char(hora_fin, 'HH24:MI') AS "horaFin"`

// Puntos habituales del emolientero con sesión, en orden de la semana.
router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT ${COLUMNAS} FROM puntos_habituales WHERE emolientero_id = $1 ORDER BY dia_semana, hora_inicio`,
    [req.usuario.id],
  )
  res.json(rows)
})

// Registra un punto. 400 con `campos` si hay datos inválidos (incluida la hora de fin anterior al
// inicio); 409 si se cruza con otro punto suyo del mismo día.
router.post('/', async (req, res) => {
  const { datos, errores } = validarPuntoHabitual(req.body)
  if (Object.keys(errores).length) throw new ErrorHttp(400, 'Revisa los datos del punto habitual.', errores)

  const { rows: delDia } = await query(
    `SELECT ${COLUMNAS} FROM puntos_habituales WHERE emolientero_id = $1 AND dia_semana = $2`,
    [req.usuario.id, datos.diaSemana],
  )
  const conflicto = buscarTraslape(datos, delDia)
  if (conflicto) throw new ErrorHttp(409, mensajeTraslape(conflicto), { horaInicio: mensajeTraslape(conflicto) })

  try {
    const { rows } = await query(
      `INSERT INTO puntos_habituales (emolientero_id, referencia, lat, lng, dia_semana, hora_inicio, hora_fin)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLUMNAS}`,
      [req.usuario.id, datos.referencia, datos.lat, datos.lng, datos.diaSemana, datos.horaInicio, datos.horaFin],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    // Otro registro simultáneo ocupó ese horario entre la revisión y el INSERT: lo frena la restricción EXCLUDE.
    if (err.code === '23P01' && err.constraint === 'puntos_habituales_sin_traslape') {
      throw new ErrorHttp(409, 'Ese horario se cruza con otro de tus puntos habituales del mismo día.')
    }
    throw err
  }
})

// Elimina un punto propio.
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new ErrorHttp(404, 'Punto habitual no encontrado.')
  const { rowCount } = await query('DELETE FROM puntos_habituales WHERE id = $1 AND emolientero_id = $2', [id, req.usuario.id])
  if (!rowCount) throw new ErrorHttp(404, 'Punto habitual no encontrado.')
  res.status(204).end()
})

export default router
