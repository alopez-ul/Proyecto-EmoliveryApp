import { crearRouter } from '../router.js'
import { pool, query } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { requiereSesion } from '../autenticacion.js'
import {
  HASH_FICTICIO,
  VIGENCIA_ENLACE_MIN,
  firmarSesion,
  hashContrasena,
  hashToken,
  nuevoTokenRecuperacion,
  validarPassword,
  verificarContrasena,
} from '../seguridad.js'

const router = crearRouter()

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Solo en desarrollo: devuelve el enlace de recuperación en la respuesta (el "buzón simulado"),
// porque todavía no hay envío real de correos. Apagado salvo que BUZON_SIMULADO=true.
const BUZON_SIMULADO = process.env.BUZON_SIMULADO === 'true'

const publico = (u) => ({ id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol })

// US03 - T11: valida credenciales y emite el token de sesión
router.post('/login', async (req, res) => {
  const { correo, password } = req.body ?? {}
  if (typeof correo !== 'string' || typeof password !== 'string' || !correo.trim() || !password) {
    throw new ErrorHttp(400, 'Ingresa tu correo y contraseña.')
  }
  const { rows } = await query(
    'SELECT id, nombre, correo, rol, estado, password_hash FROM usuarios WHERE lower(correo) = lower($1)',
    [correo.trim()],
  )
  const usuario = rows[0]
  // Se compara siempre, exista o no el correo, para que el tiempo de respuesta no lo delate.
  const coincide = await verificarContrasena(password, usuario?.password_hash ?? HASH_FICTICIO)
  if (!usuario || !coincide) throw new ErrorHttp(401, 'Correo o contraseña incorrectos.')
  if (usuario.estado === 'suspendido') throw new ErrorHttp(403, 'Tu cuenta está suspendida. Comunícate con el administrador.')
  if (usuario.estado === 'pendiente_verificacion') {
    throw new ErrorHttp(403, 'Tu cuenta está pendiente de verificación. Te avisaremos cuando un administrador la revise.')
  }
  // US23 - T31: el emolientero rechazado conoce el motivo al intentar ingresar (solo tras dar su contraseña).
  if (usuario.estado === 'rechazado') {
    const { rows: v } = await query(
      "SELECT motivo FROM verificaciones WHERE usuario_id = $1 AND decision = 'rechazado' ORDER BY creado_en DESC LIMIT 1",
      [usuario.id],
    )
    throw new ErrorHttp(403, `Tu solicitud de registro fue rechazada. Motivo: ${v[0]?.motivo ?? 'no indicado'}`)
  }

  res.json({ token: firmarSesion(usuario), usuario: publico(usuario) })
})

// Devuelve el usuario de la sesión, comprobando la firma del token y que la cuenta siga activa.
router.get('/yo', requiereSesion, async (req, res) => {
  res.json(publico(req.usuario))
})

// US04 - T14/T15: genera un enlace de recuperación con vigencia limitada.
// La respuesta es la misma exista o no el correo, para no revelar qué cuentas están registradas.
router.post('/recuperar', async (req, res) => {
  const correo = typeof req.body?.correo === 'string' ? req.body.correo.trim() : ''
  if (!CORREO_VALIDO.test(correo)) throw new ErrorHttp(400, 'Ingresa un correo válido.')

  let buzon = null
  const { rows } = await query('SELECT id, correo FROM usuarios WHERE lower(correo) = lower($1)', [correo])
  if (rows[0]) {
    const { token, tokenHash } = nuevoTokenRecuperacion()
    // Un enlace nuevo invalida los anteriores que no se usaron.
    await query('DELETE FROM tokens_recuperacion WHERE usuario_id = $1 AND usado_en IS NULL', [rows[0].id])
    await query(
      `INSERT INTO tokens_recuperacion (token_hash, usuario_id, expira_en)
       VALUES ($1, $2, now() + make_interval(mins => $3))`,
      [tokenHash, rows[0].id, VIGENCIA_ENLACE_MIN],
    )
    if (BUZON_SIMULADO) {
      buzon = { token, enlace: `#nueva-password?token=${token}`, correo: rows[0].correo }
      console.log(`[buzón simulado] Enlace de recuperación para ${rows[0].correo}: ${buzon.enlace}`)
    }
  }
  res.json({ vigenciaMin: VIGENCIA_ENLACE_MIN, ...(BUZON_SIMULADO && { buzon }) })
})

// Lanza un ErrorHttp si el enlace no existe, ya se usó o venció.
function comprobarEnlace(fila) {
  if (!fila) throw new ErrorHttp(400, 'El enlace de recuperación no es válido.')
  if (fila.usado_en) throw new ErrorHttp(410, 'Este enlace ya fue utilizado. Solicita uno nuevo.')
  if (fila.vencido) throw new ErrorHttp(410, 'El enlace de recuperación venció. Solicita uno nuevo.')
}

const SELECT_ENLACE = 'SELECT usuario_id, usado_en, expira_en <= now() AS vencido FROM tokens_recuperacion WHERE token_hash = $1'

router.get('/recuperar/:token', async (req, res) => {
  const { rows } = await query(SELECT_ENLACE, [hashToken(req.params.token)])
  comprobarEnlace(rows[0])
  res.json({ valido: true })
})

// US04 - T16: define la nueva contraseña y marca el enlace como usado, en una transacción.
router.post('/nueva-password', async (req, res) => {
  const { token, password } = req.body ?? {}
  if (typeof token !== 'string' || !token) throw new ErrorHttp(400, 'El enlace de recuperación no es válido.')
  const errorPassword = validarPassword(password)
  if (errorPassword) throw new ErrorHttp(400, errorPassword)

  const passwordHash = await hashContrasena(password)
  const tokenHash = hashToken(token)
  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')
    // FOR UPDATE: si llegan dos envíos con el mismo enlace, el segundo espera y lo verá usado.
    const { rows } = await cliente.query(`${SELECT_ENLACE} FOR UPDATE`, [tokenHash])
    comprobarEnlace(rows[0])
    await cliente.query('UPDATE usuarios SET password_hash = $1, actualizado_en = now() WHERE id = $2', [
      passwordHash,
      rows[0].usuario_id,
    ])
    await cliente.query('UPDATE tokens_recuperacion SET usado_en = now() WHERE token_hash = $1', [tokenHash])
    await cliente.query('COMMIT')
  } catch (err) {
    await cliente.query('ROLLBACK')
    throw err
  } finally {
    cliente.release()
  }
  res.json({ ok: true })
})

// Solo para pruebas (T17), y solo con el buzón simulado activo: vence un enlace sin esperar.
router.post('/recuperar/:token/vencer', async (req, res) => {
  if (!BUZON_SIMULADO) throw new ErrorHttp(404, 'No encontrado')
  await query(
    "UPDATE tokens_recuperacion SET expira_en = now() - interval '1 second' WHERE token_hash = $1 AND usado_en IS NULL",
    [hashToken(req.params.token)],
  )
  res.json({ ok: true })
})

export default router
