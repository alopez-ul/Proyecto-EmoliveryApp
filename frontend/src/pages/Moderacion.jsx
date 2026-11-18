import { useCallback, useEffect, useState } from 'react'
import { decidirReporte, listarReportes } from '../services/moderacionService.js'
import Encabezado from '../components/Encabezado.jsx'

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
    <li className="p-4 rounded-2xl border border-[#e6dcc8] bg-[#fbf7ee]">
      <div className="flex flex-wrap justify-between gap-2 text-xs text-[#6b4a2f]">
        <span>
          Reportado por <strong>{reporte.reportante}</strong> · {fecha.format(new Date(reporte.creadoEn))}
        </span>
        <span>
          Autor: <strong>{reporte.reportado.nombre}</strong> · reputación {reporte.reportado.reputacion}
        </span>
      </div>
      <blockquote className="mt-2 p-3 rounded-xl bg-white border border-[#e6dcc8] text-sm">
        {reporte.calificacion && <span className="text-[#6b7a3a] mr-2">{'★'.repeat(reporte.calificacion)}</span>}
        {reporte.contenidoActual ?? reporte.contenido ?? <em className="text-[#9a8670]">(sin comentario)</em>}
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
        className="w-full mt-1 rounded-xl border border-[#e6dcc8] px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#d6dcb0]"
      />
      {error && <p className="mt-1 text-xs font-medium text-red-600">⚠ {error}</p>}
      <div className="flex gap-2 mt-2">
        <button type="button" disabled={enviando} onClick={() => decidir('ocultar')} className="flex-1 py-2 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-60">
          Ocultar reseña
        </button>
        <button type="button" disabled={enviando} onClick={() => decidir('mantener')} className="flex-1 py-2 rounded-xl border border-[#d6c8ad] bg-white font-bold text-sm hover:bg-[#fbf7ee] disabled:opacity-60">
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
    <div className="min-h-screen bg-[#f8f3e8] text-[#2b2118] flex flex-col">
      <Encabezado volver={{ href: '#admin', texto: 'Administración' }} />

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold">Reportes de reseñas</h1>
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
              className={`px-4 py-2 rounded-xl text-sm font-bold ${pestana === clave ? 'bg-[#2f4a2e] text-white' : 'bg-white border border-[#e6dcc8] text-[#6b4a2f]'}`}
            >
              {nombre}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-[#e6dcc8] shadow-sm p-5 sm:p-6">
          {aviso && <div role="status" className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium">{aviso}</div>}
          {error && <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium">{error}</div>}
          {!reportes && !error && <p className="text-sm text-[#9a8670]">Cargando…</p>}
          {reportes?.length === 0 && (
            <p className="text-sm text-[#9a8670] text-center py-6">{pestana === 'pendientes' ? 'No hay reportes pendientes.' : 'Aún no hay decisiones registradas.'}</p>
          )}

          {pestana === 'pendientes' ? (
            <ul className="space-y-4">
              {reportes?.map((r) => <Reporte key={r.id} reporte={r} onDecidido={decidido} />)}
            </ul>
          ) : (
            <ul className="divide-y divide-[#e6dcc8]">
              {reportes?.map((r) => (
                <li key={r.id} className="py-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <strong>{ETIQUETA_ESTADO[r.estado]}</strong>
                    <span className="text-xs text-[#9a8670]">{fecha.format(new Date(r.decididoEn))}</span>
                  </div>
                  <p className="text-[#6b4a2f]">"{r.contenido || 'sin comentario'}" · autor {r.reportado.nombre}</p>
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
