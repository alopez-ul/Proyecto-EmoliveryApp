// Crea (o restablece) los usuarios de prueba de US03/US04, los emolienteros pendientes de US23 y el
// catálogo de prueba de US12. Solo para desarrollo:
// sus contraseñas son públicas, así que no debe ejecutarse en una base con usuarios reales.
import { pool } from './db.js'
import { hashContrasena } from './seguridad.js'

const USUARIOS_PRUEBA = [
  { nombre: 'Carla Cliente', correo: 'cliente@emolivery.pe', password: 'Cliente123', rol: 'cliente', estado: 'activo' },
  { nombre: 'Elmer Emolientero', correo: 'emolientero@emolivery.pe', password: 'Emoliente123', rol: 'emolientero', estado: 'activo', dni: '40000001' },
  { nombre: 'Admin', correo: 'admin@emolivery.pe', password: 'Admin123', rol: 'admin', estado: 'activo' },
  { nombre: 'Sergio Suspendido', correo: 'suspendido@emolivery.pe', password: 'Suspendido123', rol: 'cliente', estado: 'suspendido' },
  // US23: registros pendientes de verificación para la bandeja del administrador
  { nombre: 'Rosa Huamán', correo: 'rosa@emolivery.pe', password: 'Pendiente123', rol: 'emolientero', estado: 'pendiente_verificacion', dni: '40000002' },
  { nombre: 'Luis Quispe', correo: 'luis@emolivery.pe', password: 'Pendiente123', rol: 'emolientero', estado: 'pendiente_verificacion', dni: '40000003' },
  { nombre: 'Juana Mamani', correo: 'juana@emolivery.pe', password: 'Pendiente123', rol: 'emolientero', estado: 'pendiente_verificacion', dni: '40000004' },
]

// US12: catálogo del emolientero de prueba. Incluye un producto agotado para ver la disponibilidad.
const CATALOGO_PRUEBA = [
  { nombre: 'Emoliente clásico', descripcion: 'Linaza, cola de caballo y alfalfa', categoria: 'emoliente', precio: 1.5 },
  { nombre: 'Emoliente con sábila', descripcion: 'Con sábila y limón', categoria: 'emoliente', precio: 2 },
  { nombre: 'Quinua con manzana', descripcion: 'Caliente, con canela', categoria: 'quinua_avena', precio: 2 },
  { nombre: 'Avena con piña', descripcion: '', categoria: 'quinua_avena', precio: 2, disponible: false },
  { nombre: 'Maca con leche', descripcion: 'Maca andina con leche fresca', categoria: 'maca', precio: 2.5 },
  { nombre: 'Pan con queso', descripcion: '', categoria: 'acompanamiento', precio: 1.5 },
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

  const { rows: [elmer] } = await pool.query("SELECT id FROM usuarios WHERE correo = 'emolientero@emolivery.pe'")
  for (const p of CATALOGO_PRUEBA) {
    await pool.query(
      `INSERT INTO catalogo_productos (emolientero_id, nombre, descripcion, categoria, precio, disponible)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (emolientero_id, lower(nombre)) DO UPDATE
         SET descripcion = EXCLUDED.descripcion, categoria = EXCLUDED.categoria, precio = EXCLUDED.precio,
             disponible = EXCLUDED.disponible, actualizado_en = now()`,
      [elmer.id, p.nombre, p.descripcion, p.categoria, p.precio, p.disponible ?? true],
    )
  }
  console.log(`Catálogo de prueba listo: ${CATALOGO_PRUEBA.length} productos de emolientero@emolivery.pe`)
} finally {
  await pool.end()
}
