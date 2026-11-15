// US20 - T77: lectura de las compras de un cliente desde la base de datos.
// Es el ÚNICO punto de US20 que depende del modelo de órdenes de US13 (T58: Orden y LineaDeOrden con
// el precio congelado al momento de compra). Hoy la tabla `ordenes` (migración 007) no guarda ni el
// monto ni los productos, así que esta consulta se completa cuando US13 esté en main.
import { ErrorHttp } from '../errores.js'

export const ZONA_HORARIA = 'America/Lima'

export const HISTORIAL_NO_DISPONIBLE =
  'El historial de compras estará disponible cuando se puedan registrar compras anticipadas.'

// Devuelve las compras del cliente, de la más reciente a la más antigua, con la forma:
//   { id, fecha, emolientero: { id, nombre }, productos: [{ nombre, cantidad, precioUnitario }], monto, estado }
// rango: { desde, hasta } en AAAA-MM-DD (opcionales, inclusivos, días completos en hora de Lima).
// El filtro debe ser: creada_en >= (desde::date AT TIME ZONE 'America/Lima')
//                 AND creada_en <  ((hasta::date + 1) AT TIME ZONE 'America/Lima')
export async function listarComprasDeCliente(_clienteId, _rango) {
  throw new ErrorHttp(501, HISTORIAL_NO_DISPONIBLE)
}
