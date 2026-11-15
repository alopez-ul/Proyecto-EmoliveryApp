// US25 - Moderación de contenido: reportes de reseñas y decisión del administrador.
import { crearRouter } from '../router.js'
import { pool, query } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { requiereRol, requiereSesion } from '../autenticacion.js'
import { DECISIONES, reputacionTrasDecision, validarDecision, validarReporte, verificarDecidible } from '../moderacion.js'

const router = crearRouter()
router.use(requiereSesion)

// Cualquier usuario con sesión reporta una reseña publicada y visible (no la suya).
router.post('/resenas/:resenaId/reportes', async (req, res) => {
  const resenaId = Number(req.params.resenaId)
  const { datos, errores } = validarReporte(req.body)
  if (Object.keys(errores).length) throw new ErrorHttp(400, errores.motivo, errores)

  const { rows: [resena] } = Number.isInteger(resenaId)
    ? await query('SELECT id, cliente_id, comentario FROM resenas WHERE id = $1 AND publicada_en IS NOT NULL AND oculta_en IS NULL', [resenaId])
    : { rows: [] }
  if (!resena) throw new ErrorHttp(404, 'Reseña no encontrada.')
  if (resena.cliente_id === req.usuario.id) throw new ErrorHttp(422, 'No puedes reportar tu propia reseña.')

  try {
    const { rows: [reporte] } = await query(
      `INSERT INTO reportes (resena_id, reportado_id, reportante_id, motivo, contenido)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, estado, creado_en AS "creadoEn"`,
      [resena.id, resena.cliente_id, req.usuario.id, datos.motivo, resena.comentario ?? ''],
    )
    res.status(201).json(reporte)
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'reportes_uno_pendiente_por_persona') {
      throw new ErrorHttp(409, 'Ya reportaste esta reseña. El administrador la está revisando.')
    }
    throw err
  }
})

// ---------- Solo administrador ----------

// T104: bandeja de reportes. ?estado=pendientes (por defecto, del más antiguo al más reciente)
// o ?estado=atendidos (registro de decisiones, del más reciente al más antiguo).
router.get('/reportes', requiereRol('admin'), async (req, res) => {
  const atendidos = req.query.estado === 'atendidos'
  const { rows } = await query(
    `SELECT rp.id, rp.estado, rp.motivo, rp.contenido, rp.creado_en AS "creadoEn",
            rp.resena_id AS "resenaId", r.calificacion, r.comentario AS "contenidoActual",
            json_build_object('id', au.id, 'nombre', au.nombre, 'reputacion', au.reputacion) AS reportado,
            rt.nombre AS reportante,
            rp.decidido_en AS "decididoEn", rp.nota_decision AS "notaDecision", ad.nombre AS "decididoPor"
     FROM reportes rp
     JOIN usuarios au ON au.id = rp.reportado_id
     JOIN usuarios rt ON rt.id = rp.reportante_id
     LEFT JOIN resenas r ON r.id = rp.resena_id
     LEFT JOIN usuarios ad ON ad.id = rp.decidido_por
     WHERE ${atendidos ? "rp.estado <> 'pendiente'" : "rp.estado = 'pendiente'"}
     ORDER BY ${atendidos ? 'rp.decidido_en DESC' : 'rp.creado_en'}
     LIMIT 200`,
  )
  res.json(rows)
})

// T105 y T106: ocultar o mantener, con registro de la decisión y ajuste de la reputación, en una transacción.
// La decisión se aplica a todos los reportes pendientes de la misma reseña (no se penaliza dos veces).
router.post('/reportes/:id/decision', requiereRol('admin'), async (req, res) => {
  const id = Number(req.params.id)
  const { datos, errores } = validarDecision(req.body)
  if (Object.keys(errores).length) throw new ErrorHttp(400, 'Revisa la decisión.', errores)

  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')
    const { rows: [reporte] } = Number.isInteger(id)
      ? await cliente.query(
          `SELECT id, estado, resena_id AS "resenaId", reportado_id AS "reportadoId" FROM reportes WHERE id = $1 FOR UPDATE`,
          [id],
        )
      : { rows: [] }

    // T107: si el autor ya eliminó la reseña, el reporte se cierra con ese estado y se informa (410).
    if (reporte?.estado === 'pendiente' && reporte.resenaId == null) {
      await cliente.query(
        `UPDATE reportes SET estado = 'contenido_eliminado', decidido_por = $2, decidido_en = now(), nota_decision = $3 WHERE id = $1`,
        [id, req.usuario.id, datos.nota],
      )
      await cliente.query('COMMIT')
    }
    verificarDecidible(reporte)

    await cliente.query(
      `UPDATE reportes SET estado = $3, decidido_por = $4, decidido_en = now(), nota_decision = $5
       WHERE resena_id = $1 AND (id = $2 OR estado = 'pendiente')`,
      [reporte.resenaId, id, DECISIONES[datos.decision], req.usuario.id, datos.nota],
    )

    const { rows: [autor] } = await cliente.query('SELECT reputacion FROM usuarios WHERE id = $1 FOR UPDATE', [reporte.reportadoId])
    const reputacion = reputacionTrasDecision(autor.reputacion, datos.decision)
    if (datos.decision === 'ocultar') {
      await cliente.query('UPDATE resenas SET oculta_en = now() WHERE id = $1 AND oculta_en IS NULL', [reporte.resenaId])
      await cliente.query('UPDATE usuarios SET reputacion = $2, actualizado_en = now() WHERE id = $1', [reporte.reportadoId, reputacion])
    }
    await cliente.query('COMMIT')
    res.json({ id, estado: DECISIONES[datos.decision], reputacionReportado: reputacion })
  } catch (err) {
    await cliente.query('ROLLBACK')
    throw err
  } finally {
    cliente.release()
  }
})

export default router
