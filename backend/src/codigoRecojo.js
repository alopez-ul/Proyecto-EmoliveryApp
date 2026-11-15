// US15 - T68: código de recojo de un solo uso.
// El cliente lo muestra al recoger su pedido y el emolientero lo valida. Se genera con crypto (no con
// Math.random) para que no se pueda adivinar: 32^6 ≈ mil millones de combinaciones.
import { randomInt } from 'node:crypto'

// Sin 0/O ni 1/I, que se confunden al dictarlos o leerlos en pantalla. Debe coincidir con el CHECK de la migración 012.
export const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const LONGITUD = 6

export function generarCodigoRecojo() {
  let codigo = ''
  for (let i = 0; i < LONGITUD; i++) codigo += ALFABETO[randomInt(ALFABETO.length)]
  return codigo
}

// "abc-23x" → "ABC23X". Acepta minúsculas, espacios y guiones, como lo escribiría el emolientero.
export function normalizarCodigo(texto) {
  return typeof texto === 'string' ? texto.toUpperCase().replace(/[\s-]/g, '') : ''
}

const FORMATO = new RegExp(`^[${ALFABETO}]{${LONGITUD}}$`)
export const esCodigoValido = (codigo) => FORMATO.test(codigo)

// "ABC23X" → "ABC-23X", más fácil de leer y dictar.
export const formatearCodigo = (codigo) => (codigo ? `${codigo.slice(0, 3)}-${codigo.slice(3)}` : codigo)

// Crea una orden con su código de recojo. Si el código ya existe (muy improbable), genera otro.
// `cliente` es un cliente del pool (pool.connect()): si ya está dentro de una transacción, el
// reintento usa un SAVEPOINT para no anularla. US13 (compra anticipada) debe crear sus órdenes con
// esta función para que todas tengan código.
export async function crearOrden(cliente, { clienteId, emolienteroId }, intentos = 5) {
  for (let i = 1; ; i++) {
    await cliente.query('SAVEPOINT nueva_orden').catch(() => {}) // fuera de una transacción no aplica
    try {
      const { rows } = await cliente.query(
        `INSERT INTO ordenes (cliente_id, emolientero_id, codigo_recojo) VALUES ($1, $2, $3)
         RETURNING id, estado, codigo_recojo AS "codigoRecojo", creada_en AS "creadaEn"`,
        [clienteId, emolienteroId, generarCodigoRecojo()],
      )
      return rows[0]
    } catch (err) {
      if (err.code === '23505' && err.constraint === 'ordenes_codigo_recojo_unico' && i < intentos) {
        await cliente.query('ROLLBACK TO SAVEPOINT nueva_orden').catch(() => {})
        continue
      }
      throw err
    }
  }
}
