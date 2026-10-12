import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import MapaLima from '../components/MapaLima.jsx'
import MenuPrincipal from '../components/MenuPrincipal.jsx'

export default function MainPage() {
  const [puntos, setPuntos] = useState([])

  useEffect(() => {
    api.getPuntos().then(setPuntos).catch(() => setPuntos([]))
  }, [])

  return (
    <div className="main-page">
      <header className="barra-superior">
        <MenuPrincipal />
        <h1 className="titulo">Emolivery</h1>
      </header>

      <main className="marco-mapa">
        <MapaLima
          puntos={puntos}
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
