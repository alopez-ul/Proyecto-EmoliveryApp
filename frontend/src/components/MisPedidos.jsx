// US15 - T68: el cliente ve el código de recojo de cada pedido para mostrárselo al emolientero.
import { useEffect, useState } from 'react'
import { misPedidos } from '../services/ordenesService.js'

const ESTADOS = { pendiente: 'Pendiente', en_camino: 'En camino', entregada: 'Entregado', cancelada: 'Cancelado' }

export default function MisPedidos() {
  const [pedidos, setPedidos] = useState(null)

  useEffect(() => {
    misPedidos()
      .then(setPedidos)
      .catch(() => setPedidos([]))
  }, [])

  if (!pedidos?.length) return null

  return (
    <div style={{ margin: '0 0 18px' }}>
      <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem' }}>Mis pedidos</h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pedidos.map((p) => {
          const porRecoger = p.estado === 'pendiente' || p.estado === 'en_camino'
          return (
            <li
              key={p.id}
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--borde)', background: 'var(--crema)', fontSize: '0.88rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong>Pedido #{p.id} · {p.emolientero}</strong>
                <span style={{ color: 'var(--cafe-medio)' }}>{ESTADOS[p.estado] ?? p.estado}</span>
              </div>
              {porRecoger && p.codigoRecojo && (
                <div style={{ marginTop: 6 }}>
                  Código de recojo:{' '}
                  <span style={{ fontFamily: 'monospace', fontSize: '1.15rem', fontWeight: 700, letterSpacing: '0.15em' }}>{p.codigoRecojo}</span>
                  <div style={{ fontSize: '0.78rem', color: 'var(--cafe-medio)' }}>Muéstralo al emolientero al recoger. Sirve una sola vez.</div>
                </div>
              )}
              {p.resenaHabilitada && (
                <div style={{ marginTop: 6, color: 'var(--hierba)', fontWeight: 600 }}>Entregado: ya puedes dejar tu reseña.</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
