import { useEffect, useState } from 'react'
import AuthCard, { estilos } from '../components/AuthCard.jsx'
import Notificaciones from '../components/Notificaciones.jsx'
import PanelAdmin from './admin/PanelAdmin.jsx'
import { cerrarSesion, verificarSesion } from '../services/authService.js'

const PANELES = {
  cliente: 'Panel del cliente',
  emolientero: 'Panel del emolientero',
  admin: 'Panel del administrador',
}

// US03 - T12: destino de la redirección por rol.
// Es un panel de prueba; el contenido real de cada panel corresponde a otras historias.
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

  return (
    <AuthCard titulo={PANELES[rol]} subtitulo={`Hola, ${usuario.nombre}.`}>
      <p style={{ margin: '0 0 18px', color: 'var(--cafe-medio)', fontSize: '0.92rem' }}>
        Iniciaste sesión como <strong>{rol}</strong> ({usuario.correo}).
      </p>
      <Notificaciones />
      <button
        type="button"
        style={estilos.boton}
        onClick={salir}
      >
        Cerrar sesión
      </button>
    </AuthCard>
  )
}
