import { useState } from 'react'
import { registrarCliente } from '../services/registroService.js'

export default function RegistroCliente() {
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    correo: '',
    password: '',
    confirmarPassword: '',
  })

  const [touched, setTouched] = useState({})
  const [errores, setErrores] = useState({})
  const [enviado, setEnviado] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState('')

  // Validaciones en tiempo real
  function validar(valores) {
    const errs = {}

    if (!valores.nombre.trim()) {
      errs.nombre = 'El nombre completo es obligatorio.'
    } else if (valores.nombre.trim().length < 3) {
      errs.nombre = 'Ingresa al menos 3 caracteres.'
    }

    if (!valores.telefono.trim()) {
      errs.telefono = 'El teléfono/celular es obligatorio.'
    } else if (!/^9\d{8}$/.test(valores.telefono.trim())) {
      errs.telefono = 'Debe ser un número válido de 9 dígitos que empiece con 9.'
    }

    if (!valores.correo.trim()) {
      errs.correo = 'El correo electrónico es obligatorio.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.correo.trim())) {
      errs.correo = 'Ingresa un formato de correo electrónico válido.'
    }

    if (!valores.password) {
      errs.password = 'La contraseña es obligatoria.'
    } else if (valores.password.length < 8) {
      errs.password = 'La contraseña debe tener al menos 8 caracteres.'
    } else if (!/[A-Za-z]/.test(valores.password) || !/\d/.test(valores.password)) {
      errs.password = 'Debe contener al menos una letra y un número.'
    }

    if (!valores.confirmarPassword) {
      errs.confirmarPassword = 'Confirma tu contraseña.'
    } else if (valores.password !== valores.confirmarPassword) {
      errs.confirmarPassword = 'Las contraseñas no coinciden.'
    }

    return errs
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    const nuevosValores = { ...formData, [name]: value }
    setFormData(nuevosValores)
    if (touched[name]) {
      setErrores(validar(nuevosValores))
    }
  }

  const handleBlur = (e) => {
    const { name } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrores(validar(formData))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorGeneral('')
    setTouched({
      nombre: true,
      telefono: true,
      correo: true,
      password: true,
      confirmarPassword: true,
    })
    const errs = validar(formData)
    setErrores(errs)

    if (Object.keys(errs).length === 0) {
      setCargando(true)
      try {
        // US01: crea la cuenta en la base de datos (Neon)
        await registrarCliente({
          nombre: formData.nombre,
          telefono: formData.telefono,
          correo: formData.correo,
          password: formData.password,
        })
        setEnviado(true)
        setTimeout(() => {
          window.location.hash = 'login'
        }, 2200)
      } catch (err) {
        // Errores del servidor por campo (p. ej. correo ya registrado) o un error general
        if (err.campos) setErrores((prev) => ({ ...prev, ...err.campos }))
        else setErrorGeneral(err.message)
      } finally {
        setCargando(false)
      }
    }
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
          href="#login"
          className="text-sm font-semibold text-[#b8581a] hover:text-[#9e4a14] transition-colors py-1.5 px-3 rounded-lg hover:bg-amber-50"
        >
          Iniciar sesión
        </a>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-lg bg-white rounded-3xl border border-[#ebe3d9] shadow-xl p-6 sm:p-8">
          {/* Badge & Title */}
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-[#b8581a] mb-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Perfil Cliente
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2b1a0f]">
              Crea tu cuenta de cliente
            </h1>
            <p className="text-sm text-[#6b5443] mt-1.5">
              Encuentra y pide tu emoliente tradicional favorito al instante.
            </p>
          </div>

          {/* Success Notification */}
          {enviado ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-6 text-center my-4 animate-in fade-in duration-300">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-bold text-lg text-emerald-900 mb-1">¡Registro completado con éxito!</h3>
              <p className="text-sm text-emerald-700">
                Bienvenido a Emolivery, <strong>{formData.nombre}</strong>. Redirigiendo al inicio de sesión...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Nombre Completo */}
              <div>
                <label htmlFor="nombre" className="block text-xs font-bold text-[#6b5443] uppercase tracking-wider mb-1.5">
                  Nombre completo <span className="text-red-500">*</span>
                </label>
                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  placeholder="Ej. Juan Pérez Quispe"
                  value={formData.nombre}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-4 py-2.5 rounded-xl border bg-[#fbf6ef] text-[#2b1a0f] placeholder:text-[#9a8676] text-sm focus:outline-none focus:ring-2 transition-all ${
                    touched.nombre && errores.nombre
                      ? 'border-red-400 focus:ring-red-200 bg-red-50/30'
                      : 'border-[#ddd2c4] focus:ring-amber-200 focus:border-[#b8581a]'
                  }`}
                />
                {touched.nombre && errores.nombre && (
                  <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                    <span>⚠</span> {errores.nombre}
                  </p>
                )}
              </div>

              {/* Grid: Teléfono & Correo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Teléfono / Celular */}
                <div>
                  <label htmlFor="telefono" className="block text-xs font-bold text-[#6b5443] uppercase tracking-wider mb-1.5">
                    Celular (9 dígitos) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="telefono"
                    name="telefono"
                    type="tel"
                    maxLength={9}
                    placeholder="987654321"
                    value={formData.telefono}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`w-full px-4 py-2.5 rounded-xl border bg-[#fbf6ef] text-[#2b1a0f] placeholder:text-[#9a8676] text-sm focus:outline-none focus:ring-2 transition-all ${
                      touched.telefono && errores.telefono
                        ? 'border-red-400 focus:ring-red-200 bg-red-50/30'
                        : 'border-[#ddd2c4] focus:ring-amber-200 focus:border-[#b8581a]'
                    }`}
                  />
                  {touched.telefono && errores.telefono && (
                    <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                      <span>⚠</span> {errores.telefono}
                    </p>
                  )}
                </div>

                {/* Correo Electrónico */}
                <div>
                  <label htmlFor="correo" className="block text-xs font-bold text-[#6b5443] uppercase tracking-wider mb-1.5">
                    Correo electrónico <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="correo"
                    name="correo"
                    type="email"
                    placeholder="juan@ejemplo.com"
                    value={formData.correo}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`w-full px-4 py-2.5 rounded-xl border bg-[#fbf6ef] text-[#2b1a0f] placeholder:text-[#9a8676] text-sm focus:outline-none focus:ring-2 transition-all ${
                      touched.correo && errores.correo
                        ? 'border-red-400 focus:ring-red-200 bg-red-50/30'
                        : 'border-[#ddd2c4] focus:ring-amber-200 focus:border-[#b8581a]'
                    }`}
                  />
                  {touched.correo && errores.correo && (
                    <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                      <span>⚠</span> {errores.correo}
                    </p>
                  )}
                </div>
              </div>

              {/* Contraseña */}
              <div>
                <label htmlFor="password" className="block text-xs font-bold text-[#6b5443] uppercase tracking-wider mb-1.5">
                  Contraseña (mínimo 8 caracteres) <span className="text-red-500">*</span>
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-4 py-2.5 rounded-xl border bg-[#fbf6ef] text-[#2b1a0f] placeholder:text-[#9a8676] text-sm focus:outline-none focus:ring-2 transition-all ${
                    touched.password && errores.password
                      ? 'border-red-400 focus:ring-red-200 bg-red-50/30'
                      : 'border-[#ddd2c4] focus:ring-amber-200 focus:border-[#b8581a]'
                  }`}
                />
                {touched.password && errores.password && (
                  <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                    <span>⚠</span> {errores.password}
                  </p>
                )}
              </div>

              {/* Confirmar Contraseña */}
              <div>
                <label htmlFor="confirmarPassword" className="block text-xs font-bold text-[#6b5443] uppercase tracking-wider mb-1.5">
                  Confirmar contraseña <span className="text-red-500">*</span>
                </label>
                <input
                  id="confirmarPassword"
                  name="confirmarPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmarPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-4 py-2.5 rounded-xl border bg-[#fbf6ef] text-[#2b1a0f] placeholder:text-[#9a8676] text-sm focus:outline-none focus:ring-2 transition-all ${
                    touched.confirmarPassword && errores.confirmarPassword
                      ? 'border-red-400 focus:ring-red-200 bg-red-50/30'
                      : 'border-[#ddd2c4] focus:ring-amber-200 focus:border-[#b8581a]'
                  }`}
                />
                {touched.confirmarPassword && errores.confirmarPassword && (
                  <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                    <span>⚠</span> {errores.confirmarPassword}
                  </p>
                )}
              </div>

              {errorGeneral && (
                <p role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
                  {errorGeneral}
                </p>
              )}

              {/* Botón Submit */}
              <button
                type="submit"
                disabled={cargando}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#b8581a] to-[#9e4a14] hover:from-[#a04b14] hover:to-[#873e0e] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all transform active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {cargando ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Creando tu cuenta...</span>
                  </>
                ) : (
                  <span>Registrarme como cliente</span>
                )}
              </button>
            </form>
          )}

          {/* Enlaces de pie */}
          <div className="mt-8 pt-6 border-t border-[#ebe3d9] text-center space-y-3">
            <p className="text-sm text-[#6b5443]">
              ¿Ya tienes una cuenta registrada?{' '}
              <a href="#login" className="font-bold text-[#b8581a] hover:underline">
                Inicia sesión aquí
              </a>
            </p>

            <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/70 text-xs text-[#6b5443]">
              ¿Tienes un puesto tradicional de emoliente?{' '}
              <a href="#registro-emolientero" className="font-bold text-[#b8581a] hover:underline block sm:inline mt-1 sm:mt-0">
                Regístrate como Emolientero Autorizado →
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
