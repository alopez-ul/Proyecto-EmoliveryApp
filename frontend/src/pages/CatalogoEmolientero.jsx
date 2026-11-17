import { useCallback, useEffect, useState } from 'react'
import { obtenerCatalogo } from '../services/catalogoService.js'
import ConfirmarAvistamiento from '../components/ConfirmarAvistamiento.jsx'
import Encabezado from '../components/Encabezado.jsx'
import BotonFavorito from '../components/BotonFavorito.jsx'

// US12 - Consulta de catálogo y precios (Renzo - Sprint 2)
// Vista pública: el cliente la abre desde el mapa (#catalogo?id=<emolientero>). Agrupa por categoría (T54),
// muestra precio y disponibilidad (T55) y deshabilita la compra fuera de jornada (T56).

// La jornada puede abrirse o cerrarse mientras el cliente mira el catálogo.
const REFRESCO_MS = 60_000

const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })

const idDeLaRuta = () => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('id') ?? ''

function Estado({ titulo, children }) {
  return (
    <div className="text-center py-10">
      <h2 className="font-bold text-lg text-[#2b1a0f] mb-1">{titulo}</h2>
      <p className="text-sm text-[#6b5443] mb-5">{children}</p>
      <a href="#inicio" className="px-5 py-2.5 rounded-xl bg-[#b8581a] text-white font-bold text-sm hover:bg-[#9e4a14] transition-all">
        Volver al mapa
      </a>
    </div>
  )
}

function Producto({ producto, motivoNoCompra, onComprar }) {
  const motivoId = `motivo-${producto.id}`
  const motivo = !producto.disponible ? 'Producto agotado por hoy.' : motivoNoCompra
  return (
    <li className="flex items-center gap-4 py-3.5">
      <div className="flex-1 min-w-0">
        <p className={`font-bold text-sm ${producto.disponible ? 'text-[#2b1a0f]' : 'text-[#9a8676] line-through'}`}>{producto.nombre}</p>
        {producto.descripcion && <p className="text-xs text-[#6b5443] mt-0.5">{producto.descripcion}</p>}
        <span
          className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
            producto.disponible ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-600'
          }`}
        >
          <span aria-hidden="true">{producto.disponible ? '●' : '○'}</span>
          {producto.disponible ? 'Disponible' : 'Agotado'}
        </span>
      </div>
      <div className="text-right shrink-0">
        <p className="font-extrabold text-base text-[#2b1a0f] tabular-nums">{soles.format(producto.precio)}</p>
        <button
          type="button"
          onClick={() => onComprar(producto)}
          disabled={!producto.comprable}
          aria-describedby={producto.comprable ? undefined : motivoId}
          className="mt-1.5 px-3.5 py-1.5 rounded-lg bg-[#b8581a] text-white font-bold text-xs hover:bg-[#9e4a14] transition-all disabled:bg-stone-200 disabled:text-stone-500 disabled:cursor-not-allowed"
        >
          Comprar
        </button>
        {!producto.comprable && (
          <span id={motivoId} className="sr-only">
            {motivo}
          </span>
        )}
      </div>
    </li>
  )
}

export default function CatalogoEmolientero() {
  const [id] = useState(idDeLaRuta)
  const [catalogo, setCatalogo] = useState(null)
  const [error, setError] = useState(null) // { status, mensaje }
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(() => {
    obtenerCatalogo(id)
      .then((datos) => {
        setCatalogo(datos)
        setError(null)
      })
      .catch((err) => setError({ status: err.status, mensaje: err.message }))
  }, [id])

  useEffect(() => {
    cargar()
    const intervalo = setInterval(cargar, REFRESCO_MS)
    return () => clearInterval(intervalo)
  }, [cargar])

  // La compra anticipada (orden, pago con QR de Yape) es US13; aquí solo se habilita o no el botón.
  const comprar = (producto) => setAviso(`Pronto podrás reservar "${producto.nombre}" y pagarlo con Yape desde aquí.`)

  const enJornada = catalogo?.emolientero.enJornada
  const cantidad = catalogo?.categorias.reduce((n, c) => n + c.productos.length, 0) ?? 0

  return (
    <div className="min-h-screen bg-[#faf6f0] text-[#2b1a0f] flex flex-col">
      <Encabezado volver={{ href: '#inicio', texto: 'Volver al mapa' }} />

      <main className="flex-1 flex justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-xl bg-white rounded-2xl border border-[#ebe3d9] shadow-sm p-6 sm:p-8 self-start">
          {error ? (
            error.status === 404 ? (
              <Estado titulo="Emolientero no disponible">Este emolientero no existe o su cuenta no está activa.</Estado>
            ) : (
              <Estado titulo="No se pudo cargar el catálogo">{error.mensaje}</Estado>
            )
          ) : !catalogo ? (
            <p className="text-center text-sm text-[#6b5443] py-10" role="status">
              Cargando catálogo…
            </p>
          ) : (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl sm:text-3xl font-semibold text-[#2b1a0f]">{catalogo.emolientero.nombre}</h1>
                <span
                  className={`inline-flex items-center gap-2 mt-3 px-3 py-1 rounded-full text-xs font-bold ${
                    enJornada ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${enJornada ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`} aria-hidden="true" />
                  {enJornada ? 'Atendiendo ahora' : 'Fuera de jornada'}
                </span>
                <BotonFavorito emolienteroId={catalogo.emolientero.id} />
              </div>

              {/* US09: con la jornada abierta, el cliente puede confirmar que lo está viendo */}
              {enJornada && <ConfirmarAvistamiento emolienteroId={catalogo.emolientero.id} nombre={catalogo.emolientero.nombre} />}

              {/* T56: la compra se deshabilita fuera de jornada; el catálogo se sigue viendo */}
              {!catalogo.puedeComprar && cantidad > 0 && (
                <div role="status" className="mb-5 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
                  <p className="font-bold mb-0.5">Compra no disponible</p>
                  <p>{catalogo.motivoNoCompra}</p>
                </div>
              )}

              {aviso && (
                <div role="status" className="mb-5 p-3 rounded-xl bg-[#fbf6ef] border border-[#ebe3d9] text-sm text-[#6b5443]">
                  {aviso}
                </div>
              )}

              {cantidad === 0 ? (
                <div className="text-center py-8 px-4 rounded-2xl bg-[#fbf6ef] border border-dashed border-[#ddd2c4]">
                  <p className="font-bold text-[#2b1a0f] mb-1">Catálogo vacío</p>
                  <p className="text-sm text-[#6b5443]">Este emolientero todavía no ha publicado sus productos.</p>
                </div>
              ) : (
                catalogo.categorias.map((categoria) => (
                  <section key={categoria.id} aria-labelledby={`cat-${categoria.id}`} className="mb-5 last:mb-0">
                    <h2
                      id={`cat-${categoria.id}`}
                      className="text-xs font-bold text-[#9a8676] pb-2 border-b border-[#ebe3d9]"
                    >
                      {categoria.nombre}
                    </h2>
                    <ul className="divide-y divide-[#ebe3d9]">
                      {categoria.productos.map((p) => (
                        <Producto key={p.id} producto={p} motivoNoCompra={catalogo.motivoNoCompra} onComprar={comprar} />
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
