import { useEffect, useState } from 'react'
import { obtenerResenas } from '../services/consultaResenasService.js'

// US18 - Consultar reseñas y calificación (#resenas?id=<emolientero>).
// Muestra el promedio y el total (T87), el listado de la más reciente a la más antigua (T87)
// y un mensaje claro cuando el emolientero aún no tiene reseñas (T88).

const idDeLaRuta = () => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('id') ?? ''

const fecha = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })

function Estrellas({ valor }) {
  const llenas = Math.round(valor ?? 0)
  return (
    <span className="text-[#e67e22] tracking-wider" aria-label={`${valor ?? 0} de 5 estrellas`}>
      {'★'.repeat(llenas)}
      <span className="text-stone-300">{'★'.repeat(5 - llenas)}</span>
    </span>
  )
}

export default function ResenasEmolientero() {
  const [id] = useState(idDeLaRuta)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null) // { status, mensaje }

  useEffect(() => {
    obtenerResenas(id)
      .then(setDatos)
      .catch((err) => setError({ status: err.status, mensaje: err.message }))
  }, [id])

  const contenido = () => {
    if (error) {
      return (
        <p className="text-center py-10 text-sm text-[#6b5443]">
          {error.status === 404 ? 'Este emolientero no existe o su cuenta no está activa.' : error.mensaje}
        </p>
      )
    }
    if (!datos) return <p className="text-center py-10 text-sm text-[#6b5443]" role="status">Cargando reseñas…</p>

    return (
      <>
        {/* T87: promedio y total */}
        <div className="text-center pb-5 mb-5 border-b border-[#ebe3d9]">
          {datos.total === 0 ? (
            <p className="text-sm text-[#6b5443]">Sin calificación todavía</p>
          ) : (
            <>
              <p className="text-5xl font-extrabold tabular-nums">{datos.promedio.toFixed(1)}</p>
              <Estrellas valor={datos.promedio} />
              <p className="text-sm text-[#6b5443] mt-1">
                {datos.total} {datos.total === 1 ? 'reseña' : 'reseñas'}
              </p>
            </>
          )}
        </div>

        {/* T88: emolientero sin reseñas */}
        {datos.total === 0 ? (
          <div className="text-center py-8 px-4 rounded-2xl bg-[#fbf6ef] border border-dashed border-[#ddd2c4]">
            <p className="font-bold mb-1">Aún no tiene reseñas</p>
            <p className="text-sm text-[#6b5443]">Las reseñas aparecen cuando un cliente recoge su pedido y lo califica.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#ebe3d9]">
            {datos.resenas.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <Estrellas valor={r.calificacion} />
                  <time className="text-xs text-[#9a8676]" dateTime={r.publicadaEn}>
                    {fecha.format(new Date(r.publicadaEn))}
                  </time>
                </div>
                {r.comentario && <p className="text-sm mt-1.5">{r.comentario}</p>}
                <p className="text-xs font-semibold text-[#6b5443] mt-1">{r.autor}</p>
              </li>
            ))}
          </ul>
        )}
      </>
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
          ← Ver catálogo
        </a>
      </header>

      <main className="flex-1 flex justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-xl self-start">
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 text-[#b8581a] mb-2">
              US18 - Reseñas y calificación
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{datos ? datos.emolientero.nombre : 'Reseñas'}</h1>
          </div>
          <div className="bg-white rounded-3xl border border-[#ebe3d9] shadow-xl p-6 sm:p-8">{contenido()}</div>
        </div>
      </main>
    </div>
  )
}
