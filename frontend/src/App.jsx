import { useEffect, useState } from 'react'
import MainPage from './pages/MainPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegistroCliente from './pages/RegistroCliente.jsx'
import RegistroEmolientero from './pages/RegistroEmolientero.jsx'
import ControlJornada from './pages/ControlJornada.jsx'
import PuntosHabituales from './pages/PuntosHabituales.jsx'
import GestionCatalogo from './pages/GestionCatalogo.jsx'
import CatalogoEmolientero from './pages/CatalogoEmolientero.jsx'
import CompraAnticipada from './pages/CompraAnticipada.jsx'
import RecuperarPage from './pages/RecuperarPage.jsx'
import NuevaPasswordPage from './pages/NuevaPasswordPage.jsx'
import PanelRolPage from './pages/PanelRolPage.jsx'

// Soporta enrutamiento por hash (#/registro-cliente o #registro-cliente) y por pathname (/registro-cliente)
const obtenerRutaActual = () => {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  if (hash) return hash

  const path = window.location.pathname.replace(/^\//, '').split('?')[0]
  return path || ''
}

export default function App() {
  const [ruta, setRuta] = useState(obtenerRutaActual)

  useEffect(() => {
    const sincronizarRuta = () => setRuta(obtenerRutaActual())
    window.addEventListener('hashchange', sincronizarRuta)
    window.addEventListener('popstate', sincronizarRuta)
    return () => {
      window.removeEventListener('hashchange', sincronizarRuta)
      window.removeEventListener('popstate', sincronizarRuta)
    }
  }, [])

  // Rutas del Sprint 1 - Responsabilidades exclusivas de Jorge Burga
  // US01: Registro de cliente
  if (ruta === 'registro-cliente' || ruta === 'registro') {
    return <RegistroCliente key={window.location.hash || window.location.pathname} />
  }

  // US02: Registro de emolientero (Renzo)
  if (ruta === 'registro-emolientero') {
    return <RegistroEmolientero key={window.location.hash || window.location.pathname} />
  }

  // US06: Apertura y Cierre de Jornada
  if (ruta === 'control-jornada') {
    return <ControlJornada key={window.location.hash || window.location.pathname} />
  }

  // US10: Puntos habituales del emolientero
  if (ruta === 'puntos-habituales') {
    return <PuntosHabituales key={window.location.hash || window.location.pathname} />
  }

  // US11: Gestión de catálogo (Matías)
  if (ruta === 'mi-catalogo') {
    return <GestionCatalogo key={window.location.hash || window.location.pathname} />
  }

  // US12: Catálogo público de un emolientero (#catalogo?id=<emolientero>) (Renzo)
  if (ruta === 'catalogo') {
    return <CatalogoEmolientero key={window.location.hash} />
  }

  // US13: Compra anticipada: carrito y orden pendiente de pago (#comprar?id=<emolientero>) (Matías)
  if (ruta === 'comprar') {
    return <CompraAnticipada key={window.location.hash} />
  }

  // Rutas del equipo (US03 / US04 - Matías)
  if (ruta === 'login') {
    return <LoginPage key={window.location.hash} />
  }

  // Rutas existentes de recuperación y paneles
  if (ruta === 'recuperar') return <RecuperarPage />
  if (ruta === 'nueva-password') return <NuevaPasswordPage key={window.location.hash} />
  if (['cliente', 'emolientero', 'admin'].includes(ruta)) return <PanelRolPage rol={ruta} />

  // Ruta principal (Mapa / Home)
  return <MainPage />
}
