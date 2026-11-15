// US16 - T74: el emolientero ve las devoluciones que debe hacer por pedidos cancelados y las marca al pagarlas.
import { useCallback, useEffect, useState } from 'react'
import { marcarDevolucionRealizada, misDevoluciones } from '../services/ordenesService.js'

const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })
const fecha = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' })

export default function Devoluciones() {
  const [devoluciones, setDevoluciones] = useState(null)
  const [error, setError] = useState('')
  const [marcando, setMarcando] = useState(null)

  const cargar = useCallback(() => {
    misDevoluciones()
      .then(setDevoluciones)
      .catch(() => setDevoluciones([]))
  }, [])

  useEffect(cargar, [cargar])

  async function marcar(id) {
    setMarcando(id)
    setError('')
    try {
      await marcarDevolucionRealizada(id)
    } catch (err) {
      setError(err.message)
    } finally {
      setMarcando(null)
      cargar()
    }
  }

  if (!devoluciones?.length) return null
  const pendientes = devoluciones.filter((d) => d.estado === 'pendiente').length

  return (
    <div style={{ margin: '0 0 18px' }}>
      <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem' }}>
        Devoluciones {pendientes > 0 && <span style={{ color: '#b42318' }}>({pendientes} pendiente{pendientes > 1 ? 's' : ''})</span>}
      </h3>
      {error && (
        <div role="alert" style={{ margin: '0 0 8px', fontSize: '0.84rem', color: '#b42318', fontWeight: 600 }}>
          {error}
        </div>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {devoluciones.map((d) => (
          <li
            key={d.id}
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--borde)', background: 'var(--crema)', fontSize: '0.88rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong>
                {soles.format(d.monto)} a {d.cliente}
              </strong>
              <span style={{ color: d.estado === 'pendiente' ? '#b42318' : 'var(--hierba)', fontWeight: 600 }}>
                {d.estado === 'pendiente' ? 'Por devolver' : 'Devuelta'}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--cafe-medio)', marginTop: 4 }}>
              Pedido #{d.ordenId} cancelado el {fecha.format(new Date(d.solicitadaEn))}
              {d.clienteTelefono && ` · Yape al ${d.clienteTelefono}`}
            </div>
            {d.estado === 'pendiente' && (
              <button
                type="button"
                onClick={() => marcar(d.id)}
                disabled={marcando === d.id}
                style={{
                  marginTop: 8,
                  font: 'inherit',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--hierba)',
                  background: 'var(--hierba)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {marcando === d.id ? 'Guardando…' : 'Ya la devolví'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
