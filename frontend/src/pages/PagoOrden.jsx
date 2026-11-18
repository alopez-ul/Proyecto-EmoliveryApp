import { useEffect, useMemo, useState } from 'react'
import { PagoController, Yape } from '../domain/pago/index.js'
import { obtenerOrden } from '../services/compraService.js'
import { pagarOrdenConYape } from '../services/pagoYapeService.js'
import { verificarSesion } from '../services/authService.js'
import { CodigoQRYapeSVG } from './PagoYape.jsx'
import Encabezado from '../components/Encabezado.jsx'

// US14 conectado a la base: pago con QR de Yape de una orden REAL creada en la compra anticipada (US13).
// Se abre con #pago-yape?orden=<id>. Al pagar, la orden queda lista para recoger con su código (US15).
// Sin ?orden= se muestra la demostración de PagoYape.jsx.

const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })
const ordenDeLaRuta = () => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('orden') ?? ''
const qr = new PagoController(new Yape())

function tiempoRestante(expiraEn, ahora) {
  const segundos = Math.max(0, Math.floor((new Date(expiraEn) - ahora) / 1000))
  return `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`
}

export default function PagoOrden() {
  const [id] = useState(ordenDeLaRuta)
  const [orden, setOrden] = useState(null)
  const [error, setError] = useState('')
  const [ahora, setAhora] = useState(() => Date.now())
  const [numeroOperacion, setNumeroOperacion] = useState('')
  const [monto, setMonto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null) // respuesta del backend

  useEffect(() => {
    verificarSesion().then((u) => {
      if (!u) window.location.hash = 'login'
      else if (u.rol !== 'cliente') setError('Solo un cliente puede pagar sus órdenes.')
      else
        obtenerOrden(id)
          .then((o) => {
            setOrden(o)
            setMonto(Number(o.total).toFixed(2))
          })
          .catch((err) => setError(err.status === 404 ? 'No encontramos esa orden entre tus compras.' : err.message))
    })
  }, [id])

  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(reloj)
  }, [])

  const datosQR = useMemo(
    () =>
      orden &&
      qr.obtenerDatosQR({
        id: `ORD-${orden.id}`,
        totalCalculado: Number(orden.total),
        emolientero: { nombre: orden.emolientero.nombre, encargado: orden.emolientero.nombre, telefonoYape: orden.emolientero.telefono ?? undefined },
      }),
    [orden],
  )

  async function pagar(e) {
    e.preventDefault()
    if (enviando) return
    setEnviando(true)
    setError('')
    try {
      setResultado(await pagarOrdenConYape(orden.id, { numeroOperacion, montoIngresado: Number(monto) }))
    } catch (err) {
      // 422: constancia no válida (la reserva se libera); 409: la orden ya no admite pago.
      if (err.status === 422 && err.datos) setResultado(err.datos)
      else setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const vencida = orden && (orden.estado !== 'pendiente_pago' || ahora >= new Date(orden.expiraEn))
  const operacionValida = /^\d{6,10}$/.test(numeroOperacion.trim())

  return (
    <div className="min-h-screen bg-[#f8f3e8] text-[#2b2118] flex flex-col">
      <Encabezado volver={{ href: '#cliente', texto: 'Mi panel' }} />

      <main className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-2xl border border-[#e6dcc8] shadow-sm p-6">
          <p className="text-center text-xs font-bold text-[#742384]">Pago con Yape</p>

          {error && (
            <div role="alert" className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
              {error}
            </div>
          )}
          {!orden && !error && <p className="mt-4 text-center text-sm text-[#9a8670]">Cargando la orden…</p>}

          {orden && resultado?.valido && (
            <div role="status" className="mt-4 text-center">
              <h1 className="text-2xl font-extrabold">¡Pago confirmado!</h1>
              <p className="text-sm text-[#6b4a2f] mt-1">
                Orden #{orden.id} · {soles.format(orden.total)} · {orden.emolientero.nombre}
              </p>
              <p className="mt-5 text-xs font-bold text-[#9a8670]">Tu código de recojo</p>
              <p className="mt-1 font-mono text-4xl font-extrabold tracking-[0.2em] text-emerald-700">{resultado.codigoRecojo}</p>
              <p className="mt-2 text-sm text-[#6b4a2f]">Muéstralo al emolientero al recoger tu pedido. Sirve una sola vez.</p>
              <a href="#cliente" className="inline-block mt-5 px-5 py-2.5 rounded-xl bg-[#2f4a2e] text-white font-bold text-sm">
                Ver mis pedidos
              </a>
            </div>
          )}

          {orden && resultado && !resultado.valido && (
            <div role="alert" className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
              <p className="font-bold">{resultado.mensaje}</p>
              <p className="mt-1">{resultado.detalleError}</p>
              <a href={`#comprar?id=${orden.emolientero.id}`} className="inline-block mt-3 font-bold underline">
                Hacer una nueva compra
              </a>
            </div>
          )}

          {orden && !resultado && (
            <>
              <h1 className="text-center text-2xl font-extrabold mt-1">Orden #{orden.id}</h1>
              <p className="text-center text-sm text-[#6b4a2f]">Para {orden.emolientero.nombre}</p>

              {vencida ? (
                <div className="mt-5 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm text-center">
                  {orden.estado === 'pendiente_pago'
                    ? 'Se acabó el tiempo para pagar esta orden.'
                    : 'Esta orden ya no admite pago (ya se pagó o se canceló).'}{' '}
                  <a href={`#comprar?id=${orden.emolientero.id}`} className="font-bold underline">Hacer una nueva compra</a>
                </div>
              ) : (
                <>
                  <p className="mt-4 text-center text-3xl font-extrabold tabular-nums text-[#2f4a2e]" role="timer">
                    {tiempoRestante(orden.expiraEn, ahora)}
                  </p>
                  <p className="text-center text-xs text-[#9a8670]">para pagar esta orden</p>

                  <div className="mt-5">
                    <CodigoQRYapeSVG payload={datosQR.payloadQR} size={190} />
                  </div>
                  <p className="mt-3 text-center text-sm">
                    Yapea <strong>{soles.format(orden.total)}</strong> al <strong>{datosQR.telefonoDestino}</strong>
                  </p>

                  <form onSubmit={pagar} noValidate className="mt-5 space-y-3">
                    <div>
                      <label htmlFor="operacion" className="block text-sm font-semibold mb-1.5">N.° de operación de Yape</label>
                      <input
                        id="operacion"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={10}
                        placeholder="Ej. 48291035"
                        value={numeroOperacion}
                        onChange={(e) => setNumeroOperacion(e.target.value.replace(/\D/g, ''))}
                        className="w-full rounded-xl border border-[#e6dcc8] px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-200"
                      />
                      <p className="mt-1 text-xs text-[#9a8670]">Entre 6 y 10 dígitos, como aparece en tu constancia.</p>
                    </div>
                    <div>
                      <label htmlFor="monto" className="block text-sm font-semibold mb-1.5">Monto que yapeaste (S/)</label>
                      <input
                        id="monto"
                        inputMode="decimal"
                        value={monto}
                        onChange={(e) => setMonto(e.target.value)}
                        className="w-full rounded-xl border border-[#e6dcc8] px-3.5 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-purple-200"
                      />
                    </div>
                    <p className="text-xs text-[#6b4a2f]">
                      Revisa bien los datos: si la constancia no es válida, la reserva se libera y tendrás que comprar de nuevo.
                    </p>
                    <button
                      type="submit"
                      disabled={!operacionValida || enviando}
                      className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-[#742384] hover:bg-[#5c1b69] disabled:bg-stone-300 disabled:cursor-not-allowed"
                    >
                      {enviando ? 'Validando…' : 'Confirmar pago'}
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
