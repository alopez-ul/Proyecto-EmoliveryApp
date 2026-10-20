import { useState } from 'react'
import { registrarEmolientero } from '../services/registroService.js'

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
        <div className="w-full max-w-xl bg-white rounded-3xl border border-[#ebe3d9] shadow-xl p-6 sm:p-8">
          {/* Badge & Title */}
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 text-[#b8581a] mb-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Registro de Emolientero
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2b1a0f]">
              Únete a la Red de Emolienteros
            </h1>
            <p className="text-sm text-[#6b5443] mt-1.5">
              Publica tu punto de venta en tiempo real y recibe pedidos de clientes en tu zona.
            </p>
          </div>

          {/* Banner Informativo de Verificación Municipal */}
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start gap-3 text-amber-900">
            <div className="mt-0.5 w-6 h-6 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-xs sm:text-sm leading-relaxed">
              <p className="font-bold text-amber-950 mb-0.5">Aviso importante de verificación municipal</p>
              <p className="text-amber-800">
                Al enviar este formulario, tu cuenta será registrada en estado{' '}
                <span className="font-semibold underline decoration-amber-400">"Pendiente de verificación municipal"</span>.
                Un administrador revisará tu autorización antes de que puedas publicar puntos en el mapa.
              </p>
            </div>
          </div>

          {/* Success Screen */}
          {enviado ? (
            <div className="bg-amber-50 border border-amber-300 text-[#2b1a0f] rounded-2xl p-6 text-center animate-in fade-in duration-300">
              <div className="w-14 h-14 bg-amber-200 text-[#b8581a] rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-xl text-[#2b1a0f] mb-2">¡Solicitud recibida satisfactoriamente!</h3>
              <p className="text-sm text-[#6b5443] mb-4">
                El puesto <strong>{enviado.nombre}</strong> (DNI: {formData.dni}) ha sido registrado con estado{' '}
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                  Pendiente de verificación municipal
                </span>.
              </p>
              <p className="text-xs text-[#9a8676] mb-6">
                El administrador ya fue notificado. Te avisaremos a <strong>{enviado.correo}</strong> en cuanto apruebe tu autorización <strong>{enviado.codigoMunicipal}</strong>.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="#login"
                  className="px-5 py-2.5 rounded-xl bg-[#b8581a] text-white font-bold text-sm hover:bg-[#9e4a14] transition-all shadow-sm"
                >
                  Ir al inicio de sesión
                </a>
                <a
                  href="#inicio"
                  className="px-5 py-2.5 rounded-xl bg-white border border-[#ddd2c4] text-[#6b5443] font-semibold text-sm hover:bg-[#fbf6ef] transition-all"
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
                <label htmlFor="nombreNegocio" className="block text-xs font-bold text-[#6b5443] uppercase tracking-wider mb-1.5">
                  Nombre del Titular o Puesto Tradicional <span className="text-red-500">*</span>
                </label>
                <input
                  id="nombreNegocio"
                  name="nombreNegocio"
                  type="text"
                  placeholder="Ej. Don Manuel - Emolientes y Quinua El Parque"
                  value={formData.nombreNegocio}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-4 py-2.5 rounded-xl border bg-[#fbf6ef] text-[#2b1a0f] placeholder:text-[#9a8676] text-sm focus:outline-none focus:ring-2 transition-all ${
                    touched.nombreNegocio && errores.nombreNegocio
                      ? 'border-red-400 focus:ring-red-200 bg-red-50/30'
                      : 'border-[#ddd2c4] focus:ring-amber-200 focus:border-[#b8581a]'
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
                  <label htmlFor="dni" className="block text-xs font-bold text-[#6b5443] uppercase tracking-wider mb-1.5">
                    DNI (8 dígitos) <span className="text-red-500">*</span>
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
                    className={`w-full px-4 py-2.5 rounded-xl border bg-[#fbf6ef] text-[#2b1a0f] placeholder:text-[#9a8676] text-sm focus:outline-none focus:ring-2 transition-all ${
                      touched.dni && errores.dni
                        ? 'border-red-400 focus:ring-red-200 bg-red-50/30'
                        : 'border-[#ddd2c4] focus:ring-amber-200 focus:border-[#b8581a]'
                    }`}
                  />
                  {touched.dni && errores.dni && (
                    <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                      <span>⚠</span> {errores.dni}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="codigoMunicipal" className="block text-xs font-bold text-[#6b5443] uppercase tracking-wider mb-1.5">
                    Cód. Autorización Municipal <span className="text-red-500">*</span>
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
                    className={`w-full px-4 py-2.5 rounded-xl border bg-[#fbf6ef] text-[#2b1a0f] placeholder:text-[#9a8676] text-sm focus:outline-none focus:ring-2 transition-all ${
                      touched.codigoMunicipal && errores.codigoMunicipal
                        ? 'border-red-400 focus:ring-red-200 bg-red-50/30'
                        : 'border-[#ddd2c4] focus:ring-amber-200 focus:border-[#b8581a]'
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
                  <label htmlFor="telefono" className="block text-xs font-bold text-[#6b5443] uppercase tracking-wider mb-1.5">
                    Celular de contacto <span className="text-red-500">*</span>
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

                <div>
                  <label htmlFor="correo" className="block text-xs font-bold text-[#6b5443] uppercase tracking-wider mb-1.5">
                    Correo para notificaciones <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="correo"
                    name="correo"
                    type="email"
                    placeholder="emolientero@ejemplo.pe"
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

              {/* Grid: Contraseña & Confirmación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="password" className="block text-xs font-bold text-[#6b5443] uppercase tracking-wider mb-1.5">
                    Contraseña <span className="text-red-500">*</span>
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

                <div>
                  <label htmlFor="confirmarPassword" className="block text-xs font-bold text-[#6b5443] uppercase tracking-wider mb-1.5">
                    Confirmar Contraseña <span className="text-red-500">*</span>
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
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={cargando}
                className="w-full mt-3 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#b8581a] to-[#d35400] hover:from-[#a04b14] hover:to-[#ba4a00] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all transform active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          <div className="mt-8 pt-6 border-t border-[#ebe3d9] text-center space-y-3">
            <p className="text-sm text-[#6b5443]">
              ¿Ya tienes cuenta verificada?{' '}
              <a href="#login" className="font-bold text-[#b8581a] hover:underline">
                Inicia sesión aquí
              </a>
            </p>

            <div className="text-xs text-[#6b5443]">
              ¿Buscas registrarte como cliente para comprar?{' '}
              <a href="#registro-cliente" className="font-bold text-[#b8581a] hover:underline">
                Crear cuenta de cliente →
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
