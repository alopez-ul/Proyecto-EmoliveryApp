// US13 - Compra anticipada: el cliente confirma su carrito y se crea la orden pendiente de pago.
// Se monta en /api/ordenes junto con las rutas de US15 (routes/ordenes.js): por eso el rol se exige en cada
// ruta y no en todo el router, y /:id solo acepta números (no captura /mias ni /por-entregar).
import { crearRouter } from '../router.js'
import { pool, query } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { requiereRol, requiereSesion } from '../autenticacion.js'
import { Orden, verificarCompra } from '../orden.js'
import { validarCarrito } from '../validaciones/compra.js'
import { generarCodigoRecojo } from '../codigoRecojo.js'

const router = crearRouter()
const soloCliente = [requiereSesion, requiereRol('cliente')]

// T60 y T61: confirma la compra. Todo ocurre en una transacción: si algo falla, no queda una orden a medias.
router.post('/', ...soloCliente, async (req, res) => {
  const { datos, errores } = validarCarrito(req.body)
  if (Object.keys(errores).length) throw new ErrorHttp(400, errores.carrito ?? 'Revisa tu carrito.', errores)

  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')

    const { rows: [emolientero] } = await cliente.query(
      `SELECT id, nombre FROM usuarios WHERE id = $1 AND rol = 'emolientero' AND estado = 'activo'`,
      [datos.emolienteroId],
    )
    // T61/T62: FOR SHARE bloquea la jornada abierta hasta terminar la transacción. Si el emolientero
    // intenta cerrarla en ese instante, el cierre espera; y si ya la cerró, aquí no se encuentra.
    const { rowCount: enJornada } = await cliente.query(
      'SELECT 1 FROM jornadas WHERE emolientero_id = $1 AND cerrada_en IS NULL FOR SHARE',
      [datos.emolienteroId],
    )
    const { rows: productos } = await cliente.query(
      `SELECT id, nombre, precio, disponible FROM catalogo_productos
       WHERE emolientero_id = $1 AND id = ANY($2::int[]) FOR SHARE`,
      [datos.emolienteroId, datos.carrito.map((l) => l.productoId)],
    )

    const lineas = verificarCompra({ emolientero: emolientero && { ...emolientero, enJornada: enJornada > 0 }, carrito: datos.carrito, productos })
    const orden = Orden.crear({ clienteId: req.usuario.id, emolienteroId: emolientero.id, lineas })

    const { rows: [creada] } = await cliente.query(
      // US15: la orden nace con su código de recojo de un solo uso (se entrega cuando ya está pagada).
      `INSERT INTO ordenes (cliente_id, emolientero_id, estado, total, expira_en, codigo_recojo)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, creada_en`,
      [orden.clienteId, orden.emolienteroId, orden.estado, orden.total, orden.expiraEn, generarCodigoRecojo()],
    )
    for (const linea of orden.lineas) {
      await cliente.query(
        `INSERT INTO lineas_orden (orden_id, producto_id, nombre, precio_unitario, cantidad) VALUES ($1, $2, $3, $4, $5)`,
        [creada.id, linea.productoId, linea.nombre, linea.precioUnitario, linea.cantidad],
      )
    }
    await cliente.query('COMMIT')

    res.status(201).json(await buscarOrden(creada.id, req.usuario.id))
  } catch (err) {
    await cliente.query('ROLLBACK')
    throw err
  } finally {
    cliente.release()
  }
})

// Orden del cliente con sus líneas. `vencida` indica si pasó la vigencia sin pagarse.
async function buscarOrden(id, clienteId) {
  const { rows: [orden] } = await query(
    `SELECT o.id, o.estado, o.total, o.creada_en AS "creadaEn", o.expira_en AS "expiraEn",
            (o.estado = 'pendiente_pago' AND o.expira_en <= now()) AS vencida,
            json_build_object('id', u.id, 'nombre', u.nombre) AS emolientero
     FROM ordenes o JOIN usuarios u ON u.id = o.emolientero_id
     WHERE o.id = $1 AND o.cliente_id = $2`,
    [id, clienteId],
  )
  if (!orden) return null
  const { rows: lineas } = await query(
    `SELECT producto_id AS "productoId", nombre, precio_unitario AS "precioUnitario", cantidad,
            precio_unitario * cantidad AS subtotal
     FROM lineas_orden WHERE orden_id = $1 ORDER BY id`,
    [id],
  )
  return { ...orden, lineas }
}

// Detalle de una orden propia (lo usa la pantalla de compra y, luego, el pago de US14).
// Si :id no es un número, se salta esta ruta (next('route')) y la petición sigue a las rutas de US15.
const soloIdNumerico = (req, _res, next) => next(/^\d+$/.test(req.params.id) ? undefined : 'route')

router.get('/:id', soloIdNumerico, ...soloCliente, async (req, res) => {
  const id = Number(req.params.id)
  const orden = Number.isInteger(id) ? await buscarOrden(id, req.usuario.id) : null
  if (!orden) throw new ErrorHttp(404, 'Orden no encontrada.')
  res.json(orden)
})

export default router
