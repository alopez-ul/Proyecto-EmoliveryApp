import { useState } from 'react'
import { registrarCliente } from '../services/registroService.js'
import Encabezado from '../components/Encabezado.jsx'

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
    <div className="min-h-screen bg-[#f8f3e8] text-[#2b2118] flex flex-col justify-between">
      {/* Header */}
      <Encabezado />

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md bg-white rounded-2xl border border-[#ece4d4] p-7 sm:p-10">
          {/* Título */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#2b2118]">
              Crea tu cuenta de cliente
            </h1>
            <p className="text-sm text-[#6b4a2f] mt-1.5">
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
                <label htmlFor="nombre" className="block text-sm font-semibold text-[#2b2118] mb-1.5">
                  Nombre completo
                </label>
                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  placeholder="Ej. Juan Pérez Quispe"
                  value={formData.nombre}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-4 py-3 rounded-lg border bg-white text-[#2b2118] placeholder:text-[#b3a892] text-sm focus:outline-none focus:ring-2 transition-all ${
                    touched.nombre && errores.nombre
                      ? 'border-red-400 focus:ring-red-200 bg-red-50/30'
                      : 'border-[#e6dcc8] focus:ring-[#e8ead5] focus:border-[#6b7a3a]'
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
                  <label htmlFor="telefono" className="block text-sm font-semibold text-[#2b2118] mb-1.5">
                    Celular (9 dígitos)
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
                    className={`w-full px-4 py-3 rounded-lg border bg-white text-[#2b2118] placeholder:text-[#b3a892] text-sm focus:outline-none focus:ring-2 transition-all ${
                      touched.telefono && errores.telefono
                        ? 'border-red-400 focus:ring-red-200 bg-red-50/30'
                        : 'border-[#e6dcc8] focus:ring-[#e8ead5] focus:border-[#6b7a3a]'
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
                  <label htmlFor="correo" className="block text-sm font-semibold text-[#2b2118] mb-1.5">
                    Correo electrónico
                  </label>
                  <input
                    id="correo"
                    name="correo"
                    type="email"
                    placeholder="juan@ejemplo.com"
                    value={formData.correo}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`w-full px-4 py-3 rounded-lg border bg-white text-[#2b2118] placeholder:text-[#b3a892] text-sm focus:outline-none focus:ring-2 transition-all ${
                      touched.correo && errores.correo
                        ? 'border-red-400 focus:ring-red-200 bg-red-50/30'
                        : 'border-[#e6dcc8] focus:ring-[#e8ead5] focus:border-[#6b7a3a]'
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
                <label htmlFor="password" className="block text-sm font-semibold text-[#2b2118] mb-1.5">
                  Contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-4 py-3 rounded-lg border bg-white text-[#2b2118] placeholder:text-[#b3a892] text-sm focus:outline-none focus:ring-2 transition-all ${
                    touched.password && errores.password
                      ? 'border-red-400 focus:ring-red-200 bg-red-50/30'
                      : 'border-[#e6dcc8] focus:ring-[#e8ead5] focus:border-[#6b7a3a]'
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
                <label htmlFor="confirmarPassword" className="block text-sm font-semibold text-[#2b2118] mb-1.5">
                  Confirmar contraseña
                </label>
                <input
                  id="confirmarPassword"
                  name="confirmarPassword"
                  type="password"
                  placeholder="Repite tu contraseña"
                  value={formData.confirmarPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-4 py-3 rounded-lg border bg-white text-[#2b2118] placeholder:text-[#b3a892] text-sm focus:outline-none focus:ring-2 transition-all ${
                    touched.confirmarPassword && errores.confirmarPassword
                      ? 'border-red-400 focus:ring-red-200 bg-red-50/30'
                      : 'border-[#e6dcc8] focus:ring-[#e8ead5] focus:border-[#6b7a3a]'
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
                className="w-full mt-2 py-3 px-4 rounded-xl bg-[#2f4a2e] hover:bg-[#243a23] text-white font-bold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          <div className="mt-6 text-center text-sm text-[#6b4a2f] space-y-2">
            <p>
              ¿Ya tienes cuenta?{' '}
              <a href="#login" className="font-semibold text-[#2f4a2e] hover:underline">
                Inicia sesión
              </a>
            </p>
            <p>
              ¿Tienes un puesto de emoliente?{' '}
              <a href="#registro-emolientero" className="font-semibold text-[#2f4a2e] hover:underline">
                Regístralo aquí
              </a>
            </p>
          </div>
        </div>
      </main>

    </div>
  )
}
