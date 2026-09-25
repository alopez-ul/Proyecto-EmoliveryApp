import express from 'express'
import cors from 'cors'
import puntosRouter from './routes/puntos.js'
import productosRouter from './routes/productos.js'
import ventasRouter from './routes/ventas.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
app.use('/api/puntos', puntosRouter)
app.use('/api/productos', productosRouter)
app.use('/api/ventas', ventasRouter)

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor' })
})

app.listen(PORT, () => {
  console.log(`API Emoliente Tracker escuchando en http://localhost:${PORT}`)
})
