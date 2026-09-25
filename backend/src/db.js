import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const DB_PATH = fileURLToPath(new URL('../data/db.json', import.meta.url))

// Persistencia simple en un archivo JSON. Reemplazar por una BD real más adelante.
export async function readDb() {
  return JSON.parse(await readFile(DB_PATH, 'utf-8'))
}

export async function writeDb(db) {
  await writeFile(DB_PATH, JSON.stringify(db, null, 2))
}

export function nextId(items) {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1
}
