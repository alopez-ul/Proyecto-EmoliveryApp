// US22 - T98: noticias en el panel del usuario, de la más reciente a la más antigua.
import { useEffect, useState } from 'react'
import { formatearFecha, listarNoticias } from '../services/noticiasService.js'

export default function NoticiasPanel() {
  const [noticias, setNoticias] = useState(null)

  useEffect(() => {
    listarNoticias()
      .then(setNoticias)
      .catch(() => setNoticias([]))
  }, [])

  if (!noticias) return null

  return (
    <div style={{ margin: '0 0 18px' }}>
      <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem' }}>Noticias</h3>
      {noticias.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--cafe-medio)' }}>No hay noticias por ahora.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {noticias.map((n) => (
            <li key={n.id} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--borde)', background: 'var(--crema)' }}>
              <time dateTime={n.fechaPublicacion} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--caramelo)' }}>
                {formatearFecha(n.fechaPublicacion)}
              </time>
              <p style={{ margin: '2px 0 4px', fontWeight: 700, fontSize: '0.92rem' }}>{n.titulo}</p>
              <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--cafe-medio)', whiteSpace: 'pre-line' }}>{n.contenido}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
