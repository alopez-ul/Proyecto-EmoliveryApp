import { useEffect, useState } from 'react'
import { obtenerResenas } from '../services/consultaResenasService.js'
import { reportarResena } from '../services/moderacionService.js'
import Encabezado from '../components/Encabezado.jsx'

// US18 - Consultar reseñas y calificación (#resenas?id=<emolientero>).
// Muestra el promedio y el total (T87), el listado de la más reciente a la más antigua (T87)
// y un mensaje claro cuando el emolientero aún no tiene reseñas (T88).

const idDeLaRuta = () => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('id') ?? ''

const fecha = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })

function Estrellas({ valor }) {
  const llenas = Math.round(valor ?? 0)
  return (
    <span className="text-[#6b7a3a] tracking-wider" aria-label={`${valor ?? 0} de 5 estrellas`}>
      {'★'.repeat(llenas)}
      <span className="text-stone-300">{'★'.repeat(5 - llenas)}</span>
    </span>
  )
}

export default function ResenasEmolientero() {
  const [id] = useState(idDeLaRuta)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null) // { status, mensaje }
  const [aviso, setAviso] = useState('')

  // US25: cualquier usuario con sesión puede reportar una reseña (sin sesión, lo lleva al login).
  async function reportar(resena) {
    const motivo = window.prompt('¿Por qué reportas esta reseña? (entre 10 y 300 caracteres)')
    if (motivo === null) return
    try {
      await reportarResena(resena.id, motivo)
      setAviso('Gracias. Un administrador revisará la reseña.')
    } catch (err) {
      setAviso(err.message)
    }
  }

  useEffect(() => {
    obtenerResenas(id)
      .then(setDatos)
      .catch((err) => setError({ status: err.status, mensaje: err.message }))
  }, [id])

  const contenido = () => {
    if (error) {
      return (
        <p className="text-center py-10 text-sm text-[#6b4a2f]">
          {error.status === 404 ? 'Este emolientero no existe o su cuenta no está activa.' : error.mensaje}
        </p>
      )
    }
    if (!datos) return <p className="text-center py-10 text-sm text-[#6b4a2f]" role="status">Cargando reseñas…</p>

    return (
      <>
        {/* T87: promedio y total */}
        <div className="text-center pb-5 mb-5 border-b border-[#e6dcc8]">
          {datos.total === 0 ? (
            <p className="text-sm text-[#6b4a2f]">Sin calificación todavía</p>
          ) : (
            <>
              <p className="text-5xl font-extrabold tabular-nums">{datos.promedio.toFixed(1)}</p>
              <Estrellas valor={datos.promedio} />
              <p className="text-sm text-[#6b4a2f] mt-1">
                {datos.total} {datos.total === 1 ? 'reseña' : 'reseñas'}
              </p>
            </>
          )}
        </div>

        {aviso && (
          <div role="status" className="mb-4 p-3 rounded-xl bg-[#fbf7ee] border border-[#e6dcc8] text-sm text-[#6b4a2f]">
            {aviso}
          </div>
        )}

        {/* T88: emolientero sin reseñas */}
        {datos.total === 0 ? (
          <div className="text-center py-8 px-4 rounded-2xl bg-[#fbf7ee] border border-dashed border-[#d6c8ad]">
            <p className="font-bold mb-1">Aún no tiene reseñas</p>
            <p className="text-sm text-[#6b4a2f]">Las reseñas aparecen cuando un cliente recoge su pedido y lo califica.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#e6dcc8]">
            {datos.resenas.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <Estrellas valor={r.calificacion} />
                  <time className="text-xs text-[#9a8670]" dateTime={r.publicadaEn}>
                    {fecha.format(new Date(r.publicadaEn))}
                  </time>
                </div>
                {r.comentario && <p className="text-sm mt-1.5">{r.comentario}</p>}
                {/* US19: respuesta del emolientero, vinculada bajo la reseña */}
                {r.respuesta && (
                  <div className="mt-2 ml-4 pl-3 border-l-2 border-[#2f4a2e]">
                    <p className="text-xs font-bold text-[#2f4a2e]">Respuesta de {datos.emolientero.nombre}</p>
                    <p className="text-sm mt-0.5">{r.respuesta}</p>
                  </div>
                )}
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs font-semibold text-[#6b4a2f]">{r.autor}</p>
                  <button type="button" onClick={() => reportar(r)} className="text-xs font-semibold text-[#9a8670] hover:text-red-600 hover:underline">
                    Reportar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f3e8] text-[#2b2118] flex flex-col">
      <Encabezado volver={{ href: `#catalogo?id=${encodeURIComponent(id)}`, texto: 'Ver carta' }} />

      <main className="flex-1 flex justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-xl self-start">
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-semibold">{datos ? datos.emolientero.nombre : 'Reseñas'}</h1>
          </div>
          <div className="bg-white rounded-2xl border border-[#e6dcc8] shadow-sm p-6 sm:p-8">{contenido()}</div>
        </div>
      </main>
    </div>
  )
}
