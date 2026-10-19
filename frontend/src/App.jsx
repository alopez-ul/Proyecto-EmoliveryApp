import { useEffect, useState } from 'react'
import MainPage from './pages/MainPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RecuperarPage from './pages/RecuperarPage.jsx'
import NuevaPasswordPage from './pages/NuevaPasswordPage.jsx'
import PanelRolPage from './pages/PanelRolPage.jsx'

// Enrutado mínimo por hash (#login, #recuperar…). Cualquier otra ruta muestra la MainPage.
const rutaActual = () => window.location.hash.slice(1).split('?')[0]

export default function App() {
  const [ruta, setRuta] = useState(rutaActual)

  useEffect(() => {
    const actualizar = () => setRuta(rutaActual())
    window.addEventListener('hashchange', actualizar)
    return () => window.removeEventListener('hashchange', actualizar)
  }, [])

  if (ruta === 'login') return <LoginPage key={window.location.hash} />
  if (ruta === 'recuperar') return <RecuperarPage />
  if (ruta === 'nueva-password') return <NuevaPasswordPage key={window.location.hash} />
  if (['cliente', 'emolientero', 'admin'].includes(ruta)) return <PanelRolPage rol={ruta} />
  return <MainPage />
}
