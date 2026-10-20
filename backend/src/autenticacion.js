import { query } from './db.js'
import { ErrorHttp } from './errores.js'
import { verificarSesion } from './seguridad.js'

// Exige un token de sesión válido y una cuenta activa. Deja el usuario en req.usuario.
export async function requiereSesion(req, _res, next) {
  try {
    const [tipo, token] = (req.get('Authorization') ?? '').split(' ')
    let sesion
    try {
      if (tipo !== 'Bearer' || !token) throw new Error()
      sesion = verificarSesion(token)
    } catch {
      throw new ErrorHttp(401, 'Sesión no válida o vencida.')
    }
    // El rol y el estado se leen de la BD, no del token: si cambiaron, manda la BD.
    const { rows } = await query('SELECT id, nombre, correo, rol, estado FROM usuarios WHERE id = $1', [sesion.sub])
    if (!rows[0] || rows[0].estado !== 'activo') throw new ErrorHttp(401, 'Sesión no válida o vencida.')
    req.usuario = rows[0]
    next()
  } catch (err) {
    next(err)
  }
}

// Uso: router.get('/ruta', requiereSesion, requiereRol('admin'), handler)
export function requiereRol(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.usuario?.rol)) return next(new ErrorHttp(403, 'No tienes permiso para realizar esta acción.'))
    next()
  }
}
