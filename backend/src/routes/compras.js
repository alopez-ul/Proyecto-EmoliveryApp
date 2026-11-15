// US20 - Historial de compras del cliente.
import { crearRouter } from '../router.js'
import { ErrorHttp } from '../errores.js'
import { requiereRol, requiereSesion } from '../autenticacion.js'
import { validarRangoFechas } from '../validaciones/historialCompras.js'
import { resumirHistorial } from '../historialCompras.js'
import { listarComprasDeCliente } from '../repositorios/historialCompras.js'

const router = crearRouter()

// GET /api/compras?desde=AAAA-MM-DD&hasta=AAAA-MM-DD (ambas opcionales).
// T76: conteo y monto acumulado del periodo. T77: listado con fecha, emolientero, productos, monto y estado.
// Solo el cliente con sesión, y solo sus propias compras.
router.get('/', requiereSesion, requiereRol('cliente'), async (req, res) => {
  const { datos: rango, errores } = validarRangoFechas(req.query)
  if (Object.keys(errores).length) throw new ErrorHttp(400, 'Revisa el rango de fechas.', errores)

  const compras = await listarComprasDeCliente(req.usuario.id, rango)
  res.json({ ...resumirHistorial(compras), desde: rango.desde, hasta: rango.hasta })
})

export default router
