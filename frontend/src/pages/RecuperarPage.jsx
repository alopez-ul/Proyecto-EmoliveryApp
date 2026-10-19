import { useState } from 'react'
import AuthCard, { estilos } from '../components/AuthCard.jsx'
import { forzarVencimiento, solicitarRecuperacion, VIGENCIA_ENLACE_MIN } from '../services/authService.js'

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// US04 - Recuperación de contraseña (T14 formulario de solicitud, T15 envío simulado del enlace)
export default function RecuperarPage() {
  const [correo, setCorreo] = useState('')
  const [errorCampo, setErrorCampo] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [buzon, setBuzon] = useState(null)
  const [vencido, setVencido] = useState(false)
  const [cargando, setCargando] = useState(false)

  async function enviar(ev) {
    ev.preventDefault()
    if (!correo.trim()) return setErrorCampo('Ingresa tu correo.')
    if (!CORREO_VALIDO.test(correo.trim())) return setErrorCampo('Ingresa un correo válido.')
    setErrorCampo('')
    setCargando(true)
    const resultado = await solicitarRecuperacion(correo)
    setBuzon(resultado)
    setVencido(false)
    setEnviado(true)
    setCargando(false)
  }

  return (
    <AuthCard
      titulo="Recuperar contraseña"
      subtitulo="Te enviaremos un enlace para definir una nueva contraseña."
      pie={<a href="#login" style={estilos.enlace}>Volver a iniciar sesión</a>}
    >
      {enviado && (
        // El mensaje es el mismo exista o no el correo, para no revelar qué cuentas están registradas.
        <div style={estilos.exito} role="status">
          Si el correo está registrado, recibirás un enlace válido por {VIGENCIA_ENLACE_MIN} minutos.
        </div>
      )}

      <form onSubmit={enviar} noValidate>
        <div style={estilos.campo}>
          <label htmlFor="correo-recuperacion" style={estilos.etiqueta}>Correo electrónico</label>
          <input
            id="correo-recuperacion"
            type="email"
            autoComplete="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            style={estilos.input}
            aria-invalid={!!errorCampo}
          />
          {errorCampo && <span style={estilos.errorCampo}>{errorCampo}</span>}
        </div>
        <button type="submit" style={{ ...estilos.boton, opacity: cargando ? 0.7 : 1 }} disabled={cargando}>
          {cargando ? 'Enviando…' : 'Enviar enlace'}
        </button>
      </form>

      {buzon && (
        <div
          style={{
            marginTop: 22,
            padding: 14,
            border: '1px dashed var(--borde-fuerte)',
            borderRadius: 12,
            background: 'var(--crema)',
            fontSize: '0.88rem',
          }}
        >
          <strong>Buzón simulado</strong> <span style={{ color: 'var(--cafe-suave)' }}>(solo para pruebas)</span>
          <p style={{ margin: '8px 0' }}>
            Para: {buzon.correo}
            <br />
            Enlace: <a href={buzon.enlace} style={estilos.enlace}>Definir nueva contraseña</a>
          </p>
          <button
            type="button"
            style={estilos.botonSecundario}
            disabled={vencido}
            onClick={() => {
              forzarVencimiento(buzon.token)
              setVencido(true)
            }}
          >
            {vencido ? 'Enlace vencido' : 'Simular vencimiento del enlace'}
          </button>
        </div>
      )}
    </AuthCard>
  )
}
