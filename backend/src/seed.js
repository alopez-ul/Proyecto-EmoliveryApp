// Crea (o restablece) los usuarios de prueba de US03/US04. Solo para desarrollo:
// sus contraseñas son públicas, así que no debe ejecutarse en una base con usuarios reales.
import { pool } from './db.js'
import { hashContrasena } from './seguridad.js'

const USUARIOS_PRUEBA = [
  { nombre: 'Carla Cliente', correo: 'cliente@emolivery.pe', password: 'Cliente123', rol: 'cliente', estado: 'activo' },
  { nombre: 'Elmer Emolientero', correo: 'emolientero@emolivery.pe', password: 'Emoliente123', rol: 'emolientero', estado: 'activo' },
  { nombre: 'Ana Admin', correo: 'admin@emolivery.pe', password: 'Admin123', rol: 'admin', estado: 'activo' },
  { nombre: 'Sergio Suspendido', correo: 'suspendido@emolivery.pe', password: 'Suspendido123', rol: 'cliente', estado: 'suspendido' },
]

try {
  for (const u of USUARIOS_PRUEBA) {
    await pool.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol, estado)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (lower(correo)) DO UPDATE
         SET nombre = EXCLUDED.nombre, password_hash = EXCLUDED.password_hash,
             rol = EXCLUDED.rol, estado = EXCLUDED.estado, actualizado_en = now()`,
      [u.nombre, u.correo, await hashContrasena(u.password), u.rol, u.estado],
    )
    console.log(`Usuario de prueba listo: ${u.correo} (${u.rol}, ${u.estado})`)
  }
} finally {
  await pool.end()
}
