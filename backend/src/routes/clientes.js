// US01 - Registro de cliente.
import { crearRouter } from '../router.js'
import { query } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { hashContrasena, validarPassword } from '../seguridad.js'
import { validarRegistroCliente } from '../validaciones/cliente.js'

const router = crearRouter()

const CORREO_DUPLICADO = 'Ya existe una cuenta registrada con este correo.'

// Crea la cuenta del cliente, activa desde el inicio (a diferencia del emolientero, no requiere verificación).
router.post('/registro', async (req, res) => {
  const { datos, errores } = validarRegistroCliente(req.body)
  const errorPassword = validarPassword(req.body?.password)
  if (errorPassword) errores.password = errorPassword
  if (Object.keys(errores).length) throw new ErrorHttp(400, 'Revisa los datos del formulario.', errores)

  const { rows: existe } = await query('SELECT 1 FROM usuarios WHERE lower(correo) = $1', [datos.correo])
  if (existe.length) throw new ErrorHttp(409, CORREO_DUPLICADO, { correo: CORREO_DUPLICADO })

  try {
    const { rows } = await query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol, estado, telefono)
       VALUES ($1, $2, $3, 'cliente', 'activo', $4)
       RETURNING id, nombre, correo, estado, creado_en AS "creadoEn"`,
      [datos.nombre, datos.correo, await hashContrasena(req.body.password), datos.telefono],
    )
    res.status(201).json({ cliente: rows[0] })
  } catch (err) {
    // Dos registros simultáneos con el mismo correo pueden pasar la revisión previa; el índice único decide.
    if (err.code === '23505' && err.constraint === 'usuarios_correo_unico') {
      throw new ErrorHttp(409, CORREO_DUPLICADO, { correo: CORREO_DUPLICADO })
    }
    throw err
  }
})

export default router
