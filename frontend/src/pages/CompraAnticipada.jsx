import { useCallback, useEffect, useMemo, useState } from 'react'
import { obtenerCatalogo } from '../services/catalogoService.js'
import { verificarSesion } from '../services/authService.js'
import {
  CANTIDAD_MAXIMA,
  cambiarCantidad,
  cantidadEnCarrito,
  confirmarCompra,
  guardarCarrito,
  leerCarrito,
  totalCarrito,
} from '../services/compraService.js'

// US13 - Compra anticipada (#comprar?id=<emolientero>).
// El cliente arma su carrito con el catálogo del emolientero (T59) y confirma la compra: el backend valida
// jornada y disponibilidad (T61) y crea la orden Pendiente de pago con vigencia de 15 minutos (T60).

// El catálogo se vuelve a leer cada minuto: el emolientero puede cerrar su jornada o agotar un producto.
const REFRESCO_MS = 60_000

const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })

const idDeLaRuta = () => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('id') ?? ''

// "mm:ss" que faltan para que venza la orden.
function tiempoRestante(expiraEn, ahora) {
  const segundos = Math.max(0, Math.floor((new Date(expiraEn) - ahora) / 1000))
  return `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`
}

function BotonCantidad({ etiqueta, onClick, disabled, children }) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 rounded-lg border border-[#ddd2c4] bg-white font-bold text-[#2b1a0f] hover:bg-[#fbf6ef] disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

// Resumen de la orden recién creada, con la cuenta regresiva de su vigencia.
function OrdenCreada({ orden, onSeguir }) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(reloj)
  }, [])
  const vencida = ahora >= new Date(orden.expiraEn)

  return (
    <div className="text-center">
      <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-900 mb-3">
        {vencida ? 'Orden vencida' : 'Pendiente de pago'}
      </span>
      <h2 className="text-2xl font-extrabold tracking-tight">Orden #{orden.id}</h2>
      <p className="text-sm text-[#6b5443] mt-1">Para {orden.emolientero.nombre}</p>

      <p className={`mt-5 text-4xl font-extrabold tabular-nums ${vencida ? 'text-stone-400' : 'text-[#b8581a]'}`} role="timer">
        {tiempoRestante(orden.expiraEn, ahora)}
      </p>
      <p className="text-sm text-[#6b5443] mt-1">
        {vencida ? 'Se acabó el tiempo para pagar esta orden. Puedes hacer una nueva.' : 'Tienes este tiempo para pagarla con Yape.'}
      </p>

      <ul className="mt-6 text-left divide-y divide-[#ebe3d9] border-y border-[#ebe3d9]">
        {orden.lineas.map((l) => (
          <li key={l.productoId ?? l.nombre} className="flex justify-between gap-3 py-2.5 text-sm">
            <span>
              {l.cantidad} × {l.nombre} <span className="text-[#9a8676]">({soles.format(l.precioUnitario)})</span>
            </span>
            <span className="font-semibold tabular-nums">{soles.format(l.subtotal)}</span>
          </li>
        ))}
      </ul>
      <p className="flex justify-between mt-3 text-base font-extrabold">
        <span>Total</span>
        <span className="tabular-nums">{soles.format(orden.total)}</span>
      </p>

      {/* El pago con QR de Yape es US14: se conectará aquí con esta orden. */}
      <p className="mt-6 p-3 rounded-xl bg-[#fbf6ef] border border-[#ebe3d9] text-xs text-[#6b5443]">
        El precio quedó fijado al confirmar: aunque el emolientero lo cambie, pagarás {soles.format(orden.total)}.
      </p>
      <button type="button" onClick={onSeguir} className="mt-4 text-sm font-bold text-[#b8581a] hover:underline">
        Hacer otra compra
      </button>
    </div>
  )
}

export default function CompraAnticipada() {
  const [id] = useState(idDeLaRuta)
  const [catalogo, setCatalogo] = useState(null)
  const [errorCarga, setErrorCarga] = useState(null) // { status, mensaje }
  const [lineas, setLineas] = useState(() => leerCarrito(idDeLaRuta()))
  const [usuario, setUsuario] = useState(undefined) // undefined: verificando; null: sin sesión
  const [enviando, setEnviando] = useState(false)
  const [errorCompra, setErrorCompra] = useState('')
  const [orden, setOrden] = useState(null)

  const cargar = useCallback(() => {
    obtenerCatalogo(id)
      .then((datos) => {
        setCatalogo(datos)
        setErrorCarga(null)
      })
      .catch((err) => setErrorCarga({ status: err.status, mensaje: err.message }))
  }, [id])

  useEffect(() => {
    cargar()
    const intervalo = setInterval(cargar, REFRESCO_MS)
    return () => clearInterval(intervalo)
  }, [cargar])

  useEffect(() => {
    verificarSesion().then(setUsuario)
  }, [])

  // El carrito se guarda en cada cambio para no perderlo al recargar o al ir a iniciar sesión.
  useEffect(() => guardarCarrito(id, lineas), [id, lineas])

  const productosPorId = useMemo(
    () => new Map((catalogo?.categorias ?? []).flatMap((c) => c.productos).map((p) => [p.id, p])),
    [catalogo],
  )

  const cambiar = (productoId, cantidad) => {
    setErrorCompra('')
    setLineas((actual) => cambiarCantidad(actual, productoId, cantidad))
  }

  // Productos del carrito que ya no se pueden comprar (agotados o retirados del catálogo).
  const problemas = lineas.filter((l) => !productosPorId.get(l.productoId)?.disponible)
  const total = totalCarrito(lineas, productosPorId)
  const esCliente = usuario?.rol === 'cliente'
  const puedeConfirmar = catalogo?.puedeComprar && lineas.length > 0 && problemas.length === 0 && esCliente && !enviando

  async function confirmar() {
    setErrorCompra('')
    setEnviando(true)
    try {
      const creada = await confirmarCompra(id, lineas)
      setOrden(creada)
      setLineas([])
    } catch (err) {
      setErrorCompra(err.message)
      cargar() // T62: si cerró la jornada o se agotó algo, se refleja de inmediato
    } finally {
      setEnviando(false)
    }
  }

  const contenido = () => {
    if (errorCarga) {
      return (
        <p className="text-center py-10 text-sm text-[#6b5443]">
          {errorCarga.status === 404 ? 'Este emolientero no existe o su cuenta no está activa.' : errorCarga.mensaje}
        </p>
      )
    }
    if (!catalogo) return <p className="text-center py-10 text-sm text-[#6b5443]" role="status">Cargando catálogo…</p>
    if (orden) return <OrdenCreada orden={orden} onSeguir={() => setOrden(null)} />

    return (
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Catálogo para agregar al carrito */}
        <section>
          <h2 className="text-lg font-bold mb-3">Productos</h2>
          {!catalogo.puedeComprar && (
            <div role="status" className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
              {catalogo.motivoNoCompra}
            </div>
          )}
          {catalogo.categorias.length === 0 && <p className="text-sm text-[#9a8676]">Este emolientero todavía no ha publicado sus productos.</p>}
          {catalogo.categorias.map((categoria) => (
            <div key={categoria.id} className="mb-4">
              <h3 className="text-xs font-bold text-[#9a8676] uppercase tracking-wider pb-1.5 border-b border-[#ebe3d9]">{categoria.nombre}</h3>
              <ul className="divide-y divide-[#ebe3d9]">
                {categoria.productos.map((p) => {
                  const enCarrito = cantidadEnCarrito(lineas, p.id)
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${p.disponible ? '' : 'text-[#9a8676] line-through'}`}>{p.nombre}</p>
                        <p className="text-xs font-mono font-bold text-[#b8581a]">{soles.format(p.precio)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => cambiar(p.id, enCarrito + 1)}
                        disabled={!p.comprable || enCarrito >= CANTIDAD_MAXIMA}
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-[#b8581a] text-white font-bold text-xs hover:bg-[#9e4a14] disabled:bg-stone-200 disabled:text-stone-500 disabled:cursor-not-allowed"
                      >
                        {p.disponible ? (enCarrito ? `Agregar otro (${enCarrito})` : 'Agregar') : 'Agotado'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </section>

        {/* Carrito (T59) */}
        <section className="lg:border-l lg:border-[#ebe3d9] lg:pl-6">
          <h2 className="text-lg font-bold mb-3">Tu carrito</h2>
          {lineas.length === 0 ? (
            <p className="text-sm text-[#9a8676] py-6 text-center rounded-2xl bg-[#fbf6ef] border border-dashed border-[#ddd2c4]">
              Tu carrito está vacío. Agrega productos para comprar.
            </p>
          ) : (
            <ul className="divide-y divide-[#ebe3d9]">
              {lineas.map((l) => {
                const p = productosPorId.get(l.productoId)
                return (
                  <li key={l.productoId} className="py-3">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="font-semibold">{p?.nombre ?? 'Producto retirado del catálogo'}</span>
                      <span className="font-semibold tabular-nums">{p ? soles.format(p.precio * l.cantidad) : '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <BotonCantidad etiqueta="Quitar uno" onClick={() => cambiar(l.productoId, l.cantidad - 1)}>−</BotonCantidad>
                      <span className="w-6 text-center text-sm font-bold tabular-nums">{l.cantidad}</span>
                      <BotonCantidad
                        etiqueta="Agregar uno"
                        onClick={() => cambiar(l.productoId, l.cantidad + 1)}
                        disabled={!p?.comprable || l.cantidad >= CANTIDAD_MAXIMA}
                      >
                        +
                      </BotonCantidad>
                      <button type="button" onClick={() => cambiar(l.productoId, 0)} className="ml-auto text-xs font-bold text-red-600 hover:underline">
                        Quitar
                      </button>
                    </div>
                    {!p?.disponible && <p className="mt-1 text-xs font-medium text-red-600">⚠ Ya no está disponible. Quítalo para continuar.</p>}
                  </li>
                )
              })}
            </ul>
          )}

          <p className="flex justify-between mt-4 pt-3 border-t border-[#ebe3d9] text-base font-extrabold">
            <span>Total</span>
            <span className="tabular-nums">{soles.format(total)}</span>
          </p>

          {errorCompra && (
            <div role="alert" className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium">
              {errorCompra}
            </div>
          )}
          {usuario === null && (
            <p className="mt-4 text-sm text-[#6b5443]">
              Para confirmar, <a href="#login" className="font-bold text-[#b8581a] hover:underline">inicia sesión como cliente</a>. Tu carrito se guarda.
            </p>
          )}
          {usuario && !esCliente && <p className="mt-4 text-sm text-[#6b5443]">Solo una cuenta de cliente puede comprar.</p>}

          <button
            type="button"
            onClick={confirmar}
            disabled={!puedeConfirmar}
            className="w-full mt-4 py-3.5 rounded-xl font-bold text-sm text-white shadow-md bg-gradient-to-r from-[#b8581a] to-[#e67e22] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enviando ? 'Confirmando…' : 'Confirmar compra'}
          </button>
          <p className="mt-2 text-xs text-center text-[#9a8676]">Tendrás 15 minutos para pagar con Yape después de confirmar.</p>
        </section>
      </div>
    )
  }

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
          href={`#catalogo?id=${encodeURIComponent(id)}`}
          className="text-sm font-semibold text-[#6b5443] hover:text-[#2b1a0f] transition-colors py-1.5 px-3 rounded-lg hover:bg-[#fbf6ef]"
        >
          ← Volver al catálogo
        </a>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="text-center mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 text-[#b8581a] mb-2">
            US13 - Compra anticipada
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{catalogo ? `Comprar a ${catalogo.emolientero.nombre}` : 'Compra anticipada'}</h1>
        </div>
        <div className="bg-white rounded-3xl border border-[#ebe3d9] shadow-xl p-5 sm:p-6">{contenido()}</div>
      </main>

      <footer className="py-4 text-center text-xs text-[#9a8676]">
        EMOLIVERY &copy; {new Date().getFullYear()} - Plataforma de Emolientes Tradicionales de Lima
      </footer>
    </div>
  )
}
