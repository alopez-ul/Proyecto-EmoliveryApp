import { useCallback, useEffect, useState } from 'react'
import { abrirJornada, cerrarJornada, estadoJornada } from '../services/jornadasService.js'

// US06 - Apertura y Cierre de Jornada del Emolientero (Jorge Burga - Sprint 1)
// Conectado al backend: las jornadas se guardan en Neon (tabla jornadas). Para abrir se exige
// una ubicación registrada hoy (US05) y para cerrar, no tener órdenes sin entregar.

export default function ControlJornada() {
  const [estado, setEstado] = useState(null) // { jornada, ubicacionHoy, jornadasHoy, ordenesPendientes }
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [avisoUbicacion, setAvisoUbicacion] = useState(false)
  const [avisoOrdenes, setAvisoOrdenes] = useState(false)

  const cargar = useCallback(() => {
    estadoJornada()
      .then(setEstado)
      .catch((err) => setError(err.status === 403 ? 'Esta sección es solo para emolienteros.' : err.message))
  }, [])

  useEffect(cargar, [cargar])

  const jornadaAbierta = Boolean(estado?.jornada)
  const ubicacionGPS = Boolean(estado?.ubicacionHoy)
  const ordenesPendientes = estado?.ordenesPendientes ?? 0
  const ultima = estado?.jornadasHoy.at(-1)
  const horaInicio = ultima ? new Date(ultima.abiertaEn) : null
  const horaCierre = ultima?.cerradaEn ? new Date(ultima.cerradaEn) : null

  const formatearHora = (fecha) =>
    fecha
      ? fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '--:--:--'

  // mostrarAviso: el aviso de la regla incumplida (422) de cada acción
  async function ejecutar(accion, mostrarAviso) {
    setError('')
    setAvisoUbicacion(false)
    setAvisoOrdenes(false)
    setProcesando(true)
    try {
      await accion()
    } catch (err) {
      if (err.status === 422) mostrarAviso(true)
      else setError(err.message)
    } finally {
      cargar()
      setProcesando(false)
    }
  }

  const iniciarJornada = () => ejecutar(abrirJornada, setAvisoUbicacion)
  const cerrarJornadaActual = () => ejecutar(cerrarJornada, setAvisoOrdenes)

  return (
    <div className="min-h-screen bg-[#f7f3ee] text-[#2b1a0f] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#ebe3d9] py-4 px-6 flex items-center justify-between shadow-xs sticky top-0 z-20">
        <a href="#inicio" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#b8581a] to-[#e67e22] flex items-center justify-center text-white font-bold text-lg shadow-sm">
            E
          </span>
          <span className="font-extrabold text-2xl tracking-tight text-[#2b1a0f]">
            Emolivery<span className="text-[#b8581a]">.</span>
          </span>
        </a>
        <a
          href="#emolientero"
          className="text-sm font-semibold text-[#6b5443] hover:text-[#2b1a0f] transition-colors py-1.5 px-3 rounded-lg hover:bg-[#fbf6ef]"
        >
          ← Panel Emolientero
        </a>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-lg bg-white rounded-3xl border border-[#ebe3d9] shadow-xl p-6 sm:p-8">
          {/* Title */}
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 text-[#b8581a] mb-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              US06 - Control de Jornada
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2b1a0f]">
              Apertura y Cierre de Jornada
            </h1>
            <p className="text-sm text-[#6b5443] mt-1.5">
              Gestiona tu disponibilidad diaria como emolientero autorizado.
            </p>
          </div>

          {/* Estado Actual de la Jornada */}
          <div className={`mb-6 p-5 rounded-2xl border-2 text-center transition-all duration-300 ${
            jornadaAbierta
              ? 'bg-emerald-50 border-emerald-300'
              : 'bg-stone-50 border-stone-200'
          }`}>
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-2 ${
              jornadaAbierta
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-stone-200 text-stone-600'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${
                jornadaAbierta ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'
              }`} />
              {jornadaAbierta ? 'Jornada Abierta' : 'Jornada Cerrada'}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3 text-xs text-[#6b5443]">
              <div>
                <span className="block font-bold uppercase tracking-wider text-[10px] text-[#9a8676] mb-0.5">Hora de Apertura</span>
                <span className={`text-base font-mono font-bold ${jornadaAbierta ? 'text-emerald-700' : 'text-stone-400'}`}>
                  {formatearHora(horaInicio)}
                </span>
              </div>
              <div>
                <span className="block font-bold uppercase tracking-wider text-[10px] text-[#9a8676] mb-0.5">Hora de Cierre</span>
                <span className={`text-base font-mono font-bold ${horaCierre ? 'text-red-600' : 'text-stone-400'}`}>
                  {formatearHora(horaCierre)}
                </span>
              </div>
            </div>
          </div>

          {/* Toggles de Simulación */}
          <div className="space-y-4 mb-6">
            {/* Toggle GPS */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#fbf6ef] border border-[#ebe3d9]">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  ubicacionGPS ? 'bg-emerald-100 text-emerald-600' : 'bg-stone-100 text-stone-400'
                }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-[#2b1a0f]">Ubicación GPS registrada</p>
                  <p className="text-xs text-[#9a8676]">
                    {ubicacionGPS
                      ? `Hoy a las ${formatearHora(new Date(estado.ubicacionHoy.registradaEn))} · La Molina`
                      : 'Aún no registras tu ubicación hoy'}
                  </p>
                </div>
              </div>
              {ubicacionGPS ? (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">Registrada</span>
              ) : (
                <a href="#emolientero" className="text-xs font-bold text-[#b8581a] hover:underline">Registrar ubicación</a>
              )}
            </div>

            {/* Toggle Órdenes Pendientes */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#fbf6ef] border border-[#ebe3d9]">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  ordenesPendientes ? 'bg-amber-100 text-amber-600' : 'bg-stone-100 text-stone-400'
                }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-[#2b1a0f]">Órdenes pendientes de entrega</p>
                  <p className="text-xs text-[#9a8676]">
                    {ordenesPendientes === 0
                      ? 'Sin órdenes pendientes'
                      : `${ordenesPendientes} ${ordenesPendientes === 1 ? 'orden' : 'órdenes'} sin entregar`}
                  </p>
                </div>
              </div>
              {ordenesPendientes > 0 && (
                <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full">{ordenesPendientes}</span>
              )}
            </div>
          </div>

          {/* Avisos de Bloqueo */}
          {avisoUbicacion && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium flex items-start gap-2.5">
              <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>
                No puedes iniciar jornada sin registrar tu ubicación en La Molina.{' '}
                <a href="#emolientero" className="underline font-bold">Regístrala desde tu panel</a>.
              </span>
            </div>
          )}

          {avisoOrdenes && (
            <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm font-medium flex items-start gap-2.5">
              <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>No puedes cerrar la jornada con órdenes pendientes de entrega. Completa o cancela las órdenes primero.</span>
            </div>
          )}

          {error && (
            <div role="alert" className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium">
              {error}
            </div>
          )}

          {/* Botones de Acción */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Botón Iniciar Jornada */}
            <button
              type="button"
              onClick={iniciarJornada}
              disabled={!estado || jornadaAbierta || procesando}
              className={`py-3.5 px-4 rounded-xl font-bold text-sm shadow-md transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 ${
                !estado || jornadaAbierta
                  ? 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white hover:shadow-lg'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Iniciar Jornada
            </button>

            {/* Botón Cerrar Jornada */}
            <button
              type="button"
              onClick={cerrarJornadaActual}
              disabled={!jornadaAbierta || procesando}
              className={`py-3.5 px-4 rounded-xl font-bold text-sm shadow-md transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 ${
                !jornadaAbierta
                  ? 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white hover:shadow-lg'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Cerrar Jornada
            </button>
          </div>

          {/* Registro de actividad de hoy (desde la base de datos) */}
          {estado?.jornadasHoy.length > 0 && (
            <div className="mt-6 pt-5 border-t border-[#ebe3d9]">
              <h3 className="text-xs font-bold text-[#9a8676] uppercase tracking-wider mb-3">Registro de actividad de hoy</h3>
              <div className="space-y-2">
                {estado.jornadasHoy.flatMap((j) => [
                  <div key={`a${j.id}`} className="flex items-center gap-2.5 text-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[#6b5443]">Jornada iniciada a las</span>
                    <span className="font-mono font-bold text-emerald-700">{formatearHora(new Date(j.abiertaEn))}</span>
                  </div>,
                  j.cerradaEn && (
                    <div key={`c${j.id}`} className="flex items-center gap-2.5 text-sm">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-[#6b5443]">Jornada cerrada a las</span>
                      <span className="font-mono font-bold text-red-600">{formatearHora(new Date(j.cerradaEn))}</span>
                    </div>
                  ),
                ])}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-[#9a8676]">
        EMOLIVERY &copy; {new Date().getFullYear()} - Plataforma de Emolientes Tradicionales de Lima
      </footer>
    </div>
  )
}
