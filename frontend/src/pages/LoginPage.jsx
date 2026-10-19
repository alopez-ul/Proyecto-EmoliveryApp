import { useState } from 'react'
import AuthCard, { estilos, parametroHash } from '../components/AuthCard.jsx'
import { iniciarSesion } from '../services/authService.js'

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// US03 - Inicio de sesión (T10 formulario, T12 redirección según el rol)
export default function LoginPage() {
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const passwordCambiada = parametroHash('cambio') === 'ok'

  function validar() {
    const e = {}
    if (!correo.trim()) e.correo = 'Ingresa tu correo.'
    else if (!CORREO_VALIDO.test(correo.trim())) e.correo = 'Ingresa un correo válido.'
    if (!password) e.password = 'Ingresa tu contraseña.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function enviar(ev) {
    ev.preventDefault()
    setError('')
    if (!validar()) return
    setCargando(true)
    try {
      const usuario = await iniciarSesion(correo, password)
      window.location.hash = usuario.rol
    } catch (err) {
      setError(err.message)
      setCargando(false)
    }
  }

  return (
    <AuthCard
      titulo="Iniciar sesión"
      subtitulo="Ingresa con tu cuenta de Emolivery."
      pie={<a href="#inicio" style={estilos.enlace}>Volver al mapa</a>}
    >
      {passwordCambiada && !error && (
        <div style={estilos.exito} role="status">Tu contraseña se actualizó. Ya puedes iniciar sesión.</div>
      )}
      {error && <div style={estilos.error} role="alert">{error}</div>}

      <form onSubmit={enviar} noValidate>
        <div style={estilos.campo}>
          <label htmlFor="correo" style={estilos.etiqueta}>Correo electrónico</label>
          <input
            id="correo"
            type="email"
            autoComplete="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            style={estilos.input}
            aria-invalid={!!errores.correo}
          />
          {errores.correo && <span style={estilos.errorCampo}>{errores.correo}</span>}
        </div>

        <div style={estilos.campo}>
          <label htmlFor="password" style={estilos.etiqueta}>Contraseña</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={estilos.input}
            aria-invalid={!!errores.password}
          />
          {errores.password && <span style={estilos.errorCampo}>{errores.password}</span>}
        </div>

        <div style={{ textAlign: 'right', marginBottom: 8, fontSize: '0.88rem' }}>
          <a href="#recuperar" style={estilos.enlace}>¿Olvidaste tu contraseña?</a>
        </div>

        <button type="submit" style={{ ...estilos.boton, opacity: cargando ? 0.7 : 1 }} disabled={cargando}>
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </AuthCard>
  )
}
