// Autenticación SIMULADA en el navegador (US03 y US04, Release 1 / Sprint 1).
// No usa backend: los usuarios, el token de sesión y los enlaces de recuperación
// se generan aquí. Cuando el equipo elija el servicio real, solo se reemplaza
// este archivo y las páginas siguen funcionando igual.
//
// Usuarios de prueba:
//   cliente@emolivery.pe      / Cliente123      → rol cliente
//   emolientero@emolivery.pe  / Emoliente123    → rol emolientero
//   admin@emolivery.pe        / Admin123        → rol admin
//   suspendido@emolivery.pe   / Suspendido123   → cuenta suspendida

// T15 indica 15 minutos; la Tabla 29 indica 30. Pendiente de confirmar con el equipo.
export const VIGENCIA_ENLACE_MIN = 15
const VIGENCIA_SESION_MIN = 120

const USUARIOS_PRUEBA = [
  { id: 'u1', nombre: 'Carla Cliente', correo: 'cliente@emolivery.pe', password: 'Cliente123', rol: 'cliente', estado: 'activo' },
  { id: 'u2', nombre: 'Elmer Emolientero', correo: 'emolientero@emolivery.pe', password: 'Emoliente123', rol: 'emolientero', estado: 'activo' },
  { id: 'u3', nombre: 'Ana Admin', correo: 'admin@emolivery.pe', password: 'Admin123', rol: 'admin', estado: 'activo' },
  { id: 'u4', nombre: 'Sergio Suspendido', correo: 'suspendido@emolivery.pe', password: 'Suspendido123', rol: 'cliente', estado: 'suspendido' },
]

const CLAVE_SESION = 'emolivery.sesion'
const CLAVE_PASSWORDS = 'emolivery.passwords'
const CLAVE_ENLACES = 'emolivery.enlaces'

const esperar = (ms = 400) => new Promise((r) => setTimeout(r, ms))

function leer(clave) {
  try {
    return JSON.parse(localStorage.getItem(clave)) || {}
  } catch {
    return {}
  }
}

function guardar(clave, valor) {
  localStorage.setItem(clave, JSON.stringify(valor))
}

function buscarUsuario(correo) {
  const normalizado = correo.trim().toLowerCase()
  const usuario = USUARIOS_PRUEBA.find((u) => u.correo === normalizado)
  if (!usuario) return null
  // Las contraseñas cambiadas por recuperación (US04) se guardan aparte.
  const cambiada = leer(CLAVE_PASSWORDS)[usuario.correo]
  return cambiada ? { ...usuario, password: cambiada } : usuario
}

const base64url = (obj) => btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

function decodificar(parte) {
  return JSON.parse(atob(parte.replace(/-/g, '+').replace(/_/g, '/')))
}

// T11: valida credenciales y emite un token de sesión con forma de JWT (sin firma real).
export async function iniciarSesion(correo, password) {
  await esperar()
  const usuario = buscarUsuario(correo)
  if (!usuario || usuario.password !== password) {
    throw new Error('Correo o contraseña incorrectos.')
  }
  if (usuario.estado === 'suspendido') {
    throw new Error('Tu cuenta está suspendida. Comunícate con el administrador.')
  }
  const payload = {
    sub: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    rol: usuario.rol,
    exp: Date.now() + VIGENCIA_SESION_MIN * 60_000,
  }
  const token = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url(payload)}.simulado`
  sessionStorage.setItem(CLAVE_SESION, token)
  return payload
}

export function usuarioActual() {
  const token = sessionStorage.getItem(CLAVE_SESION)
  if (!token) return null
  try {
    const payload = decodificar(token.split('.')[1])
    if (payload.exp < Date.now()) {
      sessionStorage.removeItem(CLAVE_SESION)
      return null
    }
    return payload
  } catch {
    return null
  }
}

export function cerrarSesion() {
  sessionStorage.removeItem(CLAVE_SESION)
}

// T15: genera el enlace de recuperación con vigencia limitada.
// Devuelve el enlace solo para mostrarlo en el buzón simulado; si el correo no existe devuelve null.
export async function solicitarRecuperacion(correo) {
  await esperar()
  const usuario = buscarUsuario(correo)
  if (!usuario) return null
  const token = crypto.randomUUID()
  const enlaces = leer(CLAVE_ENLACES)
  enlaces[token] = { correo: usuario.correo, expira: Date.now() + VIGENCIA_ENLACE_MIN * 60_000, usado: false }
  guardar(CLAVE_ENLACES, enlaces)
  return { token, enlace: `#nueva-password?token=${token}`, correo: usuario.correo }
}

// Lanza un error si el enlace no existe, ya venció o ya se utilizó.
export function validarEnlace(token) {
  const enlace = leer(CLAVE_ENLACES)[token]
  if (!enlace) throw new Error('El enlace de recuperación no es válido.')
  if (enlace.usado) throw new Error('Este enlace ya fue utilizado. Solicita uno nuevo.')
  if (enlace.expira < Date.now()) throw new Error('El enlace de recuperación venció. Solicita uno nuevo.')
  return enlace
}

export function validarPassword(password) {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'La contraseña debe incluir letras y números.'
  return null
}

export async function definirNuevaPassword(token, password) {
  await esperar()
  const enlace = validarEnlace(token)
  const error = validarPassword(password)
  if (error) throw new Error(error)
  const passwords = leer(CLAVE_PASSWORDS)
  passwords[enlace.correo] = password
  guardar(CLAVE_PASSWORDS, passwords)
  const enlaces = leer(CLAVE_ENLACES)
  enlaces[token].usado = true
  guardar(CLAVE_ENLACES, enlaces)
}

// Solo para pruebas (T17): marca el enlace como vencido sin esperar los minutos de vigencia.
export function forzarVencimiento(token) {
  const enlaces = leer(CLAVE_ENLACES)
  if (enlaces[token]) {
    enlaces[token].expira = Date.now() - 1
    guardar(CLAVE_ENLACES, enlaces)
  }
}
