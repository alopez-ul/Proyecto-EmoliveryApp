// US23 - T31: notificaciones del usuario (p. ej. el resultado de la verificación del emolientero).
import { useEffect, useState } from 'react'
import { listarNotificaciones, marcarLeida } from '../services/notificacionesService.js'

const formatoFecha = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' })

export default function Notificaciones() {
  const [lista, setLista] = useState(null)

  useEffect(() => {
    listarNotificaciones()
      .then(setLista)
      .catch(() => setLista([]))
  }, [])

  if (!lista?.length) return null

  async function leer(n) {
    if (n.leida) return
    setLista((l) => l.map((x) => (x.id === n.id ? { ...x, leida: true } : x)))
    await marcarLeida(n.id).catch(() => {})
  }

  return (
    <div style={{ margin: '0 0 18px' }}>
      <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem' }}>Notificaciones</h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lista.map((n) => (
          <li
            key={n.id}
            onClick={() => leer(n)}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--borde)',
              background: n.leida ? 'var(--superficie)' : 'var(--ambar-suave)',
              cursor: n.leida ? 'default' : 'pointer',
            }}
          >
            <strong style={{ display: 'block', fontSize: '0.9rem' }}>{n.titulo}</strong>
            <span style={{ display: 'block', fontSize: '0.86rem', color: 'var(--cafe-medio)' }}>{n.mensaje}</span>
            <span style={{ display: 'block', marginTop: 4, fontSize: '0.75rem', color: 'var(--cafe-suave)' }}>
              {formatoFecha.format(new Date(n.creadoEn))}
              {!n.leida && ' · Nueva'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
