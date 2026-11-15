// US15: pedidos y validación del código de recojo.
import { pedirConSesion } from './authService.js'

// Cliente: sus pedidos con el código de recojo.
export const misPedidos = () => pedirConSesion('/ordenes/mias')

// Emolientero: pedidos por entregar y validación del código.
export const pedidosPorEntregar = () => pedirConSesion('/ordenes/por-entregar')
export const entregarConCodigo = (codigo) => pedirConSesion('/ordenes/entregar', { method: 'POST', body: { codigo } })

// --- Formato del código: mismo que backend/src/codigoRecojo.js (el backend es el que decide) ---
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// Mientras escribe: mayúsculas, solo caracteres válidos y guion después del tercero ("abc23x" → "ABC-23X").
export function formatearMientrasEscribe(texto) {
  const limpio = texto
    .toUpperCase()
    .split('')
    .filter((c) => ALFABETO.includes(c))
    .join('')
    .slice(0, 6)
  return limpio.length > 3 ? `${limpio.slice(0, 3)}-${limpio.slice(3)}` : limpio
}

export const codigoCompleto = (texto) => texto.replace('-', '').length === 6
