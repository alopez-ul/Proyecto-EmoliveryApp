import { useCallback, useEffect, useState } from 'react'
import { verificarSesion } from '../services/authService.js'
import { SIN_COMPRAS, nombreEstado, obtenerHistorial, validarRango } from '../services/historialService.js'

// US20 - Historial de compras (Fabio - Release 2 / Sprint 1)
// T76: perfil con el conteo de compras y el monto acumulado. T77: listado con filtro por rango de fechas.

const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })
const formatoFecha = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' })

// Color de apoyo por estado; el texto del estado siempre se muestra (RNF15).
const COLOR_ESTADO = {
  entregada: 'bg-emerald-50 text-emerald-800',
  pagada: 'bg-sky-50 text-sky-800',
  cancelada: 'bg-stone-100 text-stone-600',
}

function Resumen({ etiqueta, valor }) {
  return (
    <div className="flex-1 rounded-2xl bg-[#fbf6ef] border border-[#ebe3d9] p-4 text-center">
      <p className="text-xs font-bold uppercase tracking-wider text-[#9a8676]">{etiqueta}</p>
      <p className="mt-1 text-2xl font-extrabold text-[#2b1a0f] tabular-nums">{valor}</p>
    </div>
  )
}

function Compra({ compra }) {
  return (
    <li className="py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-bold text-sm text-[#2b1a0f]">{compra.emolientero.nombre}</p>
          <p className="text-xs text-[#6b5443] mt-0.5">{formatoFecha.format(new Date(compra.fecha))}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-extrabold text-base text-[#2b1a0f] tabular-nums">{soles.format(compra.monto)}</p>
          <span
            className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${COLOR_ESTADO[compra.estado] ?? 'bg-amber-50 text-amber-800'}`}
          >
            {nombreEstado(compra.estado)}
          </span>
        </div>
      </div>
      <ul className="mt-2 text-xs text-[#6b5443] space-y-0.5">
        {compra.productos.map((p, i) => (
          <li key={i}>
            {p.cantidad} × {p.nombre} <span className="tabular-nums">({soles.format(p.precioUnitario)} c/u)</span>
          </li>
        ))}
      </ul>
    </li>
  )
}

export default function MisCompras() {
  const [usuario, setUsuario] = useState(null)
  const [filtro, setFiltro] = useState({ desde: '', hasta: '' })
  const [erroresFiltro, setErroresFiltro] = useState({})
  const [historial, setHistorial] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  // Solo el cliente con sesión ve su historial.
  useEffect(() => {
    verificarSesion().then((u) => {
      if (!u) window.location.hash = 'login'
      else if (u.rol !== 'cliente') window.location.hash = u.rol
      else setUsuario(u)
    })
  }, [])

  const consultar = useCallback((rango) => {
    setCargando(true)
    setError('')
    obtenerHistorial(rango)
      .then(setHistorial)
      .catch((err) => {
        setHistorial(null)
        if (err.campos) setErroresFiltro(err.campos)
        setError(err.message)
      })
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    if (usuario) consultar({})
  }, [usuario, consultar])

  const filtrar = (e) => {
    e.preventDefault()
    const errores = validarRango(filtro)
    setErroresFiltro(errores)
    if (!Object.keys(errores).length) consultar(filtro)
  }

  const limpiar = () => {
    setFiltro({ desde: '', hasta: '' })
    setErroresFiltro({})
    consultar({})
  }

  const campo = (nombre, etiqueta) => (
    <label className="flex-1 text-xs font-bold text-[#6b5443]">
      {etiqueta}
      <input
        type="date"
        value={filtro[nombre]}
        onChange={(e) => setFiltro((f) => ({ ...f, [nombre]: e.target.value }))}
        aria-invalid={Boolean(erroresFiltro[nombre])}
        aria-describedby={erroresFiltro[nombre] ? `error-${nombre}` : undefined}
        className="mt-1 w-full rounded-xl border border-[#ddd2c4] px-3 py-2 text-sm text-[#2b1a0f] font-normal"
      />
      {erroresFiltro[nombre] && (
        <span id={`error-${nombre}`} className="block mt-1 font-normal text-red-700">
          {erroresFiltro[nombre]}
        </span>
      )}
    </label>
  )

  return (
    <div className="min-h-screen bg-[#f7f3ee] text-[#2b1a0f] flex flex-col">
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
          href="#cliente"
          className="text-sm font-semibold text-[#6b5443] hover:text-[#2b1a0f] transition-colors py-1.5 px-3 rounded-lg hover:bg-[#fbf6ef]"
        >
          ← Volver a mi panel
        </a>
      </header>

      <main className="flex-1 flex justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-xl bg-white rounded-3xl border border-[#ebe3d9] shadow-xl p-6 sm:p-8 self-start">
          {!usuario ? (
            <p className="text-center text-sm text-[#6b5443] py-10" role="status">
              Verificando tu sesión…
            </p>
          ) : (
            <>
              <div className="text-center mb-6">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 text-[#b8581a] mb-2">
                  Mi perfil
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Mis compras</h1>
                <p className="text-sm text-[#6b5443] mt-1">{usuario.nombre}</p>
              </div>

              {/* T77: filtro por rango de fechas */}
              <form onSubmit={filtrar} className="mb-5" noValidate>
                <div className="flex gap-3">
                  {campo('desde', 'Desde')}
                  {campo('hasta', 'Hasta')}
                </div>
                <div className="flex gap-3 mt-3">
                  <button
                    type="submit"
                    disabled={cargando}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[#b8581a] text-white font-bold text-sm hover:bg-[#9e4a14] transition-all disabled:opacity-60"
                  >
                    Filtrar
                  </button>
                  <button
                    type="button"
                    onClick={limpiar}
                    disabled={cargando}
                    className="px-4 py-2.5 rounded-xl border border-[#ddd2c4] text-[#6b5443] font-bold text-sm hover:bg-[#fbf6ef] transition-all disabled:opacity-60"
                  >
                    Ver todo
                  </button>
                </div>
              </form>

              {error && (
                <div role="alert" className="mb-5 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
                  {error}
                </div>
              )}

              {cargando && !historial && (
                <p className="text-center text-sm text-[#6b5443] py-6" role="status">
                  Cargando tus compras…
                </p>
              )}

              {historial && (
                <>
                  {/* T76: conteo y monto acumulado del periodo consultado */}
                  <div className="flex gap-3 mb-5" aria-live="polite">
                    <Resumen etiqueta="Compras" valor={historial.conteo} />
                    <Resumen etiqueta="Monto acumulado" valor={soles.format(historial.montoAcumulado)} />
                  </div>

                  {historial.compras.length === 0 ? (
                    <div className="text-center py-8 px-4 rounded-2xl bg-[#fbf6ef] border border-dashed border-[#ddd2c4]" role="status">
                      <p className="font-bold text-[#2b1a0f]">{historial.mensaje ?? SIN_COMPRAS}</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-[#ebe3d9]">
                      {historial.compras.map((c) => (
                        <Compra key={c.id} compra={c} />
                      ))}
                    </ul>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
