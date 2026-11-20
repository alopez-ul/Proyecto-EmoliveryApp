// US17 - Publicar reseña. Al entregar un pedido (US15) se habilita una reseña para el cliente; aquí la completa
// con su calificación y comentario. Se monta en /api/resenas junto con US18 (consulta) y US19 (respuesta).
import { crearRouter } from '../router.js'
import { pool } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { requiereRol, requiereSesion } from '../autenticacion.js'
import { notificar } from '../notificaciones.js'
import { validarResena } from '../validaciones/resena.js'

const router = crearRouter()

// POST /api/resenas/orden/:ordenId  { calificacion (1-5), comentario }  (solo el cliente que compró)
// T84: solo sobre una compra propia y entregada. T85: una reseña por pedido. T86: publicarla y avisar al emolientero.
router.post('/orden/:ordenId', requiereSesion, requiereRol('cliente'), async (req, res) => {
  const ordenId = Number(req.params.ordenId)
  if (!Number.isInteger(ordenId) || ordenId <= 0) throw new ErrorHttp(404, 'Pedido no encontrado.')
  const { datos, errores } = validarResena(req.body)
  if (Object.keys(errores).length) throw new ErrorHttp(400, 'Revisa tu reseña.', errores)

  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')
    // La condición publicada_en IS NULL hace que la reseña se publique una sola vez, también ante dos envíos a la vez.
    const { rows: [resena] } = await cliente.query(
      `UPDATE resenas r SET calificacion = $3, comentario = $4, publicada_en = now()
       FROM usuarios e
       WHERE r.orden_id = $1 AND r.cliente_id = $2 AND r.publicada_en IS NULL AND e.id = r.emolientero_id
       RETURNING r.id, r.emolientero_id AS "emolienteroId", e.correo AS "emolienteroCorreo",
                 r.calificacion, r.comentario, r.publicada_en AS "publicadaEn"`,
      [ordenId, req.usuario.id, datos.calificacion, datos.comentario],
    )
    if (!resena) {
      const { rows: [actual] } = await cliente.query(
        `SELECT o.estado, r.publicada_en AS "publicadaEn"
         FROM ordenes o LEFT JOIN resenas r ON r.orden_id = o.id
         WHERE o.id = $1 AND o.cliente_id = $2`,
        [ordenId, req.usuario.id],
      )
      if (!actual) throw new ErrorHttp(404, 'Solo puedes publicar una reseña sobre una compra propia verificada.')
      if (actual.publicadaEn) throw new ErrorHttp(409, 'Ya has publicado una reseña para esta orden de compra.')
      throw new ErrorHttp(409, 'Solo puedes calificar pedidos que ya hayan sido entregados.')
    }

    await notificar(cliente, { id: resena.emolienteroId, correo: resena.emolienteroCorreo }, {
      tipo: 'nueva_resena',
      titulo: `Nueva reseña: ${'★'.repeat(resena.calificacion)}${'☆'.repeat(5 - resena.calificacion)}`,
      mensaje: `${req.usuario.nombre} calificó su pedido #${ordenId}. Puedes leerla y responderla desde "Mis reseñas".`,
    })
    await cliente.query('COMMIT')

    const { emolienteroCorreo, ...publicada } = resena
    res.status(201).json(publicada)
  } catch (err) {
    await cliente.query('ROLLBACK')
    throw err
  } finally {
    cliente.release()
  }
})

export default router
