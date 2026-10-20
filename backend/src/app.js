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
app.use('/api/admin', adminRouter)
app.use('/api/notificaciones', notificacionesRouter)
app.use('/api/ubicaciones', ubicacionesRouter)
app.use('/api/emolienteros', emolienterosRouter)
app.use('/api/clientes', clientesRouter)
app.use('/api/jornadas', jornadasRouter)

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
