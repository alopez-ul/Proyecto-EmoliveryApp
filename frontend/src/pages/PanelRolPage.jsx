import { useEffect } from 'react'
import AuthCard, { estilos } from '../components/AuthCard.jsx'
import { cerrarSesion, usuarioActual } from '../services/authService.js'

const PANELES = {
  cliente: 'Panel del cliente',
  emolientero: 'Panel del emolientero',
  admin: 'Panel del administrador',
}

// US03 - T12: destino de la redirección por rol.
// Es un panel de prueba; el contenido real de cada panel corresponde a otras historias.
export default function PanelRolPage({ rol }) {
  const usuario = usuarioActual()
  const destino = !usuario ? 'login' : usuario.rol !== rol ? usuario.rol : null

  useEffect(() => {
    if (destino) window.location.hash = destino
  }, [destino])

  if (destino) return null

  return (
    <AuthCard titulo={PANELES[rol]} subtitulo={`Hola, ${usuario.nombre}.`}>
      <p style={{ margin: '0 0 18px', color: 'var(--cafe-medio)', fontSize: '0.92rem' }}>
        Iniciaste sesión como <strong>{rol}</strong> ({usuario.correo}).
      </p>
      <button
        type="button"
        style={estilos.boton}
        onClick={() => {
          cerrarSesion()
          window.location.hash = 'login'
        }}
      >
        Cerrar sesión
      </button>
    </AuthCard>
  )
}
