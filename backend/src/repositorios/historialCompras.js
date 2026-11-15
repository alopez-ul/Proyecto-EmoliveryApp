// US20 - T77: lectura de las compras de un cliente desde la base de datos.
// Usa el modelo de órdenes de US13 (migración 013: ordenes.total y lineas_orden con el precio congelado).
import { query } from '../db.js'

export const ZONA_HORARIA = 'America/Lima'

// Devuelve las compras del cliente, de la más reciente a la más antigua:
//   { id, fecha, estado, vencida, emolientero: { id, nombre }, monto,
//     productos: [{ nombre, cantidad, precioUnitario }] }
// rango: { desde, hasta } en AAAA-MM-DD (opcionales e inclusivos, días completos en hora de Lima).
// El monto es el total guardado en la orden; si una orden antigua no lo tiene, se suma desde sus líneas.
export async function listarComprasDeCliente(clienteId, { desde = null, hasta = null } = {}) {
  const { rows } = await query(
    `SELECT o.id, o.creada_en AS fecha, o.estado,
            (o.estado = 'pendiente_pago' AND o.expira_en <= now()) AS vencida,
            json_build_object('id', e.id, 'nombre', e.nombre) AS emolientero,
            COALESCE(o.total, l.suma, 0) AS monto,
            COALESCE(l.productos, '[]'::json) AS productos
     FROM ordenes o
     JOIN usuarios e ON e.id = o.emolientero_id
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object('nombre', lo.nombre, 'cantidad', lo.cantidad,
                                         'precioUnitario', lo.precio_unitario) ORDER BY lo.id) AS productos,
              SUM(lo.precio_unitario * lo.cantidad) AS suma
       FROM lineas_orden lo
       WHERE lo.orden_id = o.id
     ) l ON TRUE
     WHERE o.cliente_id = $1
       AND ($2::date IS NULL OR o.creada_en >= ($2::date::timestamp AT TIME ZONE '${ZONA_HORARIA}'))
       AND ($3::date IS NULL OR o.creada_en < (($3::date + 1)::timestamp AT TIME ZONE '${ZONA_HORARIA}'))
     ORDER BY o.creada_en DESC, o.id DESC`,
    [clienteId, desde, hasta],
  )
  return rows
}
