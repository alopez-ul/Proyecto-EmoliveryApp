// Catálogo de productos de cada emolientero.
// US12 - Consulta de catálogo y precios: vista pública para clientes (GET /:emolienteroId).
// US11 - Gestión de catálogo: el emolientero da de alta y edita los productos de su punto de venta.
import { crearRouter } from '../router.js'
import { query } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { requiereRol, requiereSesion } from '../autenticacion.js'
import { CATEGORIAS, buscarNombreRepetido, validarProducto } from '../validaciones/producto.js'

const router = crearRouter()

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const MOTIVO_FUERA_DE_JORNADA = 'Este emolientero está fuera de jornada. Puedes ver su catálogo, pero no comprar hasta que abra.'

// ---------- US12: vista pública ----------

// Catálogo de un emolientero agrupado por categoría (T54, en el orden de CATEGORIAS). Solo se publica
// el de cuentas activas (verificadas en US23): un emolientero pendiente, rechazado o suspendido responde 404.
// Va antes de requiereSesion: es la única ruta pública de este router.
router.get('/:emolienteroId', async (req, res) => {
  const { emolienteroId } = req.params
  if (!UUID.test(emolienteroId)) throw new ErrorHttp(404, 'Emolientero no encontrado.')

  const { rows: [emolientero] } = await query(
    `SELECT u.id, u.nombre,
            EXISTS (SELECT 1 FROM jornadas j WHERE j.emolientero_id = u.id AND j.cerrada_en IS NULL) AS "enJornada"
     FROM usuarios u
     WHERE u.id = $1 AND u.rol = 'emolientero' AND u.estado = 'activo'`,
    [emolienteroId],
  )
  if (!emolientero) throw new ErrorHttp(404, 'Emolientero no encontrado.')

  const { rows: productos } = await query(
    `SELECT id, nombre, descripcion, categoria, precio, disponible
     FROM catalogo_productos WHERE emolientero_id = $1
     ORDER BY lower(nombre)`,
    [emolienteroId],
  )

  // T56: fuera de jornada nada se puede comprar. T55: un producto agotado tampoco.
  const puedeComprar = emolientero.enJornada
  const categorias = Object.entries(CATEGORIAS)
    .map(([id, nombre]) => ({
      id,
      nombre,
      productos: productos
        .filter((p) => p.categoria === id)
        .map(({ categoria, ...p }) => ({ ...p, comprable: puedeComprar && p.disponible })),
    }))
    .filter((c) => c.productos.length)

  res.json({
    emolientero,
    puedeComprar,
    motivoNoCompra: puedeComprar ? null : MOTIVO_FUERA_DE_JORNADA,
    categorias,
  })
})

// ---------- US11: gestión por el emolientero (con sesión) ----------

router.use(requiereSesion, requiereRol('emolientero'))

const COLUMNAS = 'id, nombre, descripcion, categoria, precio, disponible'
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
      `INSERT INTO catalogo_productos (emolientero_id, nombre, descripcion, categoria, precio, disponible)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNAS}`,
      [req.usuario.id, datos.nombre, datos.descripcion, datos.categoria, datos.precio, datos.disponible],
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
       SET nombre = $3, descripcion = $4, categoria = $5, precio = $6, disponible = $7, actualizado_en = now()
       WHERE id = $1 AND emolientero_id = $2
       RETURNING ${COLUMNAS}`,
      [id, req.usuario.id, datos.nombre, datos.descripcion, datos.categoria, datos.precio, datos.disponible],
    )
    if (!rows[0]) throw new ErrorHttp(404, 'Producto no encontrado.')
    res.json(rows[0])
  } catch (err) {
    if (nombreRepetidoEnBd(err)) throw new ErrorHttp(409, MENSAJE_REPETIDO, { nombre: MENSAJE_REPETIDO })
    throw err
  }
})

export default router
