import { useEffect, useState } from 'react'
import MainPage from './pages/MainPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegistroCliente from './pages/RegistroCliente.jsx'
import RegistroEmolientero from './pages/RegistroEmolientero.jsx'
import ControlJornada from './pages/ControlJornada.jsx'
import PuntosHabituales from './pages/PuntosHabituales.jsx'
import GestionCatalogo from './pages/GestionCatalogo.jsx'
import CatalogoEmolientero from './pages/CatalogoEmolientero.jsx'
import ValidarRecojo from './pages/ValidarRecojo.jsx'
import MapaCercanos from './pages/MapaCercanos.jsx'
import PagoYape from './pages/PagoYape.jsx'
import PagoOrden from './pages/PagoOrden.jsx'
import EmolienterosFavoritos from './pages/EmolienterosFavoritos.jsx'
import EmolienterosFavoritosDemo from './pages/EmolienterosFavoritosDemo.jsx'
import CompraAnticipada from './pages/CompraAnticipada.jsx'
import ResenasEmolientero from './pages/ResenasEmolientero.jsx'
import Moderacion from './pages/Moderacion.jsx'
import MisResenas from './pages/MisResenas.jsx'
import MisCompras from './pages/MisCompras.jsx'
import RecuperarPage from './pages/RecuperarPage.jsx'
import NuevaPasswordPage from './pages/NuevaPasswordPage.jsx'
import PanelRolPage from './pages/PanelRolPage.jsx'

// Las demostraciones con datos de ejemplo (US07, US14, US21) solo se abren con ?demo en la ruta.
const modoDemo = () => /[?&]demo\b/.test(window.location.hash)

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

  // US15: Validación del código de recojo (emolientero)
  if (ruta === 'validar-recojo') {
    return <ValidarRecojo key={window.location.hash || window.location.pathname} />
  }

  // US07: Mapa de emolienteros cercanos (Jorge Rodrigo Burga). Usa emolienteros de ejemplo, así que solo se
  // muestra en modo demostración (#mapa-cercanos?demo); si no, va a la portada, que muestra los reales.
  if (ruta === 'mapa-cercanos') {
    if (modoDemo()) return <MapaCercanos key={window.location.hash || window.location.pathname} />
    return <MainPage />
  }

  // US14: Pago con QR de Yape (Jorge Rodrigo Burga). Con ?orden=<id> paga una orden real de US13;
  // con ?demo muestra la demostración con una orden de ejemplo; si no, va a la portada.
  if (ruta === 'pago-yape') {
    const ordenId = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('orden')
    if (ordenId) return <PagoOrden key={window.location.hash} />
    if (modoDemo()) return <PagoYape key={window.location.hash || window.location.pathname} />
    return <MainPage />
  }

  // US21: Emolienteros favoritos y avisos de apertura de jornada (Jorge Rodrigo Burga)
  // Con ?demo se abre la demostración en memoria (simulador de aperturas); sin él, los favoritos reales.
  if (ruta === 'favoritos' || ruta === 'emolienteros-favoritos') {
    if (modoDemo()) return <EmolienterosFavoritosDemo key={window.location.hash} />
    return <EmolienterosFavoritos key={window.location.hash || window.location.pathname} />
  }

  // US25: Moderación de contenido (solo administrador) (Matías)
  if (ruta === 'moderacion') {
    return <Moderacion />
  }

  // US18: Reseñas y calificación de un emolientero (#resenas?id=<emolientero>) (Matías)
  if (ruta === 'resenas') {
    return <ResenasEmolientero key={window.location.hash} />
  }

  // US13: Compra anticipada: carrito y orden pendiente de pago (#comprar?id=<emolientero>) (Matías)
  if (ruta === 'comprar') {
    return <CompraAnticipada key={window.location.hash} />
  }

  // US19: Respuesta del emolientero a sus reseñas (Renzo)
  if (ruta === 'mis-resenas') {
    return <MisResenas />
  }

  // US20: Historial de compras del cliente (Fabio)
  if (ruta === 'mis-compras') {
    return <MisCompras key={window.location.hash || window.location.pathname} />
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
