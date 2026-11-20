// US17: el cliente califica (1 a 5 estrellas) y comenta un pedido entregado. Se abre desde "Mis pedidos".
import { useState } from 'react'
import { pedirConSesion } from '../services/authService.js'

const COMENTARIO_MAX = 500 // igual que backend/src/validaciones/resena.js
const TEXTOS = ['', 'Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente']

export const publicarResena = (ordenId, resena) =>
  pedirConSesion(`/resenas/orden/${ordenId}`, { method: 'POST', body: resena })

export default function FormularioResena({ ordenId, emolientero, onPublicada }) {
  const [abierto, setAbierto] = useState(false)
  const [calificacion, setCalificacion] = useState(0)
  const [comentario, setComentario] = useState('')
  const [errores, setErrores] = useState({})
  const [enviando, setEnviando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    const errs = {}
    if (!calificacion) errs.calificacion = 'Elige de 1 a 5 estrellas.'
    if (!comentario.trim()) errs.comentario = 'Cuéntanos qué te pareció.'
    setErrores(errs)
    if (Object.keys(errs).length) return
    setEnviando(true)
    try {
      await publicarResena(ordenId, { calificacion, comentario })
      onPublicada()
    } catch (err) {
      setErrores(err.campos ?? { general: err.message })
    } finally {
      setEnviando(false)
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        style={{ marginTop: 8, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--caramelo)', background: 'transparent', color: 'var(--caramelo)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
      >
        Dejar reseña
      </button>
    )
  }

  return (
    <form onSubmit={enviar} noValidate style={{ marginTop: 10, padding: 12, borderRadius: 10, background: '#fff', border: '1px solid var(--borde)' }}>
      <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '0.9rem' }}>¿Qué te pareció tu pedido de {emolientero}?</p>
      <div role="radiogroup" aria-label="Calificación" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={calificacion === n}
            aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
            onClick={() => setCalificacion(n)}
            style={{ border: 0, background: 'none', padding: 2, fontSize: '1.6rem', lineHeight: 1, cursor: 'pointer', color: n <= calificacion ? '#c9952b' : '#d6c8ad' }}
          >
            ★
          </button>
        ))}
        <span style={{ marginLeft: 8, fontSize: '0.85rem', color: 'var(--cafe-medio)' }}>{TEXTOS[calificacion]}</span>
      </div>
      {errores.calificacion && <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#9b2c1f' }}>{errores.calificacion}</p>}

      <textarea
        rows={3}
        maxLength={COMENTARIO_MAX}
        placeholder="Cuéntanos sobre el sabor, la atención, el tiempo de entrega…"
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        aria-label="Comentario"
        style={{ width: '100%', marginTop: 10, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--borde)', font: 'inherit', fontSize: '0.88rem', resize: 'vertical' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--cafe-suave)' }}>
        <span style={{ color: '#9b2c1f' }}>{errores.comentario ?? errores.general ?? ''}</span>
        <span>{comentario.length}/{COMENTARIO_MAX}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <button type="button" onClick={() => setAbierto(false)} disabled={enviando} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--borde-fuerte)', background: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
          Cancelar
        </button>
        <button type="submit" disabled={enviando} style={{ padding: '7px 14px', borderRadius: 8, border: 0, background: 'var(--caramelo)', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', opacity: enviando ? 0.6 : 1 }}>
          {enviando ? 'Publicando…' : 'Publicar reseña'}
        </button>
      </div>
    </form>
  )
}
