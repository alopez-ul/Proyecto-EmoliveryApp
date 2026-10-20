// US02 - Registro de emolientero.
import { crearRouter } from '../router.js'
import { pool } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { hashContrasena, validarPassword } from '../seguridad.js'
import { notificar } from '../notificaciones.js'
import { validarRegistroEmolientero } from '../validaciones/emolientero.js'

const router = crearRouter()

// T07: toda cuenta de emolientero nace pendiente; solo el administrador la activa (US23).
const ESTADO_INICIAL = 'pendiente_verificacion'

const MENSAJES_DUPLICADO = {
  dni: 'Ya existe una cuenta registrada con este DNI.',
  codigoMunicipal: 'Este código de autorización municipal ya está registrado.',
  correo: 'Ya existe una cuenta registrada con este correo.',
}

// Índice único de Postgres → campo del formulario.
const CAMPO_POR_INDICE = {
  usuarios_dni_unico: 'dni',
  usuarios_codigo_municipal_unico: 'codigoMunicipal',
  usuarios_correo_unico: 'correo',
}

function errorDuplicado(campos) {
  const errores = Object.fromEntries(campos.map((c) => [c, MENSAJES_DUPLICADO[c]]))
  return new ErrorHttp(409, MENSAJES_DUPLICADO[campos[0]], errores)
}

// T06 + T07 + T08: valida, crea la cuenta pendiente y avisa a los administradores en una transacción,
// de modo que no quede una cuenta sin aviso ni un aviso sin cuenta.
router.post('/registro', async (req, res) => {
  const { datos, errores } = validarRegistroEmolientero(req.body)
  const errorPassword = validarPassword(req.body?.password)
  if (errorPassword) errores.password = errorPassword
  if (Object.keys(errores).length) throw new ErrorHttp(400, 'Revisa los datos del formulario.', errores)

  // El hash se calcula antes de abrir la transacción para no retener la conexión.
  const passwordHash = await hashContrasena(req.body.password)
  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')
    // Se revisan los tres duplicados a la vez para informarlos todos en una sola respuesta.
    const { rows: [existe] } = await cliente.query(
      `SELECT
         EXISTS (SELECT 1 FROM usuarios WHERE dni = $1)               AS dni,
         EXISTS (SELECT 1 FROM usuarios WHERE codigo_municipal = $2)  AS "codigoMunicipal",
         EXISTS (SELECT 1 FROM usuarios WHERE lower(correo) = $3)     AS correo`,
      [datos.dni, datos.codigoMunicipal, datos.correo],
    )
    const duplicados = Object.keys(MENSAJES_DUPLICADO).filter((campo) => existe[campo])
    if (duplicados.length) throw errorDuplicado(duplicados)

    const { rows: [emolientero] } = await cliente.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol, estado, dni, codigo_municipal, telefono)
       VALUES ($1, $2, $3, 'emolientero', $4, $5, $6, $7)
       RETURNING id, nombre, correo, estado, codigo_municipal AS "codigoMunicipal", creado_en AS "creadoEn"`,
      [datos.nombreNegocio, datos.correo, passwordHash, ESTADO_INICIAL, datos.dni, datos.codigoMunicipal, datos.telefono],
    )

    const { rows: admins } = await cliente.query("SELECT id, correo FROM usuarios WHERE rol = 'admin' AND estado = 'activo'")
    for (const admin of admins) {
      await notificar(cliente, admin, {
        tipo: 'registro_emolientero',
        titulo: 'Nuevo emolientero por verificar',
        mensaje: `${emolientero.nombre} (DNI ${datos.dni}) se registró con la autorización ${datos.codigoMunicipal}.`,
      })
    }

    await cliente.query('COMMIT')
    res.status(201).json({ emolientero, administradoresNotificados: admins.length })
  } catch (err) {
    await cliente.query('ROLLBACK')
    // Dos registros simultáneos pueden pasar la revisión previa; el índice único decide.
    const campo = err.code === '23505' && CAMPO_POR_INDICE[err.constraint]
    throw campo ? errorDuplicado([campo]) : err
  } finally {
    cliente.release()
  }
})

export default router
