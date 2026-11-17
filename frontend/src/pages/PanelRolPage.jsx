import { useEffect, useState } from 'react'
import AuthCard from '../components/AuthCard.jsx'
import Encabezado from '../components/Encabezado.jsx'
import Notificaciones from '../components/Notificaciones.jsx'
import RegistroUbicacion from '../components/RegistroUbicacion.jsx'
import MisPedidos from '../components/MisPedidos.jsx'
import Devoluciones from '../components/Devoluciones.jsx'
import NoticiasPanel from '../components/NoticiasPanel.jsx'
import PanelAdmin from './admin/PanelAdmin.jsx'
import { cerrarSesion, verificarSesion } from '../services/authService.js'

const PANELES = {
  cliente: 'Panel del cliente',
  emolientero: 'Panel del emolientero',
  admin: 'Panel del administrador',
}

// Íconos de línea (24×24) de los accesos rápidos.
const ICONOS = {
  mapa: 'M12 21s-6-5.33-6-10a6 6 0 1 1 12 0c0 4.67-6 10-6 10zM12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  bolsa: 'M6 7h12l-1 13H7zM9 7a3 3 0 0 1 6 0',
  corazon: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  codigo: 'M4 6h16v12H4zM8 10h2M8 14h8M14 10h2',
  reloj: 'M12 7v5l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  pin: 'M12 21s-6-5.33-6-10a6 6 0 1 1 12 0c0 4.67-6 10-6 10zM9.5 11h5',
  carta: 'M6 4h12v16H6zM9 8h6M9 12h6M9 16h3',
  estrella: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
}

const ACCESOS = {
  cliente: [
    { href: '#inicio', icono: 'mapa', titulo: 'Puestos cerca de ti', texto: 'Mira quién está atendiendo ahora.' },
    { href: '#mis-compras', icono: 'bolsa', titulo: 'Mis compras', texto: 'Tu historial y cuánto llevas gastado.' },
    { href: '#favoritos', icono: 'corazon', titulo: 'Favoritos', texto: 'Te avisamos cuando abren.' },
  ],
  emolientero: [
    { href: '#validar-recojo', icono: 'codigo', titulo: 'Entregar un pedido', texto: 'Escribe el código que te muestra el cliente.', destacado: true },
    { href: '#control-jornada', icono: 'reloj', titulo: 'Abrir o cerrar jornada', texto: 'Mientras esté abierta, apareces en el mapa.' },
    { href: '#mi-catalogo', icono: 'carta', titulo: 'Mi carta', texto: 'Productos, precios y lo que se agotó.' },
    { href: '#puntos-habituales', icono: 'pin', titulo: 'Mis puntos habituales', texto: 'Dónde sueles vender cada día.' },
    { href: '#mis-resenas', icono: 'estrella', titulo: 'Mis reseñas', texto: 'Lee y responde a tus clientes.' },
  ],
}

function Acceso({ href, icono, titulo, texto, destacado }) {
  return (
    <a href={href} className={`acceso ${destacado ? 'is-destacado' : ''}`}>
      <span className="acceso-icono" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d={ICONOS[icono]} />
        </svg>
      </span>
      <span>
        <strong>{titulo}</strong>
        <span>{texto}</span>
      </span>
    </a>
  )
}

// US03 - T12: destino de la redirección por rol.
export default function PanelRolPage({ rol }) {
  const [usuario, setUsuario] = useState(null)

  // El servidor confirma la sesión (firma del token, vigencia, cuenta activa) y su rol real.
  // Se repite al cambiar de rol: al pasar de #cliente a #admin React reutiliza este componente.
  useEffect(() => {
    let vigente = true
    setUsuario(null)
    verificarSesion().then((u) => {
      if (!vigente) return
      if (!u) window.location.hash = 'login'
      else if (u.rol !== rol) window.location.hash = u.rol
      else setUsuario(u)
    })
    return () => {
      vigente = false
    }
  }, [rol])

  if (!usuario) return <AuthCard titulo={PANELES[rol]} subtitulo="Verificando tu sesión…" />

  const salir = () => {
    cerrarSesion()
    window.location.hash = 'login'
  }

  // US23: el administrador tiene su propio panel (verificación de emolienteros).
  if (rol === 'admin') return <PanelAdmin usuario={usuario} onCerrarSesion={salir} />

  const nombre = usuario.nombre.split(' ')[0]
  const esEmolientero = rol === 'emolientero'

  return (
    <div style={{ minHeight: '100vh' }}>
      <Encabezado />
      <main className="panel">
        <div className="panel-saludo">
          <h1>Hola, {nombre}</h1>
          <p>{esEmolientero ? 'Esto es lo que necesitas para atender tu puesto hoy.' : '¿Qué se te antoja hoy?'}</p>
        </div>

        <div className="panel-grid">
          <div className="panel-columna">
            <div className="accesos">
              {ACCESOS[rol].map((a) => (
                <Acceso key={a.href} {...a} />
              ))}
            </div>

            {esEmolientero ? (
              <>
                <section className="panel-tarjeta">
                  <RegistroUbicacion />
                </section>
                <Devoluciones />
              </>
            ) : (
              <MisPedidos />
            )}
          </div>

          <div className="panel-columna">
            <Notificaciones />
            <section className="panel-tarjeta">
              <NoticiasPanel />
            </section>
            <p className="panel-cuenta">
              Conectado como {usuario.correo} ·{' '}
              <button type="button" onClick={salir}>
                Cerrar sesión
              </button>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
