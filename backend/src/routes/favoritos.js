// US21 - Emolienteros favoritos y avisos de apertura de jornada.
// Las rutas reales usan la BD y la sesión del cliente. Las de /demo son la demostración en memoria
// (FavoritoService con emolienteros de ejemplo) que usa la pantalla #favoritos?demo.
import { crearRouter } from '../router.js'
import { query } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { requiereRol, requiereSesion } from '../autenticacion.js'
import { CLIENTE_DEMO_ID, FavoritoService } from '../favoritos.js'
import { NOMBRES_ZONAS, zonaDe } from '../avisosFavoritos.js'

const router = crearRouter()

// ---------- Demostración en memoria (pantalla #favoritos?demo) ----------
const favoritoService = new FavoritoService()

router.get('/demo', async (req, res) => {
  const clienteId = req.query.clienteId || CLIENTE_DEMO_ID
  res.json({
    clienteId,
    favoritos: favoritoService.listarFavoritos(clienteId),
    preferencias: favoritoService.obtenerPreferencias(clienteId),
    avisosEnviados: favoritoService.obtenerAvisosEnviados(),
    historialActividad: favoritoService.obtenerHistorialActividad(),
  })
})
router.post('/demo/toggle', async (req, res) => {
  const { clienteId = CLIENTE_DEMO_ID, emolienteroId } = req.body ?? {}
  if (!emolienteroId) throw new ErrorHttp(400, 'Se requiere emolienteroId.')
  res.json(favoritoService.alternarFavorito(clienteId, emolienteroId))
})
router.post('/demo/preferencias', async (req, res) => {
  const { clienteId = CLIENTE_DEMO_ID, ...cambios } = req.body ?? {}
  res.json(favoritoService.actualizarPreferencias(clienteId, cambios))
})
router.post('/demo/apertura-jornada', async (req, res) => {
  res.json(favoritoService.procesarAperturaJornada(req.body ?? {}))
})

// ---------- Favoritos reales (cliente con sesión) ----------
const soloCliente = [requiereSesion, requiereRol('cliente')]
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Emolienteros verificados con: si está atendiendo, su zona (por su último GPS o su punto habitual) y si es favorito.
async function emolienteros(clienteId, soloFavoritos) {
  const { rows } = await query(
    `SELECT u.id, u.nombre,
            EXISTS (SELECT 1 FROM jornadas j WHERE j.emolientero_id = u.id AND j.cerrada_en IS NULL) AS atendiendo,
            (f.cliente_id IS NOT NULL) AS favorito,
            ub.lat AS "ubLat", ub.lng AS "ubLng", ph.lat AS "phLat", ph.lng AS "phLng"
     FROM usuarios u
     LEFT JOIN favoritos f ON f.emolientero_id = u.id AND f.cliente_id = $1
     LEFT JOIN LATERAL (SELECT lat, lng FROM ubicaciones WHERE emolientero_id = u.id AND fuente = 'gps_emolientero'
                        ORDER BY registrada_en DESC LIMIT 1) ub ON TRUE
     LEFT JOIN LATERAL (SELECT lat, lng FROM puntos_habituales WHERE emolientero_id = u.id ORDER BY id LIMIT 1) ph ON TRUE
     WHERE u.rol = 'emolientero' AND u.estado = 'activo' AND ($2::boolean IS FALSE OR f.cliente_id IS NOT NULL)
     ORDER BY atendiendo DESC, favorito DESC, lower(u.nombre)`,
    [clienteId, soloFavoritos],
  )
  return rows.map(({ ubLat, ubLng, phLat, phLng, ...e }) => {
    const punto = ubLat != null ? { lat: ubLat, lng: ubLng } : phLat != null ? { lat: phLat, lng: phLng } : null
    return { ...e, zona: punto ? zonaDe(punto) : null }
  })
}

async function preferencias(clienteId) {
  const { rows: [p] } = await query(
    'SELECT avisos_activos AS "avisosActivos", zonas FROM preferencias_avisos WHERE cliente_id = $1',
    [clienteId],
  )
  return p ?? { avisosActivos: true, zonas: [] }
}

// T93/T95/T96: favoritos, preferencias, zonas disponibles y los últimos avisos (enviados o no).
router.get('/', ...soloCliente, async (req, res) => {
  const id = req.usuario.id
  const [favoritos, prefs, { rows: avisos }] = await Promise.all([
    emolienteros(id, true),
    preferencias(id),
    query(
      `SELECT a.id, u.nombre AS emolientero, a.zona, a.enviado, a.motivo, a.creado_en AS "creadoEn"
       FROM avisos_apertura a JOIN usuarios u ON u.id = a.emolientero_id
       WHERE a.cliente_id = $1 ORDER BY a.creado_en DESC LIMIT 20`,
      [id],
    ),
  ])
  res.json({ favoritos, preferencias: prefs, zonas: NOMBRES_ZONAS, avisos })
})

// Directorio para descubrir y marcar emolienteros.
router.get('/directorio', ...soloCliente, async (req, res) => {
  res.json(await emolienteros(req.usuario.id, false))
})

// T95/T96: preferencias de aviso. zonas vacío = todas las zonas.
router.put('/preferencias', ...soloCliente, async (req, res) => {
  const { avisosActivos, zonas } = req.body ?? {}
  if (typeof avisosActivos !== 'boolean') throw new ErrorHttp(400, 'Indica si quieres recibir avisos.', { avisosActivos: 'Debe ser verdadero o falso.' })
  if (!Array.isArray(zonas) || zonas.some((z) => !NOMBRES_ZONAS.includes(z))) {
    throw new ErrorHttp(400, 'Hay zonas que no existen en La Molina.', { zonas: `Elige entre: ${NOMBRES_ZONAS.join(', ')}.` })
  }
  const { rows: [p] } = await query(
    `INSERT INTO preferencias_avisos (cliente_id, avisos_activos, zonas) VALUES ($1, $2, $3)
     ON CONFLICT (cliente_id) DO UPDATE SET avisos_activos = EXCLUDED.avisos_activos, zonas = EXCLUDED.zonas, actualizado_en = now()
     RETURNING avisos_activos AS "avisosActivos", zonas`,
    [req.usuario.id, avisosActivos, [...new Set(zonas)]],
  )
  res.json(p)
})

// T93: marcar y desmarcar. Solo emolienteros verificados (cuenta activa).
const emolienteroValido = async (id) => {
  if (!UUID.test(id)) return false
  const { rowCount } = await query("SELECT 1 FROM usuarios WHERE id = $1 AND rol = 'emolientero' AND estado = 'activo'", [id])
  return rowCount > 0
}

router.post('/:emolienteroId', ...soloCliente, async (req, res) => {
  const { emolienteroId } = req.params
  if (!(await emolienteroValido(emolienteroId))) throw new ErrorHttp(404, 'Emolientero no encontrado.')
  await query('INSERT INTO favoritos (cliente_id, emolientero_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.usuario.id, emolienteroId])
  res.status(201).json({ emolienteroId, favorito: true })
})

router.delete('/:emolienteroId', ...soloCliente, async (req, res) => {
  const { emolienteroId } = req.params
  if (!UUID.test(emolienteroId)) throw new ErrorHttp(404, 'Emolientero no encontrado.')
  await query('DELETE FROM favoritos WHERE cliente_id = $1 AND emolientero_id = $2', [req.usuario.id, emolienteroId])
  res.json({ emolienteroId, favorito: false })
})

export default router
