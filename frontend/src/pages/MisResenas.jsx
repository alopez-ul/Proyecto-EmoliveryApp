import { useCallback, useEffect, useState } from 'react'
import { RESPUESTA_MAX, misResenas, responderResena } from '../services/respuestasService.js'
import Encabezado from '../components/Encabezado.jsx'

// US19 - Respuesta del emolientero (Renzo - Release 2 / Sprint 2)
// El emolientero ve las reseñas de su negocio y responde cada una una sola vez (T90). No puede responder
// las ocultas por moderación ni volver a responder (T91): el formulario no aparece y el backend lo rechaza.

const fecha = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' })

function Estrellas({ valor }) {
  return (
    <span className="text-[#b8581a] tracking-wider" aria-label={`${valor} de 5 estrellas`}>
      {'★'.repeat(valor)}
      <span className="text-[#ddd2c4]">{'★'.repeat(5 - valor)}</span>
    </span>
  )
}

function FormularioRespuesta({ resena, onRespondida }) {
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const idCampo = `respuesta-${resena.id}`

  async function enviar(ev) {
    ev.preventDefault()
    if (texto.trim().length < 2) return setError('Escribe tu respuesta.')
    setEnviando(true)
    setError('')
    try {
      onRespondida(await responderResena(resena.id, texto))
    } catch (err) {
      setError(err.message)
      // 409: ya se respondió u ocultó mientras escribía; se recarga para mostrar el estado real.
      if (err.status === 409) onRespondida(null)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="mt-3">
      <label htmlFor={idCampo} className="block text-xs font-bold text-[#6b5443] mb-1.5">
        Tu respuesta
      </label>
      <textarea
        id={idCampo}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          setError('')
        }}
        maxLength={RESPUESTA_MAX}
        rows={3}
        placeholder="Ej.: ¡Gracias por tu visita! Te esperamos mañana."
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${idCampo}-error` : undefined}
        className="w-full px-3 py-2 rounded-xl border border-[#ddd2c4] bg-[#fbf6ef] text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-[#b8581a]"
      />
      <div className="flex items-center justify-between mt-1.5 gap-3">
        <span className="text-xs text-[#9a8676]">
          {texto.trim().length}/{RESPUESTA_MAX} · Solo puedes responder una vez.
        </span>
        <button
          type="submit"
          disabled={enviando}
          className="px-4 py-2 rounded-xl bg-[#b8581a] text-white font-bold text-xs hover:bg-[#9e4a14] disabled:opacity-60"
        >
          {enviando ? 'Publicando…' : 'Publicar respuesta'}
        </button>
      </div>
      {error && (
        <p id={`${idCampo}-error`} role="alert" className="mt-1 text-xs text-red-600 font-medium">
          ⚠ {error}
        </p>
      )}
    </form>
  )
}

export default function MisResenas() {
  const [resenas, setResenas] = useState(null)
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    misResenas()
      .then(setResenas)
      .catch((err) => setError(err.status === 403 ? 'Esta sección es solo para emolienteros.' : err.message))
  }, [])

  useEffect(cargar, [cargar])

  const sinResponder = resenas?.filter((r) => !r.respuesta && !r.oculta).length ?? 0

  return (
    <div className="min-h-screen bg-[#faf6f0] text-[#2b1a0f] flex flex-col">
      <Encabezado volver={{ href: '#emolientero', texto: 'Mi puesto' }} />

      <main className="flex-1 flex justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-xl bg-white rounded-2xl border border-[#ebe3d9] shadow-sm p-6 sm:p-8 self-start">
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-semibold">Mis reseñas</h1>
            <p className="text-sm text-[#6b5443] mt-1.5">
              {resenas
                ? sinResponder
                  ? `Tienes ${sinResponder} reseña${sinResponder > 1 ? 's' : ''} sin responder.`
                  : 'Respondiste todas tus reseñas.'
                : 'Responde a tus clientes para aclarar o agradecer sus comentarios.'}
            </p>
          </div>

          {error ? (
            <p role="alert" className="text-center text-sm text-red-600 font-semibold py-6">
              {error}
            </p>
          ) : !resenas ? (
            <p role="status" className="text-center text-sm text-[#6b5443] py-6">
              Cargando reseñas…
            </p>
          ) : resenas.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-2xl bg-[#fbf6ef] border border-dashed border-[#ddd2c4]">
              <p className="font-bold mb-1">Aún no tienes reseñas</p>
              <p className="text-sm text-[#6b5443]">Aparecen cuando un cliente recoge su pedido y lo califica.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#ebe3d9]">
              {resenas.map((r) => (
                <li key={r.id} className="py-4">
                  <div className="flex items-center justify-between gap-3">
                    <Estrellas valor={r.calificacion} />
                    <time className="text-xs text-[#9a8676]" dateTime={r.publicadaEn}>
                      {fecha.format(new Date(r.publicadaEn))}
                    </time>
                  </div>
                  {r.comentario && <p className="text-sm mt-1.5">{r.comentario}</p>}
                  <p className="text-xs font-semibold text-[#6b5443] mt-1">{r.autor}</p>

                  {r.oculta ? (
                    <p className="mt-3 p-3 rounded-xl bg-stone-100 text-xs text-stone-700">
                      Esta reseña fue ocultada por moderación: ya no es pública y no admite respuesta.
                    </p>
                  ) : r.respuesta ? (
                    <div className="mt-3 ml-4 pl-3 border-l-2 border-[#b8581a]">
                      <p className="text-xs font-bold text-[#b8581a]">Tu respuesta</p>
                      <p className="text-sm mt-0.5">{r.respuesta}</p>
                    </div>
                  ) : (
                    <FormularioRespuesta resena={r} onRespondida={cargar} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
