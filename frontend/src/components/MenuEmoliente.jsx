import { useEffect, useRef, useState } from 'react'
import EmolienteIcon from './EmolienteIcon.jsx'

const OPCIONES = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'noticias', label: 'Noticias' },
  { id: 'registro', label: 'Registrarse' },
  { id: 'login', label: 'Iniciar Sesión' },
]

export default function MenuEmoliente() {
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
    <div className="menu-emoliente" ref={ref}>
      <button
        className={`menu-toggle ${abierto ? 'is-open' : ''}`}
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls="menu-principal"
        aria-label="Abrir menú"
      >
        <EmolienteIcon size={44} />
      </button>

      <nav id="menu-principal" className={`menu-bar ${abierto ? 'is-open' : ''}`} aria-hidden={!abierto}>
        <ul>
          {OPCIONES.map((op) => (
            <li key={op.id}>
              <a
                href={`#${op.id}`}
                className={`${activa === op.id ? 'is-active' : ''} ${op.id === 'registro' ? 'is-cta' : ''}`}
                tabIndex={abierto ? 0 : -1}
                onClick={() => {
                  setActiva(op.id)
                  setAbierto(false)
                }}
              >
                {op.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
