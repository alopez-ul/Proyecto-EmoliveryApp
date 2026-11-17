// US21: el cliente guarda o quita a un emolientero de sus favoritos desde su carta.
import { useEffect, useState } from 'react'
import { usuarioDeLaSesion } from './Encabezado.jsx'
import { desmarcarFavorito, marcarFavorito, misFavoritos } from '../services/favoritosService.js'

export default function BotonFavorito({ emolienteroId }) {
  const [rol, setRol] = useState(undefined)
  const [favorito, setFavorito] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    usuarioDeLaSesion().then((u) => {
      setRol(u?.rol ?? null)
      if (u?.rol === 'cliente') misFavoritos().then((d) => setFavorito(d.favoritos.some((f) => f.id === emolienteroId))).catch(() => {})
    })
  }, [emolienteroId])

  if (rol !== 'cliente' && rol !== null) return null

  async function alternar() {
    if (rol === null) {
      window.location.hash = 'login'
      return
    }
    setOcupado(true)
    try {
      if (favorito) await desmarcarFavorito(emolienteroId)
      else await marcarFavorito(emolienteroId)
      setFavorito(!favorito)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={ocupado}
      aria-pressed={favorito}
      className={`inline-flex items-center gap-1.5 mt-3 ml-2 px-3 py-1 rounded-full text-xs font-bold border transition-colors disabled:opacity-60 ${
        favorito ? 'bg-[#fbe8d3] border-[#fbe8d3] text-[#b4531a]' : 'border-[#ddcfbe] text-[#6b5443] hover:text-[#b4531a]'
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill={favorito ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      </svg>
      {favorito ? 'En tus favoritos' : 'Guardar en favoritos'}
    </button>
  )
}
