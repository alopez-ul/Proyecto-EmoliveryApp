// Aplica en orden las migraciones de db/migrations que aún no se han ejecutado.
// Usa la conexión directa (DATABASE_URL_UNPOOLED), como recomienda Neon para cambios de esquema.
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const DIR = fileURLToPath(new URL('../db/migrations/', import.meta.url))
const url = process.env.DATABASE_URL_UNPOOLED?.replace('sslmode=require', 'sslmode=verify-full')

if (!url) {
  console.error('Falta DATABASE_URL_UNPOOLED. Ejecuta `neon env pull` en la raíz del proyecto.')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url })
await client.connect()

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      nombre      TEXT PRIMARY KEY,
      aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now()
    )`)
  const { rows } = await client.query('SELECT nombre FROM schema_migrations')
  const aplicadas = new Set(rows.map((r) => r.nombre))
  const pendientes = (await readdir(DIR)).filter((f) => f.endsWith('.sql') && !aplicadas.has(f)).sort()

  for (const archivo of pendientes) {
    const sql = await readFile(DIR + archivo, 'utf-8')
    await client.query('BEGIN')
    try {
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [archivo])
      await client.query('COMMIT')
      console.log(`Aplicada: ${archivo}`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw new Error(`Falló ${archivo}: ${err.message}`)
    }
  }
  if (!pendientes.length) console.log('Sin migraciones pendientes.')
} finally {
  await client.end()
}
