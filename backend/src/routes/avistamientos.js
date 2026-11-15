// US09 - Confirmación de avistamiento: un cliente confirma que ve al emolientero donde lo muestra el mapa.
import { crearRouter } from '../router.js'
import { pool } from '../db.js'
import { ErrorHttp } from '../errores.js'
import { requiereRol, requiereSesion } from '../autenticacion.js'
import { validarUbicacion } from '../zonaCobertura.js'
import {
  AvistamientoCliente,
  AvistamientoVerificado,
  RADIO_CONFIRMACION_M,
  VENTANA_AVISTAMIENTO_MIN,
  distanciaMetros,
  ubicacionesVigentes,
  ventanaDe,
} from '../fuentesUbicacion.js'

const router = crearRouter()
router.use(requiereSesion, requiereRol('cliente'))

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const formatoHora = new Intl.DateTimeFormat('es-PE', { timeStyle: 'short', timeZone: 'America/Lima' })
const MENSAJE_REPETIDO = (desde) =>
  `Ya confirmaste a este emolientero hace poco. Podrás volver a confirmarlo desde las ${formatoHora.format(desde)}.`

// Inicio de la siguiente ventana: desde ahí el cliente puede volver a confirmar.
const siguienteVentana = (ventana) => new Date((ventana + 1) * VENTANA_AVISTAMIENTO_MIN * 60_000)

// Reportes de clientes de un emolientero en las últimas `minutos`, como objetos AvistamientoCliente.
async function reportesRecientes(db, emolienteroId, ahora, minutos) {
  const { rows } = await db.query(
    `SELECT a.ubicacion_id AS id, a.emolientero_id AS "emolienteroId", a.cliente_id AS "clienteId", u.nombre,
            ub.lat, ub.lng, ub.precision_m AS "precisionM", a.registrado_en AS "registradaEn"
     FROM avistamientos a
     JOIN ubicaciones ub ON ub.id = a.ubicacion_id
     JOIN usuarios u ON u.id = a.emolientero_id
     WHERE a.emolientero_id = $1 AND a.registrado_en > $2::timestamptz - make_interval(mins => $3)`,
    [emolienteroId, ahora, minutos],
  )
  return rows.map((r) => new AvistamientoCliente(r))
}

// T79 + T80 + T81. Body: { emolienteroId, lat, lng, precision } (lat/lng/precision: GPS del cliente).
router.post('/', async (req, res) => {
  const { emolienteroId, lat, lng, precision } = req.body ?? {}
  if (typeof emolienteroId !== 'string' || !UUID.test(emolienteroId)) throw new ErrorHttp(404, 'Emolientero no encontrado.')
  // Mismas reglas que la ubicación del emolientero (US05): coordenadas válidas, La Molina y GPS de 50 m o mejor.
  const problema = validarUbicacion({ lat, lng, precision })
  if (problema) throw new ErrorHttp(problema.status, problema.error)

  const ahora = new Date()
  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')

    // T79: solo se confirma lo que el mapa muestra ahora (emolientero activo, con la jornada abierta).
    const [objetivo] = await ubicacionesVigentes(cliente, emolienteroId, ahora)
    if (!objetivo) {
      const { rowCount: existe } = await cliente.query(
        "SELECT 1 FROM usuarios WHERE id = $1 AND rol = 'emolientero' AND estado = 'activo'",
        [emolienteroId],
      )
      if (!existe) throw new ErrorHttp(404, 'Emolientero no encontrado.')
      throw new ErrorHttp(422, 'Este emolientero no está atendiendo ahora: no hay una ubicación que confirmar.')
    }

    const distancia = distanciaMetros({ lat, lng }, objetivo)
    if (distancia > RADIO_CONFIRMACION_M) {
      throw new ErrorHttp(
        422,
        `Estás a ${Math.round(distancia)} m del emolientero. Para confirmar debes estar a ${RADIO_CONFIRMACION_M} m o menos.`,
      )
    }

    // T81: ¿ya lo confirmó en esta ventana? Se compara con equals, como en un HashSet.
    const nuevo = new AvistamientoCliente({
      emolienteroId, clienteId: req.usuario.id, nombre: objetivo.nombre, lat, lng, precisionM: precision, registradaEn: ahora,
    })
    const previos = await reportesRecientes(cliente, emolienteroId, ahora, VENTANA_AVISTAMIENTO_MIN)
    if (previos.some((p) => p.equals(nuevo))) throw new ErrorHttp(409, MENSAJE_REPETIDO(siguienteVentana(nuevo.ventana)))

    const { rows: [ubicacion] } = await cliente.query(
      `INSERT INTO ubicaciones (emolientero_id, lat, lng, precision_m, fuente, registrada_en)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [emolienteroId, lat, lng, precision, AvistamientoCliente.CODIGO, ahora],
    )
    await cliente.query(
      `INSERT INTO avistamientos (ubicacion_id, emolientero_id, cliente_id, distancia_m, ventana, registrado_en)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ubicacion.id, emolienteroId, req.usuario.id, distancia, ventanaDe(ahora), ahora],
    )

    // T80: con el reporte nuevo, ¿coinciden suficientes clientes? Entonces se registra el avistamiento verificado.
    nuevo.id = ubicacion.id
    const verificado = AvistamientoVerificado.porCoincidencia([...previos, nuevo], ahora)
    if (verificado) {
      await cliente.query(
        `INSERT INTO ubicaciones (emolientero_id, lat, lng, precision_m, fuente, registrada_en)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [emolienteroId, verificado.lat, verificado.lng, verificado.precisionM, AvistamientoVerificado.CODIGO, ahora],
      )
    }
    await cliente.query('COMMIT')

    res.status(201).json({
      avistamiento: { id: ubicacion.id, distanciaM: Math.round(distancia), registradoEn: ahora },
      verificado: Boolean(verificado),
      confirmaciones: verificado?.confirmaciones ?? new Set([...previos, nuevo].map((r) => r.clienteId)).size,
    })
  } catch (err) {
    await cliente.query('ROLLBACK')
    // Otra confirmación simultánea del mismo cliente ganó la carrera: la frena la restricción única.
    if (err.code === '23505' && err.constraint === 'avistamientos_sin_repetir') {
      throw new ErrorHttp(409, MENSAJE_REPETIDO(siguienteVentana(ventanaDe(ahora))))
    }
    throw err
  } finally {
    cliente.release()
  }
})

export default router
