import { useState } from 'react'
import AuthCard, { estilos, parametroHash } from '../components/AuthCard.jsx'
import { definirNuevaPassword, validarEnlace, validarPassword } from '../services/authService.js'

function errorDelEnlace(token) {
  try {
    validarEnlace(token)
    return ''
  } catch (err) {
    return err.message
  }
}

// US04 - Recuperación de contraseña (T16 pantalla de definición de nueva contraseña)
export default function NuevaPasswordPage() {
  const token = parametroHash('token') || ''
  const [errorEnlace, setErrorEnlace] = useState(() => errorDelEnlace(token))
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function enviar(ev) {
    ev.preventDefault()
    const errorPassword = validarPassword(password)
    if (errorPassword) return setError(errorPassword)
    if (password !== confirmacion) return setError('Las contraseñas no coinciden.')
    setError('')
    setCargando(true)
    try {
      await definirNuevaPassword(token, password)
      window.location.hash = 'login?cambio=ok'
    } catch (err) {
      // El enlace pudo vencer o usarse mientras la pantalla estaba abierta.
      setErrorEnlace(errorDelEnlace(token) || '')
      setError(err.message)
      setCargando(false)
    }
  }

  if (errorEnlace) {
    return (
      <AuthCard titulo="Enlace no disponible" pie={<a href="#login" style={estilos.enlace}>Volver a iniciar sesión</a>}>
        <div style={estilos.error} role="alert">{errorEnlace}</div>
        <a href="#recuperar" style={{ ...estilos.boton, display: 'block', textAlign: 'center', textDecoration: 'none' }}>
          Solicitar un nuevo enlace
        </a>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      titulo="Nueva contraseña"
      subtitulo="Usa al menos 8 caracteres, con letras y números."
      pie={<a href="#login" style={estilos.enlace}>Volver a iniciar sesión</a>}
    >
      {error && <div style={estilos.error} role="alert">{error}</div>}
      <form onSubmit={enviar} noValidate>
        <div style={estilos.campo}>
          <label htmlFor="nueva-password" style={estilos.etiqueta}>Nueva contraseña</label>
          <input
            id="nueva-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={estilos.input}
          />
        </div>
        <div style={estilos.campo}>
          <label htmlFor="confirmar-password" style={estilos.etiqueta}>Confirmar contraseña</label>
          <input
            id="confirmar-password"
            type="password"
            autoComplete="new-password"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            style={estilos.input}
          />
        </div>
        <button type="submit" style={{ ...estilos.boton, opacity: cargando ? 0.7 : 1 }} disabled={cargando}>
          {cargando ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </AuthCard>
  )
}
