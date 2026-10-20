import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import jwt from 'jsonwebtoken'

const scryptAsync = promisify(scrypt)

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('Falta JWT_SECRET (mínimo 32 caracteres) en backend/.env. Revisa backend/.env.example.')
  process.exit(1)
}

export const VIGENCIA_SESION = '2h'
export const VIGENCIA_ENLACE_MIN = 15

// Contraseñas con scrypt. Formato guardado: "scrypt$<sal hex>$<hash hex>".
export async function hashContrasena(contrasena) {
  const sal = randomBytes(16)
  const hash = await scryptAsync(contrasena, sal, 64)
  return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`
}

export async function verificarContrasena(contrasena, guardado) {
  const [, salHex, hashHex] = guardado.split('$')
  const esperado = Buffer.from(hashHex, 'hex')
  const calculado = await scryptAsync(contrasena, Buffer.from(salHex, 'hex'), esperado.length)
  return timingSafeEqual(calculado, esperado)
}

// Hash de referencia para comparar cuando el correo no existe, y así tardar lo mismo
// (evita revelar por tiempo de respuesta qué correos están registrados).
export const HASH_FICTICIO = await hashContrasena(randomBytes(16).toString('hex'))

export function firmarSesion(usuario) {
  const payload = { nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol }
  return jwt.sign(payload, process.env.JWT_SECRET, { subject: usuario.id, expiresIn: VIGENCIA_SESION, algorithm: 'HS256' })
}

export function verificarSesion(token) {
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
}

export function nuevoTokenRecuperacion() {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashToken(token) }
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function validarPassword(password) {
  if (typeof password !== 'string' || password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'La contraseña debe incluir letras y números.'
  return null
}
