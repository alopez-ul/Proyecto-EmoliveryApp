// US14 - Endpoint de validación de pago con QR de Yape y bitácora de transacciones (RNF06)
import { crearRouter } from '../router.js'
import { pool } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { requiereRol, requiereSesion } from '../autenticacion.js'
import { notificar } from '../notificaciones.js'
import { formatearCodigo, generarCodigoRecojo } from '../codigoRecojo.js'
import { NUMEROS_OPERACION_PRE_USADOS, PagoController, Yape } from '../pagoYape.js'

const router = crearRouter()
const pagoController = new PagoController(new Yape())

// POST /api/pagos/yape/validar (demostración: valida una orden que llega en el cuerpo, sin tocar la BD)
router.post('/yape/validar', async (req, res) => {
  const { orden, numeroOperacion, montoIngresado, ahora } = req.body ?? {}

  const resultado = pagoController.procesarConstancia({
    orden,
    numeroOperacion,
    montoIngresado,
    ahora: ahora ? new Date(ahora) : new Date(),
  })

  if (!resultado.valido) {
    return res.status(422).json(resultado)
  }

  res.json(resultado)
})

// GET /api/pagos/yape/bitacora (demostración)
router.get('/yape/bitacora', async (_req, res) => {
  res.json(pagoController.obtenerBitacora())
})

// ---------- Pago de una orden real (US13 → US14 → US15) ----------

// Monto que se puede guardar en NUMERIC(8, 2); si no, se registra como desconocido.
const montoGuardable = (valor) => {
  const n = Number(valor)
  return Number.isFinite(n) && Math.abs(n) < 1_000_000 ? Math.round(n * 100) / 100 : null
}

// POST /api/pagos/yape/ordenes/:id  { numeroOperacion, montoIngresado }  (solo el cliente dueño de la orden)
// Valida la constancia con las mismas reglas de Yape (T65/T66: vigencia de 15 min, formato y unicidad del
// número de operación, monto exacto) y, en UNA transacción:
// - si es válida: la orden pasa a 'pendiente' (pagada), guarda pagada_en y el número de operación, y se avisa al
//   emolientero. El cliente recibe el código de recojo de la orden (US15).
// - si no: como indica US14, se libera la reserva (la orden pasa a 'cancelada').
// Cada intento queda en la bitácora transacciones_pago (T67, RNF06).
router.post('/yape/ordenes/:id', requiereSesion, requiereRol('cliente'), async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) throw new ErrorHttp(404, 'Orden no encontrada.')
  const { numeroOperacion, montoIngresado } = req.body ?? {}
  const operacion = String(numeroOperacion ?? '').trim()

  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')
    // FOR UPDATE: dos pagos simultáneos de la misma orden se atienden uno tras otro.
    const { rows: [orden] } = await cliente.query(
      `SELECT o.id, o.estado, o.total, o.creada_en AS "creadaEn", o.codigo_recojo AS "codigoRecojo",
              o.emolientero_id AS "emolienteroId", e.correo AS "emolienteroCorreo"
       FROM ordenes o JOIN usuarios e ON e.id = o.emolientero_id
       WHERE o.id = $1 AND o.cliente_id = $2
       FOR UPDATE OF o`,
      [id, req.usuario.id],
    )
    if (!orden) throw new ErrorHttp(404, 'Orden no encontrada.')
    if (orden.estado !== 'pendiente_pago') {
      const motivo = orden.estado === 'cancelada' ? 'fue cancelada o venció' : 'ya está pagada'
      throw new ErrorHttp(409, `Esta orden ${motivo}: no se puede pagar.`)
    }

    // T65: el número de operación no debe haberse usado antes en otra orden (la BD lo recuerda).
    const { rowCount: usada } = await cliente.query('SELECT 1 FROM ordenes WHERE numero_operacion = $1', [operacion])
    const yape = new Yape([...NUMEROS_OPERACION_PRE_USADOS, ...(usada ? [operacion] : [])])
    const resultado = yape.validarYProcesarConstancia({
      orden: { id: orden.id, estado: 'PENDIENTE_PAGO', creadaEn: orden.creadaEn, totalCalculado: Number(orden.total) },
      numeroOperacion: operacion,
      montoIngresado,
    })

    if (resultado.valido) {
      // La orden conserva su código de recojo; las anteriores a US15 reciben uno al pagarse.
      const { rows: [pagada] } = await cliente.query(
        `UPDATE ordenes SET estado = 'pendiente', pagada_en = now(), numero_operacion = $2,
                codigo_recojo = COALESCE(codigo_recojo, $3), actualizada_en = now()
         WHERE id = $1
         RETURNING codigo_recojo AS "codigoRecojo", pagada_en AS "pagadaEn"`,
        [orden.id, operacion, generarCodigoRecojo()],
      )
      await notificar(cliente, { id: orden.emolienteroId, correo: orden.emolienteroCorreo }, {
        tipo: 'orden_pagada',
        titulo: 'Nuevo pedido pagado',
        mensaje: `${req.usuario.nombre} pagó el pedido #${orden.id} con Yape. Pídele su código de recojo al entregarlo.`,
      })
      Object.assign(resultado, { codigoRecojo: formatearCodigo(pagada.codigoRecojo), pagadaEn: pagada.pagadaEn })
    } else {
      // US14: un pago no válido libera la reserva.
      await cliente.query(
        "UPDATE ordenes SET estado = 'cancelada', cancelada_en = now(), actualizada_en = now() WHERE id = $1",
        [orden.id],
      )
    }

    await cliente.query(
      `INSERT INTO transacciones_pago
         (orden_id, cliente_id, numero_operacion, monto_ingresado, monto_esperado, resultado, codigo_causa, detalle)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        orden.id, req.usuario.id, operacion.slice(0, 40), montoGuardable(montoIngresado), Number(orden.total),
        resultado.valido ? 'ACEPTADO' : 'RECHAZADO', resultado.codigoCausa, resultado.transaccion.detalle,
      ],
    )
    await cliente.query('COMMIT')

    const respuesta = {
      valido: resultado.valido,
      mensaje: resultado.mensaje,
      codigoCausa: resultado.codigoCausa,
      detalleError: resultado.detalleError,
      orden: { id: orden.id, estado: resultado.valido ? 'pendiente' : 'cancelada', total: Number(orden.total) },
      ...(resultado.valido && { codigoRecojo: resultado.codigoRecojo, pagadaEn: resultado.pagadaEn }),
    }
    res.status(resultado.valido ? 200 : 422).json(respuesta)
  } catch (err) {
    await cliente.query('ROLLBACK')
    // Otro pago simultáneo usó el mismo número de operación entre la revisión y el UPDATE.
    if (err.code === '23505' && err.constraint === 'ordenes_numero_operacion_unico') {
      throw new ErrorHttp(409, 'Ese número de operación acaba de usarse en otra orden. Revisa tu constancia de Yape.')
    }
    throw err
  } finally {
    cliente.release()
  }
})

export default router
