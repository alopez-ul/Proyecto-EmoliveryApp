import { Router } from 'express'
import { readDb, writeDb, nextId } from '../db.js'

const router = Router()

router.get('/', async (req, res) => {
  const db = await readDb()
  const { puntoId } = req.query
  const ventas = puntoId ? db.ventas.filter((v) => v.puntoId === Number(puntoId)) : db.ventas
  res.json(ventas)
})

router.get('/resumen', async (_req, res) => {
  const db = await readDb()
  const hoy = new Date().toISOString().slice(0, 10)
  const ventasHoy = db.ventas.filter((v) => v.fecha.startsWith(hoy))
  res.json({
    puntosActivos: db.puntos.filter((p) => p.activo).length,
    puntosTotales: db.puntos.length,
    ventasHoy: ventasHoy.reduce((n, v) => n + v.cantidad, 0),
    ingresosHoy: ventasHoy.reduce((s, v) => s + v.total, 0),
    ingresosTotales: db.ventas.reduce((s, v) => s + v.total, 0),
  })
})

router.post('/', async (req, res) => {
  const { puntoId, productoId, cantidad } = req.body
  const db = await readDb()
  const punto = db.puntos.find((p) => p.id === Number(puntoId))
  const producto = db.productos.find((p) => p.id === Number(productoId))
  const qty = Number(cantidad)
  if (!punto || !producto || !Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ error: 'puntoId, productoId y cantidad (entero > 0) son obligatorios' })
  }
  const venta = {
    id: nextId(db.ventas),
    puntoId: punto.id,
    productoId: producto.id,
    cantidad: qty,
    total: Number((producto.precio * qty).toFixed(2)),
    fecha: new Date().toISOString(),
  }
  db.ventas.push(venta)
  await writeDb(db)
  res.status(201).json(venta)
})

export default router
