import { useEffect } from 'react'
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps'
import EmolienteIcon from './EmolienteIcon.jsx'

const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'
const LIMA_CENTER = { lat: -12.0464, lng: -77.0428 }

function CentrarEnSeleccion({ punto }) {
  const map = useMap()
  useEffect(() => {
    if (map && punto) {
      map.panTo({ lat: punto.lat, lng: punto.lng })
      if (map.getZoom() < 15) map.setZoom(15)
    }
  }, [map, punto?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function MapaGoogle({ apiKey, puntos, seleccionado, onSelect, modoRegistro, borrador, onPick }) {
  return (
    <div className={`mapa-lima ${modoRegistro ? 'is-picking' : ''}`}>
      <APIProvider apiKey={apiKey} language="es" region="PE">
        <Map
          mapId={MAP_ID}
          defaultCenter={LIMA_CENTER}
          defaultZoom={12}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
          clickableIcons={false}
          draggableCursor={modoRegistro ? 'crosshair' : undefined}
          onClick={(e) => {
            if (modoRegistro && e.detail.latLng) onPick(e.detail.latLng)
          }}
        >
          <CentrarEnSeleccion punto={seleccionado} />
          {puntos.map((p) => (
            <AdvancedMarker
              key={p.id}
              position={{ lat: p.lat, lng: p.lng }}
              title={p.nombre}
              onClick={() => onSelect(p)}
            >
              <div
                className={[
                  'marcador',
                  p.activo ? '' : 'is-offline',
                  seleccionado?.id === p.id ? 'is-selected' : '',
                ].join(' ')}
              >
                <EmolienteIcon size={34} />
              </div>
            </AdvancedMarker>
          ))}
          {borrador && (
            <AdvancedMarker position={borrador}>
              <div className="marcador is-draft">
                <EmolienteIcon size={34} />
              </div>
            </AdvancedMarker>
          )}
        </Map>
      </APIProvider>
    </div>
  )
}
