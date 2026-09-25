import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import MapaLima from '../components/MapaLima.jsx'
import MenuEmoliente from '../components/MenuEmoliente.jsx'

export default function MainPage() {
  const [puntos, setPuntos] = useState([])

  useEffect(() => {
    api.getPuntos().then(setPuntos).catch(() => setPuntos([]))
  }, [])

  return (
    <div className="main-page">
      <MapaLima
        puntos={puntos}
        seleccionado={null}
        onSelect={() => {}}
        modoRegistro={false}
        borrador={null}
        onPick={() => {}}
      />

      <header className="topbar panel">
        <div className="brand">
          <MenuEmoliente />
          <div>
            <h1>Emolientes Lima</h1>
            <span className="subtitle">Encuentra tu emoliente de cada día</span>
          </div>
        </div>
      </header>
    </div>
  )
}
