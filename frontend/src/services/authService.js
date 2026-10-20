// Autenticación (US03 y US04) contra el backend, que guarda usuarios y enlaces en Neon Postgres.
// Mantiene las mismas funciones que la versión simulada, así las páginas siguen funcionando igual.
//
// Usuarios de prueba (se crean con `npm run db:seed`):
//   cliente@emolivery.pe      / Cliente123      → rol cliente
//   emolientero@emolivery.pe  / Emoliente123    → rol emolientero
//   admin@emolivery.pe        / Admin123        → rol admin
//   suspendido@emolivery.pe   / Suspendido123   → cuenta suspendida

// T15 indica 15 minutos; la Tabla 29 indica 30. Pendiente de confirmar con el equipo.
// Debe coincidir con VIGENCIA_ENLACE_MIN de backend/src/seguridad.js.
export const VIGENCIA_ENLACE_MIN = 15

const CLAVE_SESION = 'emolivery.sesion'

async function pedir(ruta, { method = 'GET', body, token } = {}) {
  const res = await fetch(`/api/auth${ruta}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  })
  const datos = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(datos.error || 'No se pudo conectar con el servidor. Inténtalo de nuevo.')
  return datos
}

// T11: valida credenciales en el servidor y guarda el token de sesión firmado.
export async function iniciarSesion(correo, password) {
  const { token, usuario } = await pedir('/login', { method: 'POST', body: { correo, password } })
  sessionStorage.setItem(CLAVE_SESION, token)
  return usuario
}

// Confirma con el servidor que la sesión es válida (firma correcta, no vencida, cuenta activa).
export async function verificarSesion() {
  const token = sessionStorage.getItem(CLAVE_SESION)
  if (!token) return null
  try {
    return await pedir('/yo', { token })
  } catch {
    sessionStorage.removeItem(CLAVE_SESION)
    return null
  }
}

export function cerrarSesion() {
  sessionStorage.removeItem(CLAVE_SESION)
}

// T15: pide un enlace de recuperación. En desarrollo el backend devuelve el enlace para
// mostrarlo en el buzón simulado; si el correo no existe (o en producción) devuelve null.
export async function solicitarRecuperacion(correo) {
  const { buzon } = await pedir('/recuperar', { method: 'POST', body: { correo } })
  return buzon ?? null
}

// Lanza un error si el enlace no existe, ya venció o ya se utilizó.
export async function validarEnlace(token) {
  if (!token) throw new Error('El enlace de recuperación no es válido.')
  await pedir(`/recuperar/${encodeURIComponent(token)}`)
}

export function validarPassword(password) {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'La contraseña debe incluir letras y números.'
  return null
}

export async function definirNuevaPassword(token, password) {
  await pedir('/nueva-password', { method: 'POST', body: { token, password } })
}

// Solo para pruebas (T17): marca el enlace como vencido sin esperar los minutos de vigencia.
export async function forzarVencimiento(token) {
  await pedir(`/recuperar/${encodeURIComponent(token)}/vencer`, { method: 'POST' })
}
