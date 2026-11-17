import { useCallback, useEffect, useState } from 'react'
import { codigoCompleto, entregarConCodigo, formatearMientrasEscribe, pedidosPorEntregar } from '../services/ordenesService.js'
import Encabezado from '../components/Encabezado.jsx'

// US15 - T69: el emolientero escribe el código de recojo que le muestra el cliente. Si es válido, el
// pedido queda entregado y se habilita la reseña del cliente, todo a la vez (T70).

const formatoHora = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' })

// Estilo del aviso según la respuesta del servidor.
const AVISOS = {
  404: { titulo: 'Código inexistente', clase: 'bg-red-50 border-red-200 text-red-800' },
  403: { titulo: 'Pedido de otro emolientero', clase: 'bg-red-50 border-red-200 text-red-800' },
  409: { titulo: 'Código ya usado', clase: 'bg-amber-50 border-amber-200 text-amber-900' },
}

export default function ValidarRecojo() {
  const [codigo, setCodigo] = useState('')
  const [validando, setValidando] = useState(false)
  const [rechazo, setRechazo] = useState(null) // { status, mensaje }
  const [entregado, setEntregado] = useState(null) // respuesta del servidor
  const [pendientes, setPendientes] = useState(null)
  const [errorCarga, setErrorCarga] = useState('')

  const cargar = useCallback(() => {
    pedidosPorEntregar()
      .then(setPendientes)
      .catch((err) => setErrorCarga(err.status === 403 ? 'Esta sección es solo para emolienteros.' : err.message))
  }, [])
  useEffect(cargar, [cargar])

  async function validar(e) {
    e.preventDefault()
    if (!codigoCompleto(codigo) || validando) return
    setRechazo(null)
    setEntregado(null)
    setValidando(true)
    try {
      setEntregado(await entregarConCodigo(codigo))
      setCodigo('')
      cargar()
    } catch (err) {
      setRechazo({ status: err.status, mensaje: err.campos?.codigo ?? err.message })
    } finally {
      setValidando(false)
    }
  }

  const aviso = rechazo && (AVISOS[rechazo.status] ?? { titulo: 'No se pudo validar', clase: 'bg-red-50 border-red-200 text-red-800' })
  // Un 409 también puede ser un pedido cancelado o aún sin pagar: el título sigue al mensaje del servidor.
  const tituloAviso =
    rechazo?.status === 409 && /cancelado/.test(rechazo.mensaje)
      ? 'Pedido cancelado'
      : rechazo?.status === 409 && /no está pagado/.test(rechazo.mensaje)
        ? 'Pedido sin pagar'
        : aviso?.titulo

  return (
    <div className="min-h-screen bg-[#faf6f0] text-[#2b1a0f] flex flex-col">
      <Encabezado volver={{ href: '#emolientero', texto: 'Mi puesto' }} />

      <main className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6 lg:p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold">Entregar un pedido</h1>
          <p className="text-sm text-[#6b5443] mt-1.5">
            Pide al cliente su código de recojo y escríbelo aquí. Cada código sirve una sola vez.
          </p>
        </div>

        <form onSubmit={validar} noValidate className="bg-white rounded-2xl border border-[#ebe3d9] shadow-sm p-5 sm:p-6">
          <label htmlFor="codigo" className="block text-sm font-semibold mb-2">Código de recojo</label>
          <input
            id="codigo"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="ABC-23X"
            value={codigo}
            onChange={(e) => {
              setCodigo(formatearMientrasEscribe(e.target.value))
              setRechazo(null)
            }}
            className="w-full rounded-2xl border border-[#ebe3d9] px-4 py-4 text-center font-mono text-3xl font-bold tracking-[0.3em] uppercase focus:outline-none focus:ring-2 focus:ring-orange-200"
            aria-describedby="ayuda-codigo"
          />
          <p id="ayuda-codigo" className="mt-2 text-xs text-[#9a8676] text-center">
            6 letras y números. No usa 0, O, 1 ni I.
          </p>

          {aviso && (
            <div role="alert" className={`mt-4 p-3.5 rounded-xl border text-sm ${aviso.clase}`}>
              <p className="font-bold">{tituloAviso}</p>
              <p className="mt-0.5">{rechazo.mensaje}</p>
            </div>
          )}

          {entregado && (
            <div role="status" className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm">
              <p className="font-bold text-base">✓ Pedido #{entregado.orden.id} entregado</p>
              <p className="mt-1">
                Cliente: <strong>{entregado.orden.cliente}</strong> · {formatoHora.format(new Date(entregado.orden.entregadaEn))}
              </p>
              <p className="mt-1">Se habilitó la reseña del cliente y se le avisó.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!codigoCompleto(codigo) || validando}
            className="mt-5 w-full py-3.5 rounded-xl font-bold text-sm text-white shadow-md bg-emerald-700 hover:bg-emerald-800 hover:shadow-lg disabled:bg-stone-300 disabled:shadow-none disabled:cursor-not-allowed"
          >
            {validando ? 'Validando…' : 'Validar y entregar'}
          </button>
        </form>

        <section className="mt-6 bg-white rounded-2xl border border-[#ebe3d9] shadow-sm p-5 sm:p-6">
          <h2 className="text-lg font-bold mb-3">Pedidos por entregar</h2>
          {errorCarga && <p className="text-sm text-red-700">{errorCarga}</p>}
          {!pendientes && !errorCarga && <p className="text-sm text-[#9a8676]">Cargando…</p>}
          {pendientes?.length === 0 && <p className="text-sm text-[#9a8676]">No tienes pedidos pendientes.</p>}
          <ul className="space-y-2">
            {pendientes?.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#fbf6ef] border border-[#ebe3d9] text-sm">
                <span>
                  <strong>#{o.id}</strong> · {o.cliente}
                </span>
                <span className="text-xs text-[#9a8676]">{formatoHora.format(new Date(o.creadaEn))}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

    </div>
  )
}
