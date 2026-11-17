// US07 - Endpoint de localización de emolienteros cercanos en La Molina
import { crearRouter } from '../router.js'
import { MapaController } from '../localizacion.js'

const router = crearRouter()
const mapaController = new MapaController()

// GET /api/mapa/cercanos?lat=-12.0734&lng=-76.9512&radio=1500&orden=distancia&zona=La+Fontana
router.get('/cercanos', async (req, res) => {
  const { lat, lng, radio = 1000, orden = 'distancia', zona, q = '' } = req.query

  if (zona && (lat === undefined || lng === undefined)) {
    const porZona = mapaController.obtenerPorZona({ zona, textoBusqueda: String(q) })
    return res.json(porZona)
  }

  const latNum = Number(lat ?? -12.0734)
  const lngNum = Number(lng ?? -76.9512)
  const radioNum = Number(radio) || 1000

  const resultado = mapaController.obtenerCercanos({
    latitud: latNum,
    longitud: lngNum,
    radioMetros: radioNum,
    tipoOrden: orden === 'calificacion' ? 'calificacion' : 'distancia',
  })

  res.json(resultado)
})

// GET /api/mapa/benchmark?cantidad=50
router.get('/benchmark', async (req, res) => {
  const cantidad = Math.min(200, Math.max(1, Number(req.query.cantidad) || 50))
  const resultado = mapaController.ejecutarBenchmarkRNF01(cantidad)
  res.json(resultado)
})

export default router
