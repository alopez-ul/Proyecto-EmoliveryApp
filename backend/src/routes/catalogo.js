// US12 - Consulta de catálogo y precios (vista pública para clientes).
import { crearRouter } from '../router.js'
import { query } from '../db.js'
import { ErrorHttp } from '../errores.js'

const router = crearRouter()

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// T54: orden y nombre con que se muestran las categorías. Deben coincidir con el CHECK de 009_catalogo.sql.
export const CATEGORIAS = [
  { id: 'emoliente', nombre: 'Emolientes' },
  { id: 'quinua_avena', nombre: 'Quinua y avena' },
  { id: 'maca', nombre: 'Maca' },
  { id: 'otras_bebidas', nombre: 'Otras bebidas' },
  { id: 'acompanamiento', nombre: 'Acompañamientos' },
]

export const MOTIVO_FUERA_DE_JORNADA = 'Este emolientero está fuera de jornada. Puedes ver su catálogo, pero no comprar hasta que abra.'

// Catálogo de un emolientero agrupado por categoría. Solo se publica el de cuentas activas
// (verificadas en US23): un emolientero pendiente, rechazado o suspendido responde 404.
router.get('/:emolienteroId', async (req, res) => {
  const { emolienteroId } = req.params
  if (!UUID.test(emolienteroId)) throw new ErrorHttp(404, 'Emolientero no encontrado.')

  const { rows: [emolientero] } = await query(
    `SELECT u.id, u.nombre,
            EXISTS (SELECT 1 FROM jornadas j WHERE j.emolientero_id = u.id AND j.cerrada_en IS NULL) AS "enJornada"
     FROM usuarios u
     WHERE u.id = $1 AND u.rol = 'emolientero' AND u.estado = 'activo'`,
    [emolienteroId],
  )
  if (!emolientero) throw new ErrorHttp(404, 'Emolientero no encontrado.')

  const { rows: productos } = await query(
    `SELECT id, nombre, descripcion, categoria, precio, disponible
     FROM catalogo_productos WHERE emolientero_id = $1
     ORDER BY lower(nombre)`,
    [emolienteroId],
  )

  // T56: fuera de jornada nada se puede comprar. T55: un producto agotado tampoco.
  const puedeComprar = emolientero.enJornada
  const categorias = CATEGORIAS.map((c) => ({
    ...c,
    productos: productos
      .filter((p) => p.categoria === c.id)
      .map(({ categoria, ...p }) => ({ ...p, comprable: puedeComprar && p.disponible })),
  })).filter((c) => c.productos.length)

  res.json({
    emolientero,
    puedeComprar,
    motivoNoCompra: puedeComprar ? null : MOTIVO_FUERA_DE_JORNADA,
    categorias,
  })
})

export default router
