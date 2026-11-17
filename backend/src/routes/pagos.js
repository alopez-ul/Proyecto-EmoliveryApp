// US14 - Endpoint de validación de pago con QR de Yape y bitácora de transacciones (RNF06)
import { crearRouter } from '../router.js'
import { PagoController, Yape } from '../pagoYape.js'

const router = crearRouter()
const pagoController = new PagoController(new Yape())

// POST /api/pagos/yape/validar
router.post('/yape/validar', async (req, res) => {
  const { orden, numeroOperacion, montoIngresado, ahora } = req.body ?? {}

  const resultado = pagoController.procesarConstancia({
    orden,
    numeroOperacion,
    montoIngresado,
    ahora: ahora ? new Date(ahora) : new Date(),
  })

  if (!resultado.valido) {
    return res.status(422).json(resultado)
  }

  res.json(resultado)
})

// GET /api/pagos/yape/bitacora
router.get('/yape/bitacora', async (_req, res) => {
  res.json(pagoController.obtenerBitacora())
})

export default router
