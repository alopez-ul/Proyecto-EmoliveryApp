// US11 - Gestión de catálogo: el emolientero da de alta y edita los productos de su punto de venta.
import { crearRouter } from '../router.js'
import { query } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { requiereRol, requiereSesion } from '../autenticacion.js'
import { buscarNombreRepetido, validarProducto } from '../validaciones/producto.js'

const router = crearRouter()
router.use(requiereSesion, requiereRol('emolientero'))

const COLUMNAS = 'id, nombre, categoria, precio, disponible'
const MENSAJE_REPETIDO = 'Ya tienes un producto con ese nombre en tu catálogo.'

// Catálogo del emolientero con sesión, agrupado por categoría y en orden alfabético.
router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT ${COLUMNAS} FROM catalogo_productos WHERE emolientero_id = $1 ORDER BY categoria, lower(nombre)`,
    [req.usuario.id],
  )
  res.json(rows)
})

// T51: valida los datos y revisa que el nombre no se repita en su catálogo. Lanza 400 o 409 con `campos`.
async function validarYRevisarNombre(req, idPropio = null) {
  const { datos, errores } = validarProducto(req.body)
  if (Object.keys(errores).length) throw new ErrorHttp(400, 'Revisa los datos del producto.', errores)

  const { rows: existentes } = await query('SELECT id, nombre FROM catalogo_productos WHERE emolientero_id = $1', [req.usuario.id])
  if (buscarNombreRepetido(datos.nombre, existentes, idPropio)) {
    throw new ErrorHttp(409, MENSAJE_REPETIDO, { nombre: MENSAJE_REPETIDO })
  }
  return datos
}

// Otro registro simultáneo usó el nombre entre la revisión y el INSERT/UPDATE: lo frena el índice único.
function nombreRepetidoEnBd(err) {
  return err.code === '23505' && err.constraint === 'catalogo_productos_nombre_unico'
}

// T50 (alta) y T52 (persistencia): el producto queda ligado al emolientero de la sesión.
router.post('/', async (req, res) => {
  const datos = await validarYRevisarNombre(req)
  try {
    const { rows } = await query(
      `INSERT INTO catalogo_productos (emolientero_id, nombre, categoria, precio, disponible)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNAS}`,
      [req.usuario.id, datos.nombre, datos.categoria, datos.precio, datos.disponible],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (nombreRepetidoEnBd(err)) throw new ErrorHttp(409, MENSAJE_REPETIDO, { nombre: MENSAJE_REPETIDO })
    throw err
  }
})

// T50 (edición): solo puede editar productos de su propio catálogo.
router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new ErrorHttp(404, 'Producto no encontrado.')
  const datos = await validarYRevisarNombre(req, id)
  try {
    const { rows } = await query(
      `UPDATE catalogo_productos
       SET nombre = $3, categoria = $4, precio = $5, disponible = $6, actualizado_en = now()
       WHERE id = $1 AND emolientero_id = $2
       RETURNING ${COLUMNAS}`,
      [id, req.usuario.id, datos.nombre, datos.categoria, datos.precio, datos.disponible],
    )
    if (!rows[0]) throw new ErrorHttp(404, 'Producto no encontrado.')
    res.json(rows[0])
  } catch (err) {
    if (nombreRepetidoEnBd(err)) throw new ErrorHttp(409, MENSAJE_REPETIDO, { nombre: MENSAJE_REPETIDO })
    throw err
  }
})

export default router
