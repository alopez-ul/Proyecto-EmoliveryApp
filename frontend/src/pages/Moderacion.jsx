import { useCallback, useEffect, useState } from 'react'
import { decidirReporte, listarReportes } from '../services/moderacionService.js'

// US25 - Moderación de contenido (#moderacion, solo administrador).
// T104: bandeja de reportes pendientes. T105: ocultar o mantener con el motivo registrado (RNF06).
// T106: al ocultar, baja la reputación del autor. La pestaña "Atendidos" muestra el registro de decisiones.

const fecha = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' })

const ETIQUETA_ESTADO = {
  oculto: 'Oculto',
  mantenido: 'Mantenido',
  contenido_eliminado: 'Eliminado por su autor',
}

function Reporte({ reporte, onDecidido }) {
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function decidir(decision) {
    setError('')
    if (nota.trim().length < 10) return setError('Registra el motivo de la decisión (al menos 10 caracteres).')
    setEnviando(true)
    try {
      const r = await decidirReporte(reporte.id, decision, nota)
      onDecidido(decision === 'ocultar' ? `Reseña ocultada. Reputación de ${reporte.reportado.nombre}: ${r.reputacionReportado}.` : 'Reseña mantenida.')
    } catch (err) {
      // 409 (ya atendido) o 410 (eliminado por su autor): se informa y se recarga la bandeja.
      if (err.status === 409 || err.status === 410) onDecidido(err.message)
      else setError(err.campos?.nota ?? err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <li className="p-4 rounded-2xl border border-[#ebe3d9] bg-[#fbf6ef]">
      <div className="flex flex-wrap justify-between gap-2 text-xs text-[#6b5443]">
        <span>
          Reportado por <strong>{reporte.reportante}</strong> · {fecha.format(new Date(reporte.creadoEn))}
        </span>
        <span>
          Autor: <strong>{reporte.reportado.nombre}</strong> · reputación {reporte.reportado.reputacion}
        </span>
      </div>
      <blockquote className="mt-2 p-3 rounded-xl bg-white border border-[#ebe3d9] text-sm">
        {reporte.calificacion && <span className="text-[#e67e22] mr-2">{'★'.repeat(reporte.calificacion)}</span>}
        {reporte.contenidoActual ?? reporte.contenido ?? <em className="text-[#9a8676]">(sin comentario)</em>}
        {reporte.resenaId == null && <p className="mt-1 text-xs font-semibold text-red-700">El autor eliminó esta reseña.</p>}
      </blockquote>
      <p className="mt-2 text-sm">
        <span className="font-semibold">Motivo del reporte:</span> {reporte.motivo}
      </p>

      <label htmlFor={`nota-${reporte.id}`} className="block mt-3 text-xs font-semibold">Motivo de la decisión (queda registrado)</label>
      <textarea
        id={`nota-${reporte.id}`}
        rows={2}
        maxLength={500}
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        className="w-full mt-1 rounded-xl border border-[#ebe3d9] px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
      />
      {error && <p className="mt-1 text-xs font-medium text-red-600">⚠ {error}</p>}
      <div className="flex gap-2 mt-2">
        <button type="button" disabled={enviando} onClick={() => decidir('ocultar')} className="flex-1 py-2 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-60">
          Ocultar reseña
        </button>
        <button type="button" disabled={enviando} onClick={() => decidir('mantener')} className="flex-1 py-2 rounded-xl border border-[#ddd2c4] bg-white font-bold text-sm hover:bg-[#fbf6ef] disabled:opacity-60">
          Mantener
        </button>
      </div>
    </li>
  )
}

export default function Moderacion() {
  const [pestana, setPestana] = useState('pendientes')
  const [reportes, setReportes] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(() => {
    setReportes(null)
    listarReportes(pestana)
      .then(setReportes)
      .catch((err) => setError(err.status === 403 ? 'Esta sección es solo para administradores.' : err.message))
  }, [pestana])
  useEffect(cargar, [cargar])

  const decidido = (mensaje) => {
    setAviso(mensaje)
    cargar()
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
        <a href="#admin" className="text-sm font-semibold text-[#6b5443] hover:text-[#2b1a0f] transition-colors py-1.5 px-3 rounded-lg hover:bg-[#fbf6ef]">
          ← Panel Administrador
        </a>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="text-center mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 text-[#b8581a] mb-2">
            US25 - Moderación de contenido
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Reportes de reseñas</h1>
        </div>

        <div className="flex gap-2 mb-4" role="tablist">
          {[
            ['pendientes', 'Pendientes'],
            ['atendidos', 'Atendidos (registro)'],
          ].map(([clave, nombre]) => (
            <button
              key={clave}
              type="button"
              role="tab"
              aria-selected={pestana === clave}
              onClick={() => {
                setAviso('')
                setPestana(clave)
              }}
              className={`px-4 py-2 rounded-xl text-sm font-bold ${pestana === clave ? 'bg-[#b8581a] text-white' : 'bg-white border border-[#ebe3d9] text-[#6b5443]'}`}
            >
              {nombre}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-3xl border border-[#ebe3d9] shadow-xl p-5 sm:p-6">
          {aviso && <div role="status" className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium">{aviso}</div>}
          {error && <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium">{error}</div>}
          {!reportes && !error && <p className="text-sm text-[#9a8676]">Cargando…</p>}
          {reportes?.length === 0 && (
            <p className="text-sm text-[#9a8676] text-center py-6">{pestana === 'pendientes' ? 'No hay reportes pendientes.' : 'Aún no hay decisiones registradas.'}</p>
          )}

          {pestana === 'pendientes' ? (
            <ul className="space-y-4">
              {reportes?.map((r) => <Reporte key={r.id} reporte={r} onDecidido={decidido} />)}
            </ul>
          ) : (
            <ul className="divide-y divide-[#ebe3d9]">
              {reportes?.map((r) => (
                <li key={r.id} className="py-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <strong>{ETIQUETA_ESTADO[r.estado]}</strong>
                    <span className="text-xs text-[#9a8676]">{fecha.format(new Date(r.decididoEn))}</span>
                  </div>
                  <p className="text-[#6b5443]">"{r.contenido || 'sin comentario'}" · autor {r.reportado.nombre}</p>
                  <p className="text-xs mt-0.5">
                    Decidió <strong>{r.decididoPor ?? '—'}</strong>: {r.notaDecision}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
