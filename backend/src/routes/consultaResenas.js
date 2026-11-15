// US18 - Consultar reseñas y calificación de un emolientero (público, sin sesión).
import { crearRouter } from '../router.js'
import { query } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { nombrePublico, ordenarPorFecha, resumenResenas } from '../consultaResenas.js'

const router = crearRouter()

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// T87: reseñas publicadas, de la más reciente a la más antigua, con el promedio y el total.
// T88: si no tiene reseñas responde 200 con total 0, promedio null y la lista vacía.
router.get('/emolientero/:emolienteroId', async (req, res) => {
  const { emolienteroId } = req.params
  if (!UUID.test(emolienteroId)) throw new ErrorHttp(404, 'Emolientero no encontrado.')

  const { rows: [emolientero] } = await query(
    `SELECT id, nombre FROM usuarios WHERE id = $1 AND rol = 'emolientero' AND estado = 'activo'`,
    [emolienteroId],
  )
  if (!emolientero) throw new ErrorHttp(404, 'Emolientero no encontrado.')

  // Solo las publicadas: una reseña habilitada (US15) que el cliente aún no escribe no tiene calificación.
  const { rows } = await query(
    `SELECT r.id, r.calificacion, r.comentario, r.publicada_en AS "publicadaEn", u.nombre AS autor
     FROM resenas r JOIN usuarios u ON u.id = r.cliente_id
     WHERE r.emolientero_id = $1 AND r.publicada_en IS NOT NULL`,
    [emolienteroId],
  )
  const resenas = ordenarPorFecha(rows).map((r) => ({ ...r, autor: nombrePublico(r.autor) }))
  res.json({ emolientero, ...resumenResenas(resenas), resenas })
})

export default router
