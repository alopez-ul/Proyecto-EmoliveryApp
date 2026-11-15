// US15 - Validación del código de recojo.
// El cliente ve el código de cada pedido; el emolientero lo valida al entregarlo.
import { crearRouter } from '../router.js'
import { pool, query } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { requiereRol, requiereSesion } from '../autenticacion.js'
import { notificar } from '../notificaciones.js'
import { esCodigoValido, formatearCodigo, normalizarCodigo } from '../codigoRecojo.js'

const router = crearRouter()
router.use(requiereSesion)

const ESTADOS_POR_ENTREGAR = ['pendiente', 'en_camino']
const formatoLima = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' })

// T68: pedidos del cliente con su código de recojo (es el único que lo ve).
router.get('/mias', requiereRol('cliente'), async (req, res) => {
  const { rows } = await query(
    `SELECT o.id, e.nombre AS emolientero, o.estado, o.codigo_recojo AS "codigoRecojo",
            o.creada_en AS "creadaEn", o.entregada_en AS "entregadaEn",
            (r.id IS NOT NULL) AS "resenaHabilitada"
     FROM ordenes o
     JOIN usuarios e ON e.id = o.emolientero_id
     LEFT JOIN resenas r ON r.orden_id = o.id
     WHERE o.cliente_id = $1
     ORDER BY o.creada_en DESC`,
    [req.usuario.id],
  )
  res.json(rows.map((o) => ({ ...o, codigoRecojo: formatearCodigo(o.codigoRecojo) })))
})

// T69: pedidos que el emolientero aún debe entregar (sin el código: ese lo trae el cliente).
router.get('/por-entregar', requiereRol('emolientero'), async (req, res) => {
  const { rows } = await query(
    `SELECT o.id, c.nombre AS cliente, o.estado, o.creada_en AS "creadaEn"
     FROM ordenes o JOIN usuarios c ON c.id = o.cliente_id
     WHERE o.emolientero_id = $1 AND o.estado = ANY ($2)
     ORDER BY o.creada_en`,
    [req.usuario.id, ESTADOS_POR_ENTREGAR],
  )
  res.json(rows)
})

// Por qué no se pudo usar el código. Se consulta solo si el UPDATE no encontró la orden.
async function motivoRechazo(db, codigo, emolienteroId) {
  const { rows: [orden] } = await db.query(
    'SELECT emolientero_id AS "emolienteroId", estado, entregada_en AS "entregadaEn" FROM ordenes WHERE codigo_recojo = $1',
    [codigo],
  )
  if (!orden) return new ErrorHttp(404, 'No existe un pedido con ese código. Revisa que esté bien escrito.')
  if (orden.emolienteroId !== emolienteroId) {
    return new ErrorHttp(403, 'Este código es de un pedido de otro emolientero. No puedes entregarlo.')
  }
  if (orden.entregadaEn || orden.estado === 'entregada') {
    const cuando = orden.entregadaEn ? ` el ${formatoLima.format(orden.entregadaEn)}` : ''
    return new ErrorHttp(409, `Este código ya se usó: el pedido se entregó${cuando}.`)
  }
  return new ErrorHttp(409, 'Este pedido fue cancelado y no se puede entregar.')
}

// T70 (RNF12): valida el código y, en UNA transacción, marca la orden como entregada (el código queda
// usado), habilita la reseña del cliente y le avisa. Si algo falla, no se guarda nada.
router.post('/entregar', requiereRol('emolientero'), async (req, res) => {
  const codigo = normalizarCodigo(req.body?.codigo)
  if (!esCodigoValido(codigo)) {
    const mensaje = 'El código tiene 6 letras y números, por ejemplo ABC-23X.'
    throw new ErrorHttp(400, mensaje, { codigo: mensaje })
  }

  const emolientero = req.usuario
  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')
    // Las condiciones del WHERE hacen el código de un solo uso, también ante dos validaciones
    // simultáneas: la segunda espera a la primera y, al ver entregada_en, no actualiza nada.
    const { rows: [orden] } = await cliente.query(
      `UPDATE ordenes o SET estado = 'entregada', entregada_en = now(), actualizada_en = now()
       FROM usuarios c
       WHERE o.codigo_recojo = $1 AND o.emolientero_id = $2 AND o.entregada_en IS NULL
         AND o.estado = ANY ($3) AND c.id = o.cliente_id
       RETURNING o.id, o.cliente_id AS "clienteId", c.nombre AS "clienteNombre", c.correo AS "clienteCorreo",
                 o.creada_en AS "creadaEn", o.entregada_en AS "entregadaEn"`,
      [codigo, emolientero.id, ESTADOS_POR_ENTREGAR],
    )
    if (!orden) throw await motivoRechazo(cliente, codigo, emolientero.id)

    const { rows: [resena] } = await cliente.query(
      `INSERT INTO resenas (orden_id, cliente_id, emolientero_id) VALUES ($1, $2, $3)
       RETURNING id, habilitada_en AS "habilitadaEn"`,
      [orden.id, orden.clienteId, emolientero.id],
    )
    await notificar(cliente, { id: orden.clienteId, correo: orden.clienteCorreo }, {
      tipo: 'resena_habilitada',
      titulo: 'Pedido entregado',
      mensaje: `${emolientero.nombre} entregó tu pedido. Ya puedes calificarlo y dejar tu reseña.`,
    })
    await cliente.query('COMMIT')

    res.json({
      orden: { id: orden.id, cliente: orden.clienteNombre, estado: 'entregada', creadaEn: orden.creadaEn, entregadaEn: orden.entregadaEn },
      resena: { id: resena.id, habilitadaEn: resena.habilitadaEn },
    })
  } catch (err) {
    await cliente.query('ROLLBACK')
    throw err
  } finally {
    cliente.release()
  }
})

export default router
