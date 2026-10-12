import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Mapa de respaldo (mosaicos de Esri sobre Leaflet) para cuando no hay API key de Google Maps.
const LIMA_CENTER = [-12.0464, -77.0428]

function iconoEmoliente(clases) {
  return L.divIcon({
    className: '',
    html: `<div class="marcador ${clases}"><img src="/emoliente.svg" width="34" height="34" alt="" /></div>`,
    iconSize: [46, 46],
    iconAnchor: [23, 55],
    tooltipAnchor: [0, -58],
  })
}

function CapturarClic({ activo, onPick }) {
  useMapEvents({
    click(e) {
      if (activo) onPick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

function CentrarEnSeleccion({ punto }) {
  const map = useMap()
  useEffect(() => {
    if (punto) map.flyTo([punto.lat, punto.lng], Math.max(map.getZoom(), 15), { duration: 0.8 })
  }, [map, punto?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function MapaOSM({ puntos, seleccionado, onSelect, modoRegistro, borrador, onPick }) {
  return (
    <div className={`mapa-lima ${modoRegistro ? 'is-picking' : ''}`}>
      <MapContainer center={LIMA_CENTER} zoom={12} zoomControl={false} className="mapa-osm">
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
        <ZoomControl position="bottomright" zoomInTitle="Acercar" zoomOutTitle="Alejar" />
        <CapturarClic activo={modoRegistro} onPick={onPick} />
        <CentrarEnSeleccion punto={seleccionado} />
        {puntos.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={iconoEmoliente(
              [p.activo ? '' : 'is-offline', seleccionado?.id === p.id ? 'is-selected' : ''].join(' '),
            )}
            eventHandlers={{ click: () => onSelect(p) }}
          >
            <Tooltip direction="top">{p.nombre}</Tooltip>
          </Marker>
        ))}
        {borrador && <Marker position={[borrador.lat, borrador.lng]} icon={iconoEmoliente('is-draft')} />}
      </MapContainer>
    </div>
  )
}
