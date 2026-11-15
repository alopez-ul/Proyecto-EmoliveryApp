import { useEffect, useRef, useState } from 'react'

// Íconos de línea (24x24) para cada opción del menú
const ICONOS = {
  inicio: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  'mapa-cercanos': 'M12 21s-6-5.33-6-10a6 6 0 1 1 12 0c0 4.67-6 10-6 10z M12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  'pago-yape': 'M4 7h16v10H4z M7 11h4 M15 13h2',
  favoritos: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  noticias: 'M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5M8 16h3',
  registro: 'M15 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 8v6M22 11h-6',
  login: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3',
}

const OPCIONES = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'mapa-cercanos', label: 'Mapa de Cercanos (US07)' },
  { id: 'pago-yape', label: 'Pago QR Yape (US14)' },
  { id: 'favoritos', label: 'Mis Favoritos (US21)' },
  { id: 'noticias', label: 'Noticias' },
  { id: 'registro', label: 'Registrarse' },
  { id: 'login', label: 'Iniciar Sesión' },
]

export default function MenuPrincipal() {
  const [abierto, setAbierto] = useState(false)
  const [activa, setActiva] = useState('inicio')
  const ref = useRef(null)

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    document.addEventListener('keydown', cerrar)
    return () => {
      document.removeEventListener('mousedown', cerrar)
      document.removeEventListener('keydown', cerrar)
    }
  }, [abierto])

  return (
    <div className="menu-principal" ref={ref}>
      <button
        className={`hamburguesa ${abierto ? 'is-open' : ''}`}
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls="menu-opciones"
        aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
      >
        <span />
        <span />
        <span />
      </button>

      <nav id="menu-opciones" className={`menu-opciones ${abierto ? 'is-open' : ''}`} aria-hidden={!abierto}>
        <ul>
          {OPCIONES.map((op) => (
            <li key={op.id}>
              <a
                href={`#${op.id}`}
                className={activa === op.id ? 'is-active' : ''}
                tabIndex={abierto ? 0 : -1}
                onClick={() => {
                  setActiva(op.id)
                  setAbierto(false)
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d={ICONOS[op.id]} />
                </svg>
                {op.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
