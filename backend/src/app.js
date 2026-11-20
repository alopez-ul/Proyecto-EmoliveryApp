import express from 'express'
import cors from 'cors'
import puntosRouter from './routes/puntos.js'
import productosRouter from './routes/productos.js'
import ventasRouter from './routes/ventas.js'
import authRouter from './routes/auth.js'
import adminRouter from './routes/admin.js'
import notificacionesRouter from './routes/notificaciones.js'
import ubicacionesRouter from './routes/ubicaciones.js'
import emolienterosRouter from './routes/emolienteros.js'
import clientesRouter from './routes/clientes.js'
import jornadasRouter from './routes/jornadas.js'
import puntosHabitualesRouter from './routes/puntosHabituales.js'
import catalogoRouter from './routes/catalogo.js'
import ordenesRouter from './routes/ordenes.js'
import avistamientosRouter from './routes/avistamientos.js'
import noticiasRouter from './routes/noticias.js'
import mapaRouter from './routes/mapa.js'
import pagosRouter from './routes/pagos.js'
import comprasRouter from './routes/compras.js'
import consultaResenasRouter from './routes/consultaResenas.js'
import moderacionRouter from './routes/moderacion.js'
import favoritosRouter from './routes/favoritos.js'
import { cancelacionRouter, devolucionesRouter } from './routes/cancelacion.js'
import respuestasResenasRouter from './routes/respuestasResenas.js'
import publicarResenasRouter from './routes/publicarResenas.js'
import adminUsuariosRouter from './routes/adminUsuarios.js'
import historialComprasRouter from './routes/historialCompras.js'
import { pool } from './db.js'

// La app se crea aquí y se arranca en server.js, para que las pruebas puedan levantarla en otro puerto.
export const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', db: 'ok' })
  } catch (err) {
    res.status(503).json({ status: 'error', db: err.message })
  }
})
app.use('/api/puntos', puntosRouter)
app.use('/api/productos', productosRouter)
app.use('/api/ventas', ventasRouter)
app.use('/api/auth', authRouter)
// US24 va antes que US23: si no, toda petición a /api/admin/usuarios pasaría primero por adminRouter.
app.use('/api/admin/usuarios', adminUsuariosRouter)
app.use('/api/admin', adminRouter)
app.use('/api/notificaciones', notificacionesRouter)
app.use('/api/ubicaciones', ubicacionesRouter)
app.use('/api/emolienteros', emolienterosRouter)
app.use('/api/clientes', clientesRouter)
app.use('/api/jornadas', jornadasRouter)
app.use('/api/puntos-habituales', puntosHabitualesRouter)
app.use('/api/catalogo', catalogoRouter)
app.use('/api/avistamientos', avistamientosRouter)
app.use('/api/noticias', noticiasRouter)
app.use('/api/mapa', mapaRouter)
app.use('/api/pagos', pagosRouter)
// US13 (compras.js), US15 (ordenes.js) y US16 (cancelacion.js) comparten /api/ordenes: cada ruta exige su propio rol.
app.use('/api/ordenes', comprasRouter)
app.use('/api/ordenes', cancelacionRouter)
app.use('/api/ordenes', ordenesRouter)
app.use('/api/devoluciones', devolucionesRouter)
// US18 (consulta pública) y US19 (respuesta del emolientero) comparten /api/resenas.
app.use('/api/resenas', consultaResenasRouter)
app.use('/api/resenas', respuestasResenasRouter)
app.use('/api/resenas', publicarResenasRouter)
app.use('/api/moderacion', moderacionRouter)
app.use('/api/favoritos', favoritosRouter)
app.use('/api/historial-compras', historialComprasRouter)

app.use((err, _req, res, _next) => {
  // JSON mal formado en el cuerpo de la petición
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' })
  // Errores esperados que ya traen su código HTTP (401, 403, 410...)
  if (err.status) return res.status(err.status).json({ error: err.message, ...(err.campos && { campos: err.campos }) })
  // Clases 22 (dato inválido) y 23 (restricción violada) de Postgres: es un error del cliente
  if (/^2[23]/.test(err.code ?? '')) {
    console.warn(`Datos inválidos (${err.code}): ${err.message}`)
    return res.status(400).json({ error: 'Datos inválidos' })
  }
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor' })
})
