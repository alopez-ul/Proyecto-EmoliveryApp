// US22 - Publicación de noticias.
import { crearRouter } from '../router.js'
import { query } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { requiereRol, requiereSesion } from '../autenticacion.js'
import { PUBLICO_DEL_ROL, hoyEnLima, validarNoticia } from '../validaciones/noticia.js'

const router = crearRouter()
router.use(requiereSesion)

const COLUMNAS = `n.id, n.titulo, n.contenido, n.publico,
  to_char(n.fecha_publicacion, 'YYYY-MM-DD') AS "fechaPublicacion", n.creada_en AS "creadaEn"`

// T98: noticias del panel del usuario. Solo las de su público (o para todos) cuya fecha ya llegó,
// de la más reciente a la más antigua.
router.get('/', async (req, res) => {
  const publicos = ['todos', PUBLICO_DEL_ROL[req.usuario.rol]].filter(Boolean)
  const { rows } = await query(
    `SELECT ${COLUMNAS} FROM noticias n
     WHERE n.publico = ANY ($1) AND n.fecha_publicacion <= $2::date
     ORDER BY n.fecha_publicacion DESC, n.creada_en DESC
     LIMIT 50`,
    [publicos, hoyEnLima()],
  )
  res.json(rows)
})

// Administrador: todas las noticias, también las programadas para una fecha futura.
router.get('/todas', requiereRol('admin'), async (_req, res) => {
  const { rows } = await query(
    `SELECT ${COLUMNAS}, u.nombre AS autor, (n.fecha_publicacion > $1::date) AS programada
     FROM noticias n LEFT JOIN usuarios u ON u.id = n.autor_id
     ORDER BY n.fecha_publicacion DESC, n.creada_en DESC`,
    [hoyEnLima()],
  )
  res.json(rows)
})

// T97: publica una noticia. 400 con `campos` si hay datos inválidos (T99: incluida la fecha anterior a hoy).
router.post('/', requiereRol('admin'), async (req, res) => {
  const { datos, errores } = validarNoticia(req.body)
  if (Object.keys(errores).length) throw new ErrorHttp(400, 'Revisa los datos de la noticia.', errores)
  const { rows } = await query(
    `INSERT INTO noticias (autor_id, titulo, contenido, publico, fecha_publicacion)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, titulo, contenido, publico, to_char(fecha_publicacion, 'YYYY-MM-DD') AS "fechaPublicacion", creada_en AS "creadaEn"`,
    [req.usuario.id, datos.titulo, datos.contenido, datos.publico, datos.fechaPublicacion],
  )
  res.status(201).json(rows[0])
})

// Administrador: elimina una noticia.
router.delete('/:id', requiereRol('admin'), async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new ErrorHttp(404, 'Noticia no encontrada.')
  const { rowCount } = await query('DELETE FROM noticias WHERE id = $1', [id])
  if (!rowCount) throw new ErrorHttp(404, 'Noticia no encontrada.')
  res.status(204).end()
})

export default router
