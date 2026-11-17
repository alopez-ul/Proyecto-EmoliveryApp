import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import MapaLima from '../components/MapaLima.jsx'
import MenuPrincipal from '../components/MenuPrincipal.jsx'
import { describirConfiabilidad, listarUbicaciones } from '../services/ubicacionesService.js'
import { listarUbicacionesEstimadas } from '../services/puntosHabitualesService.js'

export default function MainPage() {
  const [puntos, setPuntos] = useState([])

  useEffect(() => {
    api.getPuntos().then(setPuntos).catch(() => setPuntos([]))
  }, [])

  // US05: ubicación de cada emolientero, dibujada con los mismos marcadores del mapa.
  // US08: el detalle muestra la antigüedad del dato y su nivel de confiabilidad.
  const [ubicaciones, setUbicaciones] = useState([])
  useEffect(() => {
    listarUbicaciones()
      .then((lista) =>
        setUbicaciones(
          lista.map((u) => ({
            id: `ubicacion-${u.id}`,
            emolienteroId: u.emolienteroId,
            nombre: u.nombre,
            lat: u.lat,
            lng: u.lng,
            activo: true,
            detalle: describirConfiabilidad(u),
          })),
        ),
      )
      .catch(() => setUbicaciones([]))
  }, [])

  // US10 - T48: ubicación aproximada (PatronHistorico, baja precisión) de quien no tiene la jornada
  // abierta pero suele estar en un punto a esta hora. Marcador punteado para distinguirla del GPS.
  const [estimadas, setEstimadas] = useState([])
  useEffect(() => {
    listarUbicacionesEstimadas()
      .then((lista) =>
        setEstimadas(
          lista.map((u) => ({
            id: `estimada-${u.id}`,
            emolienteroId: u.emolienteroId,
            nombre: u.nombre,
            lat: u.lat,
            lng: u.lng,
            activo: true,
            aproximado: true,
            // US08: el horario habitual siempre tiene confiabilidad baja.
            detalle: `Ubicación aproximada · Confiabilidad baja · suele estar en ${u.referencia} de ${u.horaInicio} a ${u.horaFin}`,
          })),
        ),
      )
      .catch(() => setEstimadas([]))
  }, [])

  return (
    <div className="main-page">
      <header className="barra-superior">
        <MenuPrincipal />
        <h1 className="titulo">Emolivery</h1>
        <div
          style={{
            position: 'absolute',
            right: 20,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <a
            href="#mapa-cercanos"
            className="px-3 py-1.5 rounded-xl bg-[#b8581a] hover:bg-[#9e4a14] text-white text-xs font-bold shadow-xs transition-colors"
            style={{ textDecoration: 'none' }}
          >
            Cercanos (US07)
          </a>
          <a
            href="#pago-yape"
            className="px-3 py-1.5 rounded-xl bg-[#742384] hover:bg-[#5c1b69] text-white text-xs font-bold shadow-xs transition-colors"
            style={{ textDecoration: 'none' }}
          >
            Pago Yape (US14)
          </a>
        </div>
      </header>

      <main className="marco-mapa">
        <MapaLima
          puntos={[...puntos, ...ubicaciones, ...estimadas]}
          seleccionado={null}
          // US12: al tocar un emolientero se abre su catálogo
          onSelect={(p) => {
            if (p.emolienteroId) window.location.hash = `catalogo?id=${p.emolienteroId}`
          }}
          modoRegistro={false}
          borrador={null}
          onPick={() => {}}
        />
      </main>
    </div>
  )
}
