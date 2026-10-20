import { useState } from 'react'

export default function Login() {
  const [rolSeleccionado, setRolSeleccionado] = useState('cliente')
  const [correo, setCorreo] = useState('cliente@emolivery.pe')
  const [password, setPassword] = useState('Cliente123')
  const [errores, setErrores] = useState({})
  const [cargando, setCargando] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')

  // Roles preconfigurados para simulación del Sprint 1
  const ROLES_DEMO = {
    cliente: {
      nombre: 'Cliente',
      correo: 'cliente@emolivery.pe',
      password: 'Cliente123',
      color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      icono: '👤',
      destino: 'cliente',
    },
    emolientero: {
      nombre: 'Emolientero',
      correo: 'emolientero@emolivery.pe',
      password: 'Emoliente123',
      color: 'bg-amber-100 text-amber-900 border-amber-300',
      icono: '🍵',
      destino: 'emolientero',
    },
    admin: {
      nombre: 'Administrador',
      correo: 'admin@emolivery.pe',
      password: 'Admin123',
      color: 'bg-stone-100 text-stone-900 border-stone-300',
      icono: '⚙️',
      destino: 'admin',
    },
  }

  const cambiarRol = (nuevoRol) => {
    setRolSeleccionado(nuevoRol)
    setCorreo(ROLES_DEMO[nuevoRol].correo)
    setPassword(ROLES_DEMO[nuevoRol].password)
    setErrores({})
    setMensajeExito('')
  }

  function validar() {
    const errs = {}
    if (!correo.trim()) {
      errs.correo = 'Ingresa tu correo electrónico.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
      errs.correo = 'Ingresa un correo electrónico válido.'
    }

    if (!password) {
      errs.password = 'Ingresa tu contraseña.'
    } else if (password.length < 6) {
      errs.password = 'La contraseña debe tener al menos 6 caracteres.'
    }

    setErrores(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validar()) return

    setCargando(true)
    setMensajeExito('')

    // Simulación de autenticación (Sprint 1 Frontend Mockup)
    setTimeout(() => {
      setCargando(false)
      const rolActual = ROLES_DEMO[rolSeleccionado]
      setMensajeExito(`¡Bienvenido! Sesión iniciada con éxito como ${rolActual.nombre}. Redirigiendo...`)
      
      setTimeout(() => {
        // Redirección al panel o vista correspondiente
        window.location.hash = rolActual.destino
      }, 1200)
    }, 700)
  }

  return (
    <div className="min-h-screen bg-[#f7f3ee] text-[#2b1a0f] flex flex-col justify-between">
      {/* Header */}
      <header className="bg-white border-b border-[#ebe3d9] py-4 px-6 flex items-center justify-between shadow-xs sticky top-0 z-20">
        <a href="#inicio" className="flex items-center gap-2 text-decoration-none group">
          <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#b8581a] to-[#e67e22] flex items-center justify-center text-white font-bold text-lg shadow-sm">
            E
          </span>
          <span className="font-extrabold text-2xl tracking-tight text-[#2b1a0f]">
            Emolivery<span className="text-[#b8581a]">.</span>
          </span>
        </a>
        <a
          href="#inicio"
          className="text-sm font-semibold text-[#6b5443] hover:text-[#2b1a0f] transition-colors py-1.5 px-3 rounded-lg hover:bg-[#fbf6ef]"
        >
          ← Volver al mapa
        </a>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md bg-white rounded-3xl border border-[#ebe3d9] shadow-xl p-6 sm:p-8">
          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2b1a0f]">
              Iniciar Sesión
            </h1>
            <p className="text-sm text-[#6b5443] mt-1.5">
              Ingresa con tus credenciales o prueba los roles de demostración.
            </p>
          </div>

          {/* Selector de Rol Simulado (Sprint 1) */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-[#6b5443] uppercase tracking-wider mb-2 text-center">
              Selecciona un Rol de Simulación:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(ROLES_DEMO).map(([key, info]) => {
                const activo = rolSeleccionado === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => cambiarRol(key)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all border flex flex-col items-center gap-1 ${
                      activo
                        ? 'bg-[#b8581a] text-white border-[#b8581a] shadow-sm scale-102'
                        : 'bg-[#fbf6ef] text-[#6b5443] border-[#ddd2c4] hover:border-[#b8581a]'
                    }`}
                  >
                    <span className="text-base">{info.icono}</span>
                    <span>{info.nombre}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Mensaje de Éxito / Redirección */}
          {mensajeExito && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium flex items-center gap-2 animate-in fade-in">
              <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <span>{mensajeExito}</span>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="correo" className="block text-xs font-bold text-[#6b5443] uppercase tracking-wider mb-1.5">
                Correo electrónico
              </label>
              <input
                id="correo"
                type="email"
                autoComplete="email"
                placeholder="ejemplo@emolivery.pe"
                value={correo}
                onChange={(e) => {
                  setCorreo(e.target.value)
                  if (errores.correo) setErrores((prev) => ({ ...prev, correo: null }))
                }}
                className={`w-full px-4 py-2.5 rounded-xl border bg-[#fbf6ef] text-[#2b1a0f] placeholder:text-[#9a8676] text-sm focus:outline-none focus:ring-2 transition-all ${
                  errores.correo
                    ? 'border-red-400 focus:ring-red-200 bg-red-50/30'
                    : 'border-[#ddd2c4] focus:ring-amber-200 focus:border-[#b8581a]'
                }`}
              />
              {errores.correo && (
                <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                  <span>⚠</span> {errores.correo}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-xs font-bold text-[#6b5443] uppercase tracking-wider">
                  Contraseña
                </label>
                <a href="#recuperar" className="text-xs text-[#b8581a] hover:underline font-semibold">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (errores.password) setErrores((prev) => ({ ...prev, password: null }))
                }}
                className={`w-full px-4 py-2.5 rounded-xl border bg-[#fbf6ef] text-[#2b1a0f] placeholder:text-[#9a8676] text-sm focus:outline-none focus:ring-2 transition-all ${
                  errores.password
                    ? 'border-red-400 focus:ring-red-200 bg-red-50/30'
                    : 'border-[#ddd2c4] focus:ring-amber-200 focus:border-[#b8581a]'
                }`}
              />
              {errores.password && (
                <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                  <span>⚠</span> {errores.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#b8581a] to-[#9e4a14] hover:from-[#a04b14] hover:to-[#873e0e] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all transform active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {cargando ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                <span>Ingresar como {ROLES_DEMO[rolSeleccionado].nombre}</span>
              )}
            </button>
          </form>

          {/* Opciones de Registro */}
          <div className="mt-8 pt-6 border-t border-[#ebe3d9] space-y-3 text-center">
            <p className="text-xs text-[#6b5443] uppercase tracking-wider font-bold">
              ¿Todavía no tienes cuenta?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <a
                href="#registro-cliente"
                className="py-2.5 px-3 rounded-xl border border-[#b8581a] text-[#b8581a] hover:bg-amber-50 font-bold text-xs transition-colors text-center"
              >
                Registrarme como Cliente
              </a>
              <a
                href="#registro-emolientero"
                className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-colors text-center shadow-xs"
              >
                Soy Emolientero
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-[#9a8676]">
        EMOLIVERY &copy; {new Date().getFullYear()} - Plataforma de Emolientes Tradicionales de Lima
      </footer>
    </div>
  )
}
