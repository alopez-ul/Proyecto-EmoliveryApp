import { useEffect, useRef, useState } from 'react'

// Íconos de línea (24x24) para cada opción del menú
const ICONOS = {
  inicio: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  noticias: 'M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5M8 16h3',
  registro: 'M15 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 8v6M22 11h-6',
  login: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3',
}

const OPCIONES = [
  { id: 'inicio', label: 'Inicio' },
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
