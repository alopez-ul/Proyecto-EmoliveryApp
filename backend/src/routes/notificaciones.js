// Notificaciones del usuario con sesión iniciada (US23 - T31).
import { crearRouter } from '../router.js'
import { query } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { requiereSesion } from '../autenticacion.js'

const router = crearRouter()
router.use(requiereSesion)

router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT id, tipo, titulo, mensaje, leida, creado_en AS "creadoEn"
     FROM notificaciones WHERE usuario_id = $1
     ORDER BY creado_en DESC LIMIT 50`,
    [req.usuario.id],
  )
  res.json(rows)
})

router.post('/:id/leida', async (req, res) => {
  // Solo puede marcar sus propias notificaciones.
  const { rowCount } = await query('UPDATE notificaciones SET leida = TRUE WHERE id = $1 AND usuario_id = $2', [
    Number(req.params.id),
    req.usuario.id,
  ])
  if (!rowCount) throw new ErrorHttp(404, 'Notificación no encontrada.')
  res.json({ ok: true })
})

export default router
