import { useCallback, useEffect, useState } from 'react'
import { verificarSesion } from '../services/authService.js'
import { SIN_COMPRAS, cuentaComoCompra, nombreEstado, obtenerHistorial, validarRango } from '../services/historialService.js'
import Encabezado from '../components/Encabezado.jsx'

// US20 - Historial de compras (Fabio - Release 2 / Sprint 1)
// T76: perfil con el conteo de compras y el monto acumulado. T77: listado con filtro por rango de fechas.

const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })
const formatoFecha = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' })

// Color de apoyo por estado; el texto del estado siempre se muestra (RNF15).
const COLOR_ESTADO = {
  entregada: 'bg-emerald-50 text-emerald-800',
  pendiente: 'bg-sky-50 text-sky-800',
  en_camino: 'bg-sky-50 text-sky-800',
  cancelada: 'bg-stone-100 text-stone-600',
}

function Resumen({ etiqueta, valor }) {
  return (
    <div className="flex-1 rounded-2xl bg-[#fbf7ee] border border-[#e6dcc8] p-4 text-center">
      <p className="text-xs font-bold text-[#9a8670]">{etiqueta}</p>
      <p className="mt-1 text-2xl font-extrabold text-[#2b2118] tabular-nums">{valor}</p>
    </div>
  )
}

function Compra({ compra }) {
  return (
    <li className="py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-bold text-sm text-[#2b2118]">{compra.emolientero.nombre}</p>
          <p className="text-xs text-[#6b4a2f] mt-0.5">{formatoFecha.format(new Date(compra.fecha))}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-extrabold text-base text-[#2b2118] tabular-nums">{soles.format(compra.monto)}</p>
          <span
            className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
              compra.vencida ? 'bg-stone-100 text-stone-600' : COLOR_ESTADO[compra.estado] ?? 'bg-amber-50 text-amber-800'
            }`}
          >
            {nombreEstado(compra)}
          </span>
        </div>
      </div>
      {!cuentaComoCompra(compra) && <p className="mt-1 text-[11px] text-[#9a8670]">No suma al total de compras.</p>}
      <ul className="mt-2 text-xs text-[#6b4a2f] space-y-0.5">
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
    <label className="flex-1 text-xs font-bold text-[#6b4a2f]">
      {etiqueta}
      <input
        type="date"
        value={filtro[nombre]}
        onChange={(e) => setFiltro((f) => ({ ...f, [nombre]: e.target.value }))}
        aria-invalid={Boolean(erroresFiltro[nombre])}
        aria-describedby={erroresFiltro[nombre] ? `error-${nombre}` : undefined}
        className="mt-1 w-full rounded-xl border border-[#d6c8ad] px-3 py-2 text-sm text-[#2b2118] font-normal"
      />
      {erroresFiltro[nombre] && (
        <span id={`error-${nombre}`} className="block mt-1 font-normal text-red-700">
          {erroresFiltro[nombre]}
        </span>
      )}
    </label>
  )

  return (
    <div className="min-h-screen bg-[#f8f3e8] text-[#2b2118] flex flex-col">
      <Encabezado volver={{ href: '#cliente', texto: 'Volver a mi panel' }} />

      <main className="flex-1 flex justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-xl bg-white rounded-2xl border border-[#e6dcc8] shadow-sm p-6 sm:p-8 self-start">
          {!usuario ? (
            <p className="text-center text-sm text-[#6b4a2f] py-10" role="status">
              Verificando tu sesión…
            </p>
          ) : (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl sm:text-3xl font-semibold">Mis compras</h1>
                <p className="text-sm text-[#6b4a2f] mt-1">{usuario.nombre}</p>
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
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[#2f4a2e] text-white font-bold text-sm hover:bg-[#243a23] transition-all disabled:opacity-60"
                  >
                    Filtrar
                  </button>
                  <button
                    type="button"
                    onClick={limpiar}
                    disabled={cargando}
                    className="px-4 py-2.5 rounded-xl border border-[#d6c8ad] text-[#6b4a2f] font-bold text-sm hover:bg-[#fbf7ee] transition-all disabled:opacity-60"
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
                <p className="text-center text-sm text-[#6b4a2f] py-6" role="status">
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
                    <div className="text-center py-8 px-4 rounded-2xl bg-[#fbf7ee] border border-dashed border-[#d6c8ad]" role="status">
                      <p className="font-bold text-[#2b2118]">{historial.mensaje ?? SIN_COMPRAS}</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-[#e6dcc8]">
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
