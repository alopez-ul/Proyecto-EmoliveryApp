import { useEffect, useState } from 'react'
import MainPage from './pages/MainPage.jsx'
import Login from './pages/Login.jsx'
import RegistroCliente from './pages/RegistroCliente.jsx'
import RegistroEmolientero from './pages/RegistroEmolientero.jsx'
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

  // Rutas del Sprint 1 (Módulo de Identidad y Autenticación)
  if (ruta === 'login') {
    return <Login key={window.location.hash || window.location.pathname} />
  }

  if (ruta === 'registro-cliente' || ruta === 'registro') {
    return <RegistroCliente key={window.location.hash || window.location.pathname} />
  }

  if (ruta === 'registro-emolientero') {
    return <RegistroEmolientero key={window.location.hash || window.location.pathname} />
  }

  // Rutas existentes de recuperación y paneles
  if (ruta === 'recuperar') return <RecuperarPage />
  if (ruta === 'nueva-password') return <NuevaPasswordPage key={window.location.hash} />
  if (['cliente', 'emolientero', 'admin'].includes(ruta)) return <PanelRolPage rol={ruta} />

  // Ruta principal (Mapa / Home)
  return <MainPage />
}
