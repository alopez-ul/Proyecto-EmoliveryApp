// Encabezado común de todas las pantallas: logo, accesos según el rol y la sesión del usuario.
import { useEffect, useState } from 'react'
import EmolienteIcon from './EmolienteIcon.jsx'
import { cerrarSesion, verificarSesion } from '../services/authService.js'

// Una sola consulta de sesión por token, aunque varias partes de la pantalla la pidan.
let cache = { token: undefined, promesa: null }
export function usuarioDeLaSesion() {
  let token = null
  try {
    token = sessionStorage.getItem('emolivery.sesion')
  } catch {
    // Sin almacenamiento: se trata como visitante.
  }
  if (!token) return Promise.resolve(null)
  if (cache.token !== token) cache = { token, promesa: verificarSesion() }
  return cache.promesa
}

const ENLACES = {
  visitante: [
    { href: '#inicio', texto: 'Cerca de ti' },
    { href: '#registro-emolientero', texto: 'Registra tu puesto' },
  ],
  cliente: [
    { href: '#inicio', texto: 'Cerca de ti' },
    { href: '#mis-compras', texto: 'Mis compras' },
    { href: '#favoritos', texto: 'Favoritos' },
  ],
  emolientero: [
    { href: '#emolientero', texto: 'Mi puesto' },
    { href: '#validar-recojo', texto: 'Entregar pedido' },
    { href: '#mi-catalogo', texto: 'Mi carta' },
  ],
  admin: [
    { href: '#admin', texto: 'Administración' },
    { href: '#moderacion', texto: 'Moderación' },
  ],
}

const rutaActual = () => '#' + (window.location.hash.replace(/^#\/?/, '').split('?')[0] || 'inicio')

function Icono({ d }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

// volver: { href, texto } opcional, para las pantallas internas ("← Mi puesto").
export default function Encabezado({ volver }) {
  const [usuario, setUsuario] = useState(undefined) // undefined: cargando; null: visitante
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    let vigente = true
    usuarioDeLaSesion().then((u) => vigente && setUsuario(u ?? null))
    return () => {
      vigente = false
    }
  }, [])

  const salir = () => {
    cerrarSesion()
    cache = { token: undefined, promesa: null }
    window.location.hash = 'inicio'
    window.location.reload()
  }

  const enlaces = ENLACES[usuario?.rol ?? 'visitante']
  const actual = rutaActual()
  // El "← volver" sobra si ese destino ya está en el menú (p. ej. "Mi puesto").
  if (volver && enlaces.some((e) => e.href === volver.href)) volver = null
  const primerNombre = usuario?.nombre?.split(' ')[0]

  return (
    <header className="ui-encabezado">
      <div className="ui-encabezado-interior">
        <a href="#inicio" className="ui-logo" aria-label="Emolivery, inicio">
          <EmolienteIcon size={34} />
          <span>Emolivery</span>
        </a>

        <nav className="ui-nav" aria-label="Principal">
          {volver && (
            <a href={volver.href} className="ui-volver" style={{ marginRight: 8 }}>
              ← {volver.texto}
            </a>
          )}
          {usuario !== undefined &&
            enlaces.map((e) => (
              <a key={e.href} href={e.href} aria-current={actual === e.href ? 'page' : undefined}>
                {e.texto}
              </a>
            ))}
        </nav>

        <div className="ui-acciones">
          {usuario === null && (
            <>
              <a href="#login" className="ui-boton ui-boton-texto ui-ocultar-movil">
                Ingresar
              </a>
              <a href="#registro-cliente" className="ui-boton ui-boton-primario ui-ocultar-movil">
                Crear cuenta
              </a>
            </>
          )}
          {usuario && (
            <>
              <a href={`#${usuario.rol}`} className="ui-usuario ui-ocultar-movil" title="Ir a mi panel">
                <span className="ui-avatar" aria-hidden="true">{primerNombre?.[0]?.toUpperCase()}</span>
                {primerNombre}
              </a>
              <button type="button" className="ui-boton ui-boton-texto ui-ocultar-movil" onClick={salir}>
                Salir
              </button>
            </>
          )}
          <button
            type="button"
            className="ui-menu-movil"
            aria-expanded={abierto}
            aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setAbierto((v) => !v)}
          >
            <Icono d={abierto ? 'M6 6l12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h16'} />
          </button>
        </div>
      </div>

      {abierto && (
        <nav className="ui-desplegable" aria-label="Menú">
          {volver && <a href={volver.href}>← {volver.texto}</a>}
          {enlaces.map((e) => (
            <a key={e.href} href={e.href} onClick={() => setAbierto(false)}>
              {e.texto}
            </a>
          ))}
          {usuario ? (
            <>
              <a href={`#${usuario.rol}`}>Mi panel ({primerNombre})</a>
              <button type="button" onClick={salir}>Salir</button>
            </>
          ) : (
            <>
              <a href="#login">Ingresar</a>
              <a href="#registro-cliente">Crear cuenta</a>
            </>
          )}
        </nav>
      )}
    </header>
  )
}
