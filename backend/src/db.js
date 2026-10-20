import pg from 'pg'

// Conexión a Neon Postgres. DATABASE_URL es la cadena con pooling (PgBouncer), la adecuada
// para el tráfico normal de la API. Se carga desde ../.env.local (lo genera `neon deploy`).
if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL. Ejecuta `neon env pull` en la raíz del proyecto.')
  process.exit(1)
}

// NUMERIC llega como texto para no perder precisión; los montos de la app caben en un número JS.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number)

// Neon entrega sslmode=require; pg ya lo trata como verify-full y avisa que en v9 será más débil.
// Se fija verify-full explícitamente para conservar la verificación completa del certificado.
const connectionString = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=verify-full')

export const pool = new pg.Pool({ connectionString, max: 10 })

export function query(text, params) {
  return pool.query(text, params)
}
