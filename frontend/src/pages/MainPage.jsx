import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import MapaLima from '../components/MapaLima.jsx'
import MenuPrincipal from '../components/MenuPrincipal.jsx'
import { listarUbicaciones } from '../services/ubicacionesService.js'

export default function MainPage() {
  const [puntos, setPuntos] = useState([])

  useEffect(() => {
    api.getPuntos().then(setPuntos).catch(() => setPuntos([]))
  }, [])

  // US05: ubicación actual (GPS) de cada emolientero, dibujada con los mismos marcadores del mapa.
  const [ubicaciones, setUbicaciones] = useState([])
  useEffect(() => {
    listarUbicaciones()
      .then((lista) => setUbicaciones(lista.map((u) => ({ id: `ubicacion-${u.id}`, nombre: u.nombre, lat: u.lat, lng: u.lng, activo: true }))))
      .catch(() => setUbicaciones([]))
  }, [])

  return (
    <div className="main-page">
      <header className="barra-superior">
        <MenuPrincipal />
        <h1 className="titulo">Emolivery</h1>
      </header>

      <main className="marco-mapa">
        <MapaLima
          puntos={[...puntos, ...ubicaciones]}
          seleccionado={null}
          onSelect={() => {}}
          modoRegistro={false}
          borrador={null}
          onPick={() => {}}
        />
      </main>
    </div>
  )
}
