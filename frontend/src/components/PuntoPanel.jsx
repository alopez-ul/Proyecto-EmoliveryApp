import { useEffect, useState } from 'react'
import { api } from '../services/api.js'

export default function PuntoPanel({ punto, productos, onClose, onVenta, onToggleActivo }) {
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [ventas, setVentas] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    api.getVentas(punto.id).then(setVentas).catch((e) => setError(e.message))
  }, [punto.id])

  useEffect(() => {
    if (!productoId && productos.length) setProductoId(String(productos[0].id))
  }, [productos, productoId])

  const producto = productos.find((p) => p.id === Number(productoId))
  const total = producto ? producto.precio * cantidad : 0
  const vendidoTotal = ventas.reduce((s, v) => s + v.total, 0)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      const venta = await api.registrarVenta({ puntoId: punto.id, productoId: Number(productoId), cantidad })
      setVentas((prev) => [...prev, venta])
      setCantidad(1)
      onVenta()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="panel punto-panel">
      <header className="panel-header">
        <h2 className="panel-title">Punto #{String(punto.id).padStart(3, '0')}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
      </header>

      <h3 className="punto-nombre">{punto.nombre}</h3>
      <dl className="punto-datos">
        <dt>Encargado</dt><dd>{punto.encargado}</dd>
        <dt>Dirección</dt><dd>{punto.direccion || '—'}</dd>
        <dt>Horario</dt><dd>{punto.horario || '—'}</dd>
        <dt>Coordenadas</dt><dd>{punto.lat.toFixed(5)}, {punto.lng.toFixed(5)}</dd>
        <dt>Vendido</dt><dd>S/ {vendidoTotal.toFixed(2)} ({ventas.length} ventas)</dd>
      </dl>

      <button className={`btn ${punto.activo ? 'btn-ghost' : 'btn-primary'}`} onClick={() => onToggleActivo(punto)}>
        {punto.activo ? 'Marcar fuera de línea' : 'Activar punto'}
      </button>

      <form className="venta-form" onSubmit={handleSubmit}>
        <h4 className="panel-subtitle">Registrar venta</h4>
        <label>
          Producto
          <select value={productoId} onChange={(e) => setProductoId(e.target.value)}>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre} — S/ {p.precio.toFixed(2)}</option>
            ))}
          </select>
        </label>
        <label>
          Cantidad
          <input
            type="number"
            min="1"
            value={cantidad}
            onChange={(e) => setCantidad(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
          />
        </label>
        <div className="venta-total">Total: <strong>S/ {total.toFixed(2)}</strong></div>
        <button className="btn btn-primary" type="submit" disabled={!punto.activo || !producto}>
          {punto.activo ? 'Vender' : 'Punto fuera de línea'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </section>
  )
}
