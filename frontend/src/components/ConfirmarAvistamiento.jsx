// US09 - T79: el cliente confirma que está viendo al emolientero. Se usa su GPS: debe estar a 100 m o menos
// de la ubicación que muestra el mapa. Si varios clientes coinciden, la ubicación queda verificada (T80).
import { useEffect, useState } from 'react'
import { verificarSesion } from '../services/authService.js'
import { obtenerPosicionGps } from '../services/ubicacionesService.js'
import { RADIO_CONFIRMACION_M, confirmarAvistamiento } from '../services/avistamientosService.js'

export default function ConfirmarAvistamiento({ emolienteroId, nombre }) {
  const [rol, setRol] = useState(undefined) // undefined: cargando; null: sin sesión
  const [estado, setEstado] = useState('inactivo') // inactivo | obteniendo | enviando
  const [resultado, setResultado] = useState(null) // { tipo: 'exito' | 'error' | 'aviso', mensaje }

  useEffect(() => {
    verificarSesion().then((u) => setRol(u?.rol ?? null))
  }, [])

  async function confirmar() {
    setResultado(null)
    try {
      setEstado('obteniendo')
      const posicion = await obtenerPosicionGps()
      setEstado('enviando')
      const r = await confirmarAvistamiento(emolienteroId, posicion)
      setResultado({
        tipo: 'exito',
        mensaje: r.verificado
          ? `¡Gracias! Con tu confirmación, ${r.confirmaciones} clientes coinciden: la ubicación de ${nombre} quedó verificada.`
          : `¡Gracias! Confirmaste que ${nombre} está aquí (a ${r.avistamiento.distanciaM} m de ti).`,
      })
    } catch (err) {
      // 409: ya lo confirmó hace poco; 422: fuera de radio, GPS impreciso o el emolientero dejó de atender.
      setResultado({ tipo: err.status === 409 ? 'aviso' : 'error', mensaje: err.message })
    } finally {
      setEstado('inactivo')
    }
  }

  if (rol === undefined || rol === 'emolientero' || rol === 'admin') return null

  const estilos = {
    exito: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    aviso: 'bg-amber-50 border-amber-200 text-amber-900',
    error: 'bg-red-50 border-red-200 text-red-800',
  }

  return (
    <div className="mb-5 p-4 rounded-2xl bg-[#fbf6ef] border border-[#ebe3d9]">
      <p className="font-bold text-sm">¿Estás viendo a {nombre}?</p>
      <p className="text-xs text-[#6b5443] mt-0.5 mb-3">
        Confírmalo para ayudar a otros clientes. Debes estar a {RADIO_CONFIRMACION_M} m o menos; usaremos tu GPS.
      </p>
      {rol === null ? (
        <a href="#login" className="text-sm font-bold text-[#b8581a] hover:underline">
          Inicia sesión como cliente para confirmar
        </a>
      ) : (
        <button
          type="button"
          onClick={confirmar}
          disabled={estado !== 'inactivo'}
          className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {estado === 'obteniendo' ? 'Obteniendo tu GPS…' : estado === 'enviando' ? 'Confirmando…' : 'Sí, lo estoy viendo aquí'}
        </button>
      )}
      {resultado && (
        <div role={resultado.tipo === 'exito' ? 'status' : 'alert'} className={`mt-3 p-3 rounded-xl border text-sm ${estilos[resultado.tipo]}`}>
          {resultado.mensaje}
        </div>
      )}
    </div>
  )
}
