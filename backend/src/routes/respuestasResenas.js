// US19 - Respuesta del emolientero a las reseñas de su negocio. Se monta en /api/resenas junto con la
// consulta pública de US18 (consultaResenas.js).
import { crearRouter } from '../router.js'
import { pool, query } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { requiereRol, requiereSesion } from '../autenticacion.js'
import { notificar } from '../notificaciones.js'
import { nombrePublico } from '../consultaResenas.js'
import { validarRespuesta, verificarRespondible } from '../respuestaResena.js'

const router = crearRouter()
const soloEmolientero = [requiereSesion, requiereRol('emolientero')]

// Reseñas publicadas sobre el emolientero con sesión, de la más reciente a la más antigua. Incluye las
// ocultas por moderación (marcadas), para que sepa por qué no puede responderlas.
router.get('/mias', ...soloEmolientero, async (req, res) => {
  const { rows } = await query(
    `SELECT r.id, r.calificacion, r.comentario, r.publicada_en AS "publicadaEn", u.nombre AS autor,
            (r.oculta_en IS NOT NULL) AS oculta, r.respuesta, r.respondida_en AS "respondidaEn"
     FROM resenas r JOIN usuarios u ON u.id = r.cliente_id
     WHERE r.emolientero_id = $1 AND r.publicada_en IS NOT NULL
     ORDER BY r.publicada_en DESC`,
    [req.usuario.id],
  )
  res.json(rows.map((r) => ({ ...r, autor: nombrePublico(r.autor) })))
})

// T90 + T91: publica la respuesta vinculada a la reseña. Las condiciones van en el mismo UPDATE: si
// llegan dos respuestas a la vez, o la moderación oculta la reseña en ese instante, solo una gana.
router.post('/:id/respuesta', ...soloEmolientero, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new ErrorHttp(404, 'Reseña no encontrada.')
  const { datos, errores } = validarRespuesta(req.body)
  if (Object.keys(errores).length) throw new ErrorHttp(400, errores.respuesta, errores)

  const { rows: [resena] } = await query(
    `UPDATE resenas r SET respuesta = $3, respondida_en = now()
     FROM usuarios c
     WHERE r.id = $1 AND r.emolientero_id = $2 AND r.publicada_en IS NOT NULL
       AND r.oculta_en IS NULL AND r.respuesta IS NULL AND c.id = r.cliente_id
     RETURNING r.id, r.respuesta, r.respondida_en AS "respondidaEn", c.id AS "clienteId", c.correo AS "clienteCorreo"`,
    [id, req.usuario.id, datos.respuesta],
  )
  if (!resena) {
    const { rows: [actual] } = await query(
      `SELECT emolientero_id AS "emolienteroId", publicada_en AS "publicadaEn", oculta_en AS "ocultaEn", respuesta
       FROM resenas WHERE id = $1`,
      [id],
    )
    verificarRespondible(actual, req.usuario.id)
    throw new ErrorHttp(409, 'No se pudo publicar la respuesta. Vuelve a cargar tus reseñas.')
  }

  const { clienteId, clienteCorreo, ...publica } = resena
  await notificar(pool, { id: clienteId, correo: clienteCorreo }, {
    tipo: 'resena_respondida',
    titulo: 'Respondieron tu reseña',
    mensaje: `${req.usuario.nombre} respondió a tu reseña.`,
  })
  res.status(201).json(publica)
})

export default router
