// US23 - Verificación de emolienteros (panel del administrador).
import { crearRouter } from '../router.js'
import { pool, query } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { requiereRol, requiereSesion } from '../autenticacion.js'
import { notificar } from '../notificaciones.js'

const router = crearRouter()
router.use(requiereSesion, requiereRol('admin'))

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MOTIVO_MIN = 10
const MOTIVO_MAX = 500

// T30: única transición permitida desde la bandeja. Cualquier otro estado de origen se rechaza.
const ESTADO_ORIGEN = 'pendiente_verificacion'
const ESTADO_DESTINO = { aprobado: 'activo', rechazado: 'rechazado' }

const MENSAJES = {
  aprobado: () => ({
    tipo: 'verificacion_aprobada',
    titulo: 'Tu cuenta de emolientero fue aprobada',
    mensaje: 'Ya puedes iniciar sesión, publicar tu ubicación y vender en Emolivery.',
  }),
  rechazado: (motivo) => ({
    tipo: 'verificacion_rechazada',
    titulo: 'Tu solicitud de emolientero fue rechazada',
    mensaje: `Motivo: ${motivo}`,
  }),
}

// T28: bandeja de registros pendientes, del más antiguo al más reciente.
router.get('/emolienteros/pendientes', async (_req, res) => {
  const { rows } = await query(
    `SELECT id, nombre, correo, dni, codigo_municipal AS "codigoMunicipal", telefono, creado_en AS "creadoEn"
     FROM usuarios
     WHERE rol = 'emolientero' AND estado = $1
     ORDER BY creado_en`,
    [ESTADO_ORIGEN],
  )
  res.json(rows)
})

// Historial de decisiones, la más reciente primero.
router.get('/emolienteros/historial', async (_req, res) => {
  const { rows } = await query(
    `SELECT v.id, v.decision, v.motivo, v.creado_en AS "decididoEn",
            u.id AS "usuarioId", u.nombre, u.correo, u.dni, u.estado,
            a.nombre AS "decididoPor"
     FROM verificaciones v
     JOIN usuarios u ON u.id = v.usuario_id
     LEFT JOIN usuarios a ON a.id = v.admin_id
     ORDER BY v.creado_en DESC
     LIMIT 50`,
  )
  res.json(rows)
})

// T29 + T30 + T31: cambia el estado, registra la decisión y notifica, todo en una transacción.
async function decidir(id, decision, motivo, admin) {
  if (!UUID.test(id)) throw new ErrorHttp(404, 'Solicitud no encontrada.')
  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')
    // El WHERE con el estado de origen evita decidir dos veces: si otro administrador
    // ya la procesó, no se actualiza ninguna fila.
    const { rows } = await cliente.query(
      `UPDATE usuarios SET estado = $2, actualizado_en = now()
       WHERE id = $1 AND rol = 'emolientero' AND estado = $3
       RETURNING id, nombre, correo, dni, estado`,
      [id, ESTADO_DESTINO[decision], ESTADO_ORIGEN],
    )
    if (!rows.length) {
      const { rows: actual } = await cliente.query("SELECT estado FROM usuarios WHERE id = $1 AND rol = 'emolientero'", [id])
      if (!actual.length) throw new ErrorHttp(404, 'Solicitud no encontrada.')
      throw new ErrorHttp(409, `Esta solicitud ya fue procesada (estado actual: ${actual[0].estado}).`)
    }
    const emolientero = rows[0]
    await cliente.query('INSERT INTO verificaciones (usuario_id, admin_id, decision, motivo) VALUES ($1, $2, $3, $4)', [
      emolientero.id,
      admin.id,
      decision,
      motivo,
    ])
    await notificar(cliente, emolientero, MENSAJES[decision](motivo))
    await cliente.query('COMMIT')
    return emolientero
  } catch (err) {
    await cliente.query('ROLLBACK')
    throw err
  } finally {
    cliente.release()
  }
}

router.post('/emolienteros/:id/aprobar', async (req, res) => {
  const emolientero = await decidir(req.params.id, 'aprobado', null, req.usuario)
  res.json({ emolientero, notificado: true })
})

router.post('/emolienteros/:id/rechazar', async (req, res) => {
  const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : ''
  if (motivo.length < MOTIVO_MIN || motivo.length > MOTIVO_MAX) {
    throw new ErrorHttp(400, `El motivo debe tener entre ${MOTIVO_MIN} y ${MOTIVO_MAX} caracteres.`)
  }
  const emolientero = await decidir(req.params.id, 'rechazado', motivo, req.usuario)
  res.json({ emolientero, notificado: true })
})

export default router
