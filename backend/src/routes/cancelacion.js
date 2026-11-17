// US16 - Cancelación de compra anticipada.
// cancelacionRouter se monta en /api/ordenes (cliente cancela su orden) y devolucionesRouter en
// /api/devoluciones (el emolientero ve y marca las devoluciones que debe hacer).
import { crearRouter } from '../router.js'
import { pool, query } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { requiereRol, requiereSesion } from '../autenticacion.js'
import { notificar } from '../notificaciones.js'
import { ESTADOS_CANCELABLES, PLAZO_CANCELACION_MIN, motivoNoCancelable } from '../cancelacion.js'

const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })

export const cancelacionRouter = crearRouter()

// T72 + T73 + T74: anula la orden, registra la devolución y avisa al emolientero en UNA transacción.
// Las condiciones del plazo van en el mismo UPDATE: si el emolientero valida el código de recojo (US15)
// en ese instante, solo una de las dos operaciones encuentra la orden en estado por entregar.
cancelacionRouter.post('/:id/cancelar', requiereSesion, requiereRol('cliente'), async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new ErrorHttp(404, 'Orden no encontrada.')

  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')
    const { rows: [orden] } = await cliente.query(
      `UPDATE ordenes o SET estado = 'cancelada', cancelada_en = now(), actualizada_en = now()
       FROM usuarios e
       WHERE o.id = $1 AND o.cliente_id = $2 AND o.estado = ANY ($3) AND o.entregada_en IS NULL
         AND o.pagada_en IS NOT NULL AND now() <= o.pagada_en + make_interval(mins => $4)
         AND e.id = o.emolientero_id
       RETURNING o.id, o.emolientero_id AS "emolienteroId", e.correo AS "emolienteroCorreo", e.nombre AS emolientero,
                 o.cancelada_en AS "canceladaEn",
                 COALESCE(o.total, (SELECT sum(precio_unitario * cantidad) FROM lineas_orden WHERE orden_id = o.id)) AS total`,
      [id, req.usuario.id, ESTADOS_CANCELABLES, PLAZO_CANCELACION_MIN],
    )
    if (!orden) {
      // No se canceló: ¿no existe (o es de otro cliente), o qué regla incumple?
      const { rows: [actual] } = await cliente.query(
        'SELECT estado, pagada_en AS "pagadaEn", entregada_en AS "entregadaEn" FROM ordenes WHERE id = $1 AND cliente_id = $2',
        [id, req.usuario.id],
      )
      if (!actual) throw new ErrorHttp(404, 'Orden no encontrada.')
      throw new ErrorHttp(409, motivoNoCancelable(actual) ?? 'La compra ya no puede cancelarse.')
    }

    // T74: solicitud de devolución por el total pagado.
    const { rows: [devolucion] } = await cliente.query(
      `INSERT INTO devoluciones (orden_id, cliente_id, emolientero_id, monto) VALUES ($1, $2, $3, $4)
       RETURNING id, monto, estado, solicitada_en AS "solicitadaEn"`,
      [orden.id, req.usuario.id, orden.emolienteroId, orden.total],
    )
    await notificar(cliente, { id: orden.emolienteroId, correo: orden.emolienteroCorreo }, {
      tipo: 'devolucion_solicitada',
      titulo: 'Pedido cancelado: devolución pendiente',
      mensaje: `${req.usuario.nombre} canceló el pedido #${orden.id}. Debes devolverle ${soles.format(devolucion.monto)} por Yape.`,
    })
    await cliente.query('COMMIT')

    // T73: la orden cancelada deja de contar como pedido por entregar: ya no aparece en la lista del
    // emolientero (US15), su código de recojo deja de servir y no le impide cerrar la jornada (US06).
    res.json({
      orden: { id: orden.id, estado: 'cancelada', canceladaEn: orden.canceladaEn, emolientero: orden.emolientero },
      devolucion,
    })
  } catch (err) {
    await cliente.query('ROLLBACK')
    throw err
  } finally {
    cliente.release()
  }
})

export const devolucionesRouter = crearRouter()
devolucionesRouter.use(requiereSesion, requiereRol('emolientero'))

// T74: devoluciones del emolientero, primero las pendientes y luego las más recientes.
devolucionesRouter.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT d.id, d.orden_id AS "ordenId", c.nombre AS cliente, c.telefono AS "clienteTelefono", d.monto, d.estado,
            d.solicitada_en AS "solicitadaEn", d.realizada_en AS "realizadaEn"
     FROM devoluciones d JOIN usuarios c ON c.id = d.cliente_id
     WHERE d.emolientero_id = $1
     ORDER BY (d.estado = 'pendiente') DESC, d.solicitada_en DESC`,
    [req.usuario.id],
  )
  res.json(rows)
})

// El emolientero marca que ya devolvió el dinero. Avisa al cliente.
devolucionesRouter.post('/:id/realizada', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new ErrorHttp(404, 'Devolución no encontrada.')
  const { rows: [devolucion] } = await query(
    `UPDATE devoluciones d SET estado = 'realizada', realizada_en = now()
     FROM usuarios c
     WHERE d.id = $1 AND d.emolientero_id = $2 AND d.estado = 'pendiente' AND c.id = d.cliente_id
     RETURNING d.id, d.orden_id AS "ordenId", d.monto, d.estado, d.realizada_en AS "realizadaEn",
               c.id AS "clienteId", c.correo AS "clienteCorreo"`,
    [id, req.usuario.id],
  )
  if (!devolucion) {
    const { rowCount } = await query('SELECT 1 FROM devoluciones WHERE id = $1 AND emolientero_id = $2', [id, req.usuario.id])
    if (!rowCount) throw new ErrorHttp(404, 'Devolución no encontrada.')
    throw new ErrorHttp(409, 'Esta devolución ya estaba marcada como realizada.')
  }
  const { clienteId, clienteCorreo, ...publica } = devolucion
  await notificar(pool, { id: clienteId, correo: clienteCorreo }, {
    tipo: 'devolucion_realizada',
    titulo: 'Devolución realizada',
    mensaje: `${req.usuario.nombre} registró la devolución de ${soles.format(devolucion.monto)} por tu pedido #${devolucion.ordenId}.`,
  })
  res.json(publica)
})
