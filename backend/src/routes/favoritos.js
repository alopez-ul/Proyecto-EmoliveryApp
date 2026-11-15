// US21 - Endpoints de Emolienteros Favoritos y Avisos de Apertura de Jornada
import { crearRouter } from '../router.js'
import { CLIENTE_DEMO_ID, FavoritoService } from '../favoritos.js'

const router = crearRouter()
const favoritoService = new FavoritoService()

// GET /api/favoritos?clienteId=...
router.get('/', async (req, res) => {
  const clienteId = req.query.clienteId || CLIENTE_DEMO_ID
  res.json({
    clienteId,
    favoritos: favoritoService.listarFavoritos(clienteId),
    preferencias: favoritoService.obtenerPreferencias(clienteId),
    avisosEnviados: favoritoService.obtenerAvisosEnviados(),
    historialActividad: favoritoService.obtenerHistorialActividad(),
  })
})

// POST /api/favoritos/toggle
router.post('/toggle', async (req, res) => {
  const { clienteId = CLIENTE_DEMO_ID, emolienteroId } = req.body ?? {}
  if (!emolienteroId) {
    return res.status(400).json({ error: 'Se requiere emolienteroId.' })
  }
  const resultado = favoritoService.alternarFavorito(clienteId, emolienteroId)
  res.json(resultado)
})

// POST /api/favoritos/preferencias
router.post('/preferencias', async (req, res) => {
  const { clienteId = CLIENTE_DEMO_ID, ...cambios } = req.body ?? {}
  const preferencias = favoritoService.actualizarPreferencias(clienteId, cambios)
  res.json(preferencias)
})

// POST /api/favoritos/apertura-jornada
router.post('/apertura-jornada', async (req, res) => {
  const resultado = favoritoService.procesarAperturaJornada(req.body ?? {})
  res.json(resultado)
})

export default router
