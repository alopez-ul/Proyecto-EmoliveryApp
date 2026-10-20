// Crea (o restablece) los usuarios de prueba de US03/US04 y los emolienteros pendientes de US23. Solo para desarrollo:
// sus contraseñas son públicas, así que no debe ejecutarse en una base con usuarios reales.
import { pool } from './db.js'
import { hashContrasena } from './seguridad.js'

const USUARIOS_PRUEBA = [
  { nombre: 'Carla Cliente', correo: 'cliente@emolivery.pe', password: 'Cliente123', rol: 'cliente', estado: 'activo' },
  { nombre: 'Elmer Emolientero', correo: 'emolientero@emolivery.pe', password: 'Emoliente123', rol: 'emolientero', estado: 'activo', dni: '40000001' },
  { nombre: 'Ana Admin', correo: 'admin@emolivery.pe', password: 'Admin123', rol: 'admin', estado: 'activo' },
  { nombre: 'Sergio Suspendido', correo: 'suspendido@emolivery.pe', password: 'Suspendido123', rol: 'cliente', estado: 'suspendido' },
  // US23: registros pendientes de verificación para la bandeja del administrador
  { nombre: 'Rosa Huamán', correo: 'rosa@emolivery.pe', password: 'Pendiente123', rol: 'emolientero', estado: 'pendiente_verificacion', dni: '40000002' },
  { nombre: 'Luis Quispe', correo: 'luis@emolivery.pe', password: 'Pendiente123', rol: 'emolientero', estado: 'pendiente_verificacion', dni: '40000003' },
  { nombre: 'Juana Mamani', correo: 'juana@emolivery.pe', password: 'Pendiente123', rol: 'emolientero', estado: 'pendiente_verificacion', dni: '40000004' },
]

try {
  for (const u of USUARIOS_PRUEBA) {
    await pool.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol, estado, dni)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (lower(correo)) DO UPDATE
         SET nombre = EXCLUDED.nombre, password_hash = EXCLUDED.password_hash,
             rol = EXCLUDED.rol, estado = EXCLUDED.estado, dni = EXCLUDED.dni, actualizado_en = now()`,
      [u.nombre, u.correo, await hashContrasena(u.password), u.rol, u.estado, u.dni ?? null],
    )
    console.log(`Usuario de prueba listo: ${u.correo} (${u.rol}, ${u.estado})`)
  }
} finally {
  await pool.end()
}
