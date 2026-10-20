// US05: el emolientero registra su ubicación actual con el GPS del dispositivo.
import { useEffect, useState } from 'react'
import { estilos } from './AuthCard.jsx'
import { miUbicacion, obtenerPosicionGps, registrarUbicacion } from '../services/ubicacionesService.js'

const formatoFecha = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' })

export default function RegistroUbicacion() {
  const [ultima, setUltima] = useState(null)
  const [estado, setEstado] = useState('inactivo') // inactivo | obteniendo | guardando
  const [error, setError] = useState('')

  useEffect(() => {
    miUbicacion().then(setUltima).catch(() => {})
  }, [])

  async function registrar() {
    setError('')
    try {
      setEstado('obteniendo')
      const posicion = await obtenerPosicionGps()
      setEstado('guardando')
      setUltima(await registrarUbicacion(posicion))
    } catch (err) {
      setError(err.message)
    } finally {
      setEstado('inactivo')
    }
  }

  const ocupado = estado !== 'inactivo'
  return (
    <div style={{ margin: '0 0 18px' }}>
      <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem' }}>Mi ubicación</h3>
      {error && <div style={estilos.error} role="alert">{error}</div>}
      {ultima && !error && (
        <div style={estilos.exito}>
          Ubicación registrada el {formatoFecha.format(new Date(ultima.registradaEn))} (precisión ≈ {Math.round(ultima.precisionM)} m).
          Con tu jornada abierta, los clientes te ven en el mapa.
        </div>
      )}
      {!ultima && !error && (
        <p style={{ margin: '0 0 10px', fontSize: '0.88rem', color: 'var(--cafe-medio)' }}>
          Aún no has registrado tu ubicación. Los clientes no pueden verte en el mapa.
        </p>
      )}
      <button type="button" style={{ ...estilos.boton, opacity: ocupado ? 0.7 : 1 }} disabled={ocupado} onClick={registrar}>
        {estado === 'obteniendo' ? 'Obteniendo GPS…' : estado === 'guardando' ? 'Guardando…' : ultima ? 'Actualizar mi ubicación' : 'Registrar mi ubicación'}
      </button>
    </div>
  )
}
