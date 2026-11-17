// US24 - Gestión de usuarios registrados (solo administrador). Se monta en /api/admin/usuarios.
import { crearRouter } from '../router.js'
import { pool, query } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { requiereRol, requiereSesion } from '../autenticacion.js'
import { notificar } from '../notificaciones.js'
import { calcularTotales, validarFiltros, validarMotivo } from '../gestionUsuarios.js'

const router = crearRouter()
router.use(requiereSesion, requiereRol('admin'))

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Pedidos pagados que el emolientero aún debe entregar (los mismos que cuenta US06).
const ORDENES_POR_ENTREGAR = "o.emolientero_id = u.id AND o.estado IN ('pendiente', 'en_camino')"

// T100 + T101: listado filtrado por rol, estado y fecha de registro (en hora de Lima), con totales.
router.get('/', async (req, res) => {
  const { datos, errores } = validarFiltros(req.query)
  if (Object.keys(errores).length) throw new ErrorHttp(400, Object.values(errores)[0], errores)

  const condiciones = []
  const params = []
  const agregar = (sql, valor) => {
    params.push(valor)
    condiciones.push(sql.replace('?', `$${params.length}`))
  }
  if (datos.rol) agregar('u.rol = ?', datos.rol)
  if (datos.estado) agregar('u.estado = ?', datos.estado)
  if (datos.desde) agregar("(u.creado_en AT TIME ZONE 'America/Lima')::date >= ?::date", datos.desde)
  if (datos.hasta) agregar("(u.creado_en AT TIME ZONE 'America/Lima')::date <= ?::date", datos.hasta)

  const { rows: usuarios } = await query(
    `SELECT u.id, u.nombre, u.correo, u.rol, u.estado, u.dni, u.creado_en AS "creadoEn",
            (SELECT count(*)::int FROM ordenes o WHERE ${ORDENES_POR_ENTREGAR}) AS "ordenesPorEntregar",
            ultimo.accion AS "ultimaAccion", ultimo.motivo AS "ultimoMotivo", ultimo.creado_en AS "ultimoCambioEn"
     FROM usuarios u
     LEFT JOIN LATERAL (
       SELECT accion, motivo, creado_en FROM cambios_estado_cuenta c WHERE c.usuario_id = u.id ORDER BY creado_en DESC LIMIT 1
     ) ultimo ON TRUE
     ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
     ORDER BY u.creado_en DESC`,
    params,
  )
  res.json({ totales: calcularTotales(usuarios), usuarios })
})

// Bloquea la fila del usuario y valida que exista. Debe llamarse dentro de una transacción.
async function bloquearUsuario(cliente, id) {
  if (!UUID.test(id)) throw new ErrorHttp(404, 'Usuario no encontrado.')
  const { rows: [usuario] } = await cliente.query(
    'SELECT id, nombre, correo, rol, estado FROM usuarios WHERE id = $1 FOR UPDATE',
    [id],
  )
  if (!usuario) throw new ErrorHttp(404, 'Usuario no encontrado.')
  return usuario
}

// Ejecuta fn(cliente) en una transacción y responde lo que devuelva.
async function enTransaccion(res, fn) {
  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')
    const { status = 200, cuerpo } = await fn(cliente)
    await cliente.query(status < 400 ? 'COMMIT' : 'ROLLBACK')
    res.status(status).json(cuerpo)
  } catch (err) {
    await cliente.query('ROLLBACK')
    throw err
  } finally {
    cliente.release()
  }
}

const registrarCambio = (cliente, usuarioId, adminId, accion, motivo) =>
  cliente.query('INSERT INTO cambios_estado_cuenta (usuario_id, admin_id, accion, motivo) VALUES ($1, $2, $3, $4)', [
    usuarioId,
    adminId,
    accion,
    motivo,
  ])

// T102 + T103: suspende una cuenta activa con motivo. No se puede suspender a un emolientero con pedidos
// pagados por entregar: se responde 409 con la lista de esos pedidos para resolverlos primero.
router.post('/:id/suspender', async (req, res) => {
  const { datos, errores } = validarMotivo(req.body)
  if (Object.keys(errores).length) throw new ErrorHttp(400, errores.motivo, errores)

  await enTransaccion(res, async (cliente) => {
    const usuario = await bloquearUsuario(cliente, req.params.id)
    if (usuario.id === req.usuario.id) throw new ErrorHttp(422, 'No puedes suspender tu propia cuenta.')
    if (usuario.rol === 'admin') throw new ErrorHttp(422, 'No se puede suspender a otro administrador.')
    if (usuario.estado !== 'activo') {
      throw new ErrorHttp(409, `Solo se pueden suspender cuentas activas (estado actual: ${usuario.estado}).`)
    }

    if (usuario.rol === 'emolientero') {
      const { rows: ordenes } = await cliente.query(
        `SELECT o.id, c.nombre AS cliente, o.estado, o.total, o.pagada_en AS "pagadaEn"
         FROM ordenes o JOIN usuarios c ON c.id = o.cliente_id, usuarios u
         WHERE u.id = $1 AND ${ORDENES_POR_ENTREGAR}
         ORDER BY o.creada_en`,
        [usuario.id],
      )
      if (ordenes.length) {
        return {
          status: 409,
          cuerpo: {
            error: `No se puede suspender a ${usuario.nombre}: tiene ${ordenes.length} pedido(s) pagado(s) por entregar. Deben entregarse o cancelarse primero.`,
            ordenes,
          },
        }
      }
      // Un emolientero suspendido deja de atender: se cierra su jornada abierta, si la tiene.
      await cliente.query('UPDATE jornadas SET cerrada_en = now() WHERE emolientero_id = $1 AND cerrada_en IS NULL', [usuario.id])
    }

    await cliente.query("UPDATE usuarios SET estado = 'suspendido', actualizado_en = now() WHERE id = $1", [usuario.id])
    await registrarCambio(cliente, usuario.id, req.usuario.id, 'suspender', datos.motivo)
    return { cuerpo: { id: usuario.id, nombre: usuario.nombre, estado: 'suspendido' } }
  })
})

// T102: reactiva una cuenta suspendida con motivo y le avisa (lo verá al volver a iniciar sesión).
router.post('/:id/reactivar', async (req, res) => {
  const { datos, errores } = validarMotivo(req.body)
  if (Object.keys(errores).length) throw new ErrorHttp(400, errores.motivo, errores)

  await enTransaccion(res, async (cliente) => {
    const usuario = await bloquearUsuario(cliente, req.params.id)
    if (usuario.estado !== 'suspendido') {
      throw new ErrorHttp(409, `Solo se pueden reactivar cuentas suspendidas (estado actual: ${usuario.estado}).`)
    }
    await cliente.query("UPDATE usuarios SET estado = 'activo', actualizado_en = now() WHERE id = $1", [usuario.id])
    await registrarCambio(cliente, usuario.id, req.usuario.id, 'reactivar', datos.motivo)
    await notificar(cliente, usuario, {
      tipo: 'cuenta_reactivada',
      titulo: 'Tu cuenta fue reactivada',
      mensaje: `Un administrador reactivó tu cuenta. Motivo: ${datos.motivo}`,
    })
    return { cuerpo: { id: usuario.id, nombre: usuario.nombre, estado: 'activo' } }
  })
})

export default router
