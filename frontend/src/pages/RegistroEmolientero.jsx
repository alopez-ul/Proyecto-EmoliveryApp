import { useState } from 'react'
import { registrarEmolientero } from '../services/registroService.js'
import Encabezado from '../components/Encabezado.jsx'

// Mismo formato que backend/src/validaciones/emolientero.js (el backend es el que decide).
const CODIGO_MUNICIPAL = /^MLM-(\d{4})-(\d{5})$/

const TODOS_TOCADOS = {
  nombreNegocio: true,
  dni: true,
  codigoMunicipal: true,
  telefono: true,
  correo: true,
  password: true,
  confirmarPassword: true,
}

export default function RegistroEmolientero() {
  const [formData, setFormData] = useState({
    nombreNegocio: '',
    dni: '',
    codigoMunicipal: '',
    telefono: '',
    correo: '',
    password: '',
    confirmarPassword: '',
  })

  const [touched, setTouched] = useState({})
  const [errores, setErrores] = useState({})
  const [enviado, setEnviado] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [errorServidor, setErrorServidor] = useState('')

  function validar(valores) {
    const errs = {}

    if (!valores.nombreNegocio.trim()) {
      errs.nombreNegocio = 'El nombre del titular o negocio es obligatorio.'
    } else if (valores.nombreNegocio.trim().length < 3) {
      errs.nombreNegocio = 'Ingresa al menos 3 caracteres.'
    } else if (valores.nombreNegocio.trim().length > 100) {
      errs.nombreNegocio = 'Ingresa como máximo 100 caracteres.'
    }

    if (!valores.dni.trim()) {
      errs.dni = 'El DNI es obligatorio.'
    } else if (!/^\d{8}$/.test(valores.dni.trim())) {
      errs.dni = 'El DNI debe contener exactamente 8 dígitos numéricos.'
    }

    const partesCodigo = CODIGO_MUNICIPAL.exec(valores.codigoMunicipal.trim())
    const añoActual = new Date().getFullYear()
    if (!valores.codigoMunicipal.trim()) {
      errs.codigoMunicipal = 'El código de autorización municipal es obligatorio.'
    } else if (!partesCodigo) {
      errs.codigoMunicipal = 'El código debe tener el formato MLM-AAAA-NNNNN (por ejemplo, MLM-2025-00123).'
    } else if (Number(partesCodigo[1]) < 2000 || Number(partesCodigo[1]) > añoActual) {
      errs.codigoMunicipal = `El año del código debe estar entre 2000 y ${añoActual}.`
    } else if (partesCodigo[2] === '00000') {
      errs.codigoMunicipal = 'El correlativo del código no puede ser 00000.'
    }

    if (!valores.telefono.trim()) {
      errs.telefono = 'El teléfono de contacto es obligatorio.'
    } else if (!/^9\d{8}$/.test(valores.telefono.trim())) {
      errs.telefono = 'Debe ser un número válido de 9 dígitos que comience con 9.'
    }

    if (!valores.correo.trim()) {
      errs.correo = 'El correo electrónico es obligatorio.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.correo.trim())) {
      errs.correo = 'Ingresa un correo con formato válido.'
    }

    if (!valores.password) {
      errs.password = 'La contraseña es obligatoria.'
    } else if (valores.password.length < 8) {
      errs.password = 'La contraseña debe tener mínimo 8 caracteres.'
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
    const { name } = e.target
    const value = name === 'codigoMunicipal' ? e.target.value.toUpperCase() : e.target.value
    const nuevos = { ...formData, [name]: value }
    setFormData(nuevos)
    if (touched[name]) {
      setErrores(validar(nuevos))
    }
  }

  const handleBlur = (e) => {
    const { name } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrores(validar(formData))
  }

  const enfocar = (errs) => {
    const primero = Object.keys(TODOS_TOCADOS).find((campo) => errs[campo])
    if (primero) document.getElementById(primero)?.focus()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setTouched(TODOS_TOCADOS)
    setErrorServidor('')
    const errs = validar(formData)
    setErrores(errs)
    if (Object.keys(errs).length) return enfocar(errs)

    setCargando(true)
    try {
      const { confirmarPassword, ...datos } = formData
      setEnviado(await registrarEmolientero(datos))
    } catch (err) {
      // Errores por campo del servidor (p. ej. DNI ya registrado) se muestran bajo cada campo
      if (err.campos) {
        setErrores(err.campos)
        enfocar(err.campos)
      }
      setErrorServidor(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f3e8] text-[#2b2118] flex flex-col justify-between">
      {/* Header */}
      <Encabezado />

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-xl bg-white rounded-2xl border border-[#ece4d4] p-7 sm:p-10">
          {/* Badge & Title */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#2b2118]">
              Registra tu puesto
            </h1>
            <p className="text-sm text-[#6b4a2f] mt-1.5">
              Recibe pedidos de clientes cerca de ti. Antes de aparecer en el mapa, verificamos tu autorización municipal.
            </p>
          </div>

          {/* Success Screen */}
          {enviado ? (
            <div className="bg-amber-50 border border-amber-300 text-[#2b2118] rounded-2xl p-6 text-center animate-in fade-in duration-300">
              <div className="w-14 h-14 bg-amber-200 text-[#2f4a2e] rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-xl text-[#2b2118] mb-2">¡Solicitud recibida satisfactoriamente!</h3>
              <p className="text-sm text-[#6b4a2f] mb-4">
                El puesto <strong>{enviado.nombre}</strong> (DNI: {formData.dni}) ha sido registrado con estado{' '}
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                  Pendiente de verificación municipal
                </span>.
              </p>
              <p className="text-xs text-[#9a8670] mb-6">
                El administrador ya fue notificado. Te avisaremos a <strong>{enviado.correo}</strong> en cuanto apruebe tu autorización <strong>{enviado.codigoMunicipal}</strong>.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="#login"
                  className="px-5 py-2.5 rounded-xl bg-[#2f4a2e] text-white font-bold text-sm hover:bg-[#243a23] transition-all shadow-sm"
                >
                  Ir al inicio de sesión
                </a>
                <a
                  href="#inicio"
                  className="px-5 py-2.5 rounded-xl bg-white border border-[#d6c8ad] text-[#6b4a2f] font-semibold text-sm hover:bg-[#fbf7ee] transition-all"
                >
                  Volver al mapa
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {errorServidor && (
                <div role="alert" className="p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700">
                  ⚠ {errorServidor}
                </div>
              )}
              {/* Nombre del Titular / Negocio */}
              <div>
                <label htmlFor="nombreNegocio" className="block text-sm font-semibold text-[#2b2118] mb-1.5">
                  Nombre del titular o del puesto
                </label>
                <input
                  id="nombreNegocio"
                  name="nombreNegocio"
                  type="text"
                  placeholder="Ej. Don Manuel - Emolientes y Quinua El Parque"
                  value={formData.nombreNegocio}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-4 py-3 rounded-lg border bg-white text-[#2b2118] placeholder:text-[#b3a892] text-sm focus:outline-none focus:ring-2 transition-all ${
                    touched.nombreNegocio && errores.nombreNegocio
                      ? 'border-red-400 focus:ring-red-200 bg-red-50/30'
                      : 'border-[#e6dcc8] focus:ring-[#e8ead5] focus:border-[#6b7a3a]'
                  }`}
                />
                {touched.nombreNegocio && errores.nombreNegocio && (
                  <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                    <span>⚠</span> {errores.nombreNegocio}
                  </p>
                )}
              </div>

              {/* Grid: DNI & Código Municipal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="dni" className="block text-sm font-semibold text-[#2b2118] mb-1.5">
                    DNI (8 dígitos)
                  </label>
                  <input
                    id="dni"
                    name="dni"
                    type="text"
                    maxLength={8}
                    placeholder="12345678"
                    value={formData.dni}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`w-full px-4 py-3 rounded-lg border bg-white text-[#2b2118] placeholder:text-[#b3a892] text-sm focus:outline-none focus:ring-2 transition-all ${
                      touched.dni && errores.dni
                        ? 'border-red-400 focus:ring-red-200 bg-red-50/30'
                        : 'border-[#e6dcc8] focus:ring-[#e8ead5] focus:border-[#6b7a3a]'
                    }`}
                  />
                  {touched.dni && errores.dni && (
                    <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                      <span>⚠</span> {errores.dni}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="codigoMunicipal" className="block text-sm font-semibold text-[#2b2118] mb-1.5">
                    Código de autorización municipal
                  </label>
                  <input
                    id="codigoMunicipal"
                    name="codigoMunicipal"
                    type="text"
                    placeholder="MLM-2025-00123"
                    maxLength={14}
                    autoComplete="off"
                    spellCheck={false}
                    value={formData.codigoMunicipal}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`w-full px-4 py-3 rounded-lg border bg-white text-[#2b2118] placeholder:text-[#b3a892] text-sm focus:outline-none focus:ring-2 transition-all ${
                      touched.codigoMunicipal && errores.codigoMunicipal
                        ? 'border-red-400 focus:ring-red-200 bg-red-50/30'
                        : 'border-[#e6dcc8] focus:ring-[#e8ead5] focus:border-[#6b7a3a]'
                    }`}
                  />
                  {touched.codigoMunicipal && errores.codigoMunicipal && (
                    <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                      <span>⚠</span> {errores.codigoMunicipal}
                    </p>
                  )}
                </div>
              </div>

              {/* Grid: Teléfono & Correo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="telefono" className="block text-sm font-semibold text-[#2b2118] mb-1.5">
                    Celular de contacto
                  </label>
                  <input
                    id="telefono"
                    name="telefono"
                    type="tel"
                    maxLength={9}
                    placeholder="912345678"
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

                <div>
                  <label htmlFor="correo" className="block text-sm font-semibold text-[#2b2118] mb-1.5">
                    Correo para notificaciones
                  </label>
                  <input
                    id="correo"
                    name="correo"
                    type="email"
                    placeholder="emolientero@ejemplo.pe"
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

              {/* Grid: Contraseña & Confirmación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-[#2b2118] mb-1.5">
                    Contraseña
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
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

                <div>
                  <label htmlFor="confirmarPassword" className="block text-sm font-semibold text-[#2b2118] mb-1.5">
                    Confirmar contraseña
                  </label>
                  <input
                    id="confirmarPassword"
                    name="confirmarPassword"
                    type="password"
                    placeholder="••••••••"
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
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={cargando}
                className="w-full mt-3 py-3.5 px-4 rounded-xl bg-[#2f4a2e] hover:bg-[#243a23] text-white font-bold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {cargando ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Procesando solicitud...</span>
                  </>
                ) : (
                  <span>Registrar puesto para verificación municipal</span>
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
              ¿Quieres comprar?{' '}
              <a href="#registro-cliente" className="font-semibold text-[#2f4a2e] hover:underline">
                Crea una cuenta de cliente
              </a>
            </p>
          </div>
        </div>
      </main>

    </div>
  )
}
