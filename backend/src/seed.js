// Crea (o restablece) los usuarios de prueba de US03/US04, los emolienteros pendientes de US23 y el
// catálogo de prueba de US12 y un pedido por entregar de US15. Solo para desarrollo:
// sus contraseñas son públicas, así que no debe ejecutarse en una base con usuarios reales.
import { pool } from './db.js'
import { hashContrasena } from './seguridad.js'
import { crearOrden, formatearCodigo } from './codigoRecojo.js'

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

  // US15: un pedido de Carla a Elmer por entregar, para probar la validación del código de recojo.
  // Si ya tiene uno pendiente con código, no crea otro.
  const { rows: [carla] } = await pool.query("SELECT id FROM usuarios WHERE correo = 'cliente@emolivery.pe'")
  const { rows: [pendiente] } = await pool.query(
    `SELECT codigo_recojo AS codigo FROM ordenes
     WHERE cliente_id = $1 AND emolientero_id = $2 AND estado IN ('pendiente', 'en_camino') AND codigo_recojo IS NOT NULL
     LIMIT 1`,
    [carla.id, elmer.id],
  )
  const codigo = pendiente?.codigo ?? (await crearOrden(pool, { clienteId: carla.id, emolienteroId: elmer.id })).codigoRecojo
  console.log(`Pedido de prueba por entregar: código de recojo ${formatearCodigo(codigo)} (cliente@ → emolientero@)`)

  // US16: un pedido pagado ahora mismo, cancelable durante 30 minutos. Como el pago con QR (US14) aún no
  // existe, se marca pagado directo. Cada vez que se corre el seed se crea uno nuevo.
  const pagado = await crearOrden(pool, { clienteId: carla.id, emolienteroId: elmer.id })
  await pool.query("UPDATE ordenes SET estado = 'pendiente', total = 4.5, pagada_en = now() WHERE id = $1", [pagado.id])
  console.log(`Pedido pagado para probar la cancelación (US16): #${pagado.id}, cancelable hasta 30 min desde ahora`)

  // US19: una reseña publicada sobre Elmer, sin responder. Como publicar reseñas (US17) aún no existe,
  // se publica directo sobre un pedido entregado.
  const entregado = await crearOrden(pool, { clienteId: carla.id, emolienteroId: elmer.id })
  await pool.query("UPDATE ordenes SET estado = 'entregada', entregada_en = now() WHERE id = $1", [entregado.id])
  await pool.query(
    `INSERT INTO resenas (orden_id, cliente_id, emolientero_id, calificacion, comentario, publicada_en)
     VALUES ($1, $2, $3, 5, 'El emoliente estaba bien caliente y me atendió rápido.', now())`,
    [entregado.id, carla.id, elmer.id],
  )
  console.log('Reseña de prueba sin responder para emolientero@ (US19)')
} finally {
  await pool.end()
}
