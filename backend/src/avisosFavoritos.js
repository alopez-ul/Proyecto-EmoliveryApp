// US21 con datos reales: zonas de La Molina y avisos de apertura de jornada a los clientes que tienen al
// emolientero de favorito. Reutiliza la jerarquía Notificacion de src/favoritos.js (T94, RNF18) para el
// texto del aviso, y las mismas reglas de FavoritoService: se avisa solo si el cliente tiene los avisos
// activos y la apertura ocurre en una de sus zonas de interés (T95); si no, solo se registra (T96).
import { NotificacionEnApp } from './favoritos.js'
import { notificar } from './notificaciones.js'

// Centros aproximados de las zonas de La Molina. La zona de un punto es la del centro más cercano.
export const ZONAS_LA_MOLINA = [
  { nombre: 'La Fontana', lat: -12.0745, lng: -76.951 },
  { nombre: 'Camacho', lat: -12.0852, lng: -76.9668 },
  { nombre: 'Santa Patricia', lat: -12.07, lng: -76.942 },
  { nombre: 'Rinconada', lat: -12.092, lng: -76.923 },
  { nombre: 'Sol de La Molina', lat: -12.108, lng: -76.9 },
  { nombre: 'Musa', lat: -12.085, lng: -76.912 },
  { nombre: 'Las Viñas', lat: -12.1, lng: -76.94 },
  { nombre: 'Cieneguilla / Límite', lat: -12.095, lng: -76.88 },
]
export const NOMBRES_ZONAS = ZONAS_LA_MOLINA.map((z) => z.nombre)

// Zona más cercana a un punto (distancia plana: basta para comparar puntos de un mismo distrito).
export function zonaDe({ lat, lng }) {
  let mejor = ZONAS_LA_MOLINA[0]
  let menor = Infinity
  for (const z of ZONAS_LA_MOLINA) {
    const d = (z.lat - lat) ** 2 + ((z.lng - lng) * Math.cos((lat * Math.PI) / 180)) ** 2
    if (d < menor) {
      menor = d
      mejor = z
    }
  }
  return mejor.nombre
}

// T95/T96: ¿se le avisa a este cliente? Devuelve { enviar, motivo }. zonas vacío = cualquier zona.
export function decidirAviso({ avisosActivos, zonas }, zona) {
  if (!avisosActivos) return { enviar: false, motivo: 'tenías los avisos desactivados' }
  if (zonas.length && !zonas.some((z) => z.toLowerCase() === zona.toLowerCase())) {
    return { enviar: false, motivo: 'fue fuera de tus zonas de interés' }
  }
  return { enviar: true, motivo: `Aviso enviado: abrió jornada en ${zona}` }
}

// Al abrir jornada (US06): avisa o registra para cada cliente que tiene al emolientero de favorito.
// `db` es un cliente dentro de la transacción de apertura. Devuelve cuántos avisos se enviaron.
export async function avisarAperturaJornada(db, { emolientero, jornadaId, ubicacion }) {
  const zona = zonaDe(ubicacion)
  const { rows: clientes } = await db.query(
    `SELECT u.id, u.correo, COALESCE(p.avisos_activos, TRUE) AS "avisosActivos", COALESCE(p.zonas, '{}') AS zonas
     FROM favoritos f
     JOIN usuarios u ON u.id = f.cliente_id AND u.estado = 'activo'
     LEFT JOIN preferencias_avisos p ON p.cliente_id = f.cliente_id
     WHERE f.emolientero_id = $1`,
    [emolientero.id],
  )
  let enviados = 0
  for (const cliente of clientes) {
    const { enviar, motivo } = decidirAviso(cliente, zona)
    if (enviar) {
      const { titulo, mensaje } = new NotificacionEnApp({
        destinatarioId: cliente.id,
        emolientero: { id: emolientero.id, nombre: emolientero.nombre, codigoMunicipal: 'Verificado' },
        zona,
        ubicacion: zona,
      }).procesarEnvio()
      await notificar(db, cliente, { tipo: 'favorito_abrio', titulo, mensaje })
      enviados++
    }
    await db.query(
      `INSERT INTO avisos_apertura (cliente_id, emolientero_id, jornada_id, zona, enviado, motivo)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [cliente.id, emolientero.id, jornadaId, zona, enviar, motivo],
    )
  }
  return enviados
}
