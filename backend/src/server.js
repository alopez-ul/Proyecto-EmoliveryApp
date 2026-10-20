import express from 'express'
import cors from 'cors'
import puntosRouter from './routes/puntos.js'
import productosRouter from './routes/productos.js'
import ventasRouter from './routes/ventas.js'
import authRouter from './routes/auth.js'
import { pool } from './db.js'

const app = express()
const PORT = process.env.PORT || 3001

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

app.use((err, _req, res, _next) => {
  // JSON mal formado en el cuerpo de la petición
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' })
  // Errores esperados que ya traen su código HTTP (401, 403, 410...)
  if (err.status) return res.status(err.status).json({ error: err.message })
  // Clases 22 (dato inválido) y 23 (restricción violada) de Postgres: es un error del cliente
  if (/^2[23]/.test(err.code ?? '')) {
    console.warn(`Datos inválidos (${err.code}): ${err.message}`)
    return res.status(400).json({ error: 'Datos inválidos' })
  }
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor' })
})

app.listen(PORT, () => {
  console.log(`API Emolivery escuchando en http://localhost:${PORT}`)
})
