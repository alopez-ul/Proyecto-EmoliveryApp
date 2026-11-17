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

const ICONO_YO = L.divIcon({ className: '', html: '<div class="marcador-yo" title="Estás aquí"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })

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

// centro/zoom: vista inicial (por defecto, Lima). p.aproximado marca una ubicación de baja precisión (US10).
// yo: posición del usuario {lat, lng} (opcional), dibujada como un punto azul.
export default function MapaOSM({ puntos, seleccionado, onSelect, modoRegistro, borrador, onPick, centro, zoom = 12, yo }) {
  return (
    <div className={`mapa-lima ${modoRegistro ? 'is-picking' : ''}`}>
      <MapContainer center={centro ? [centro.lat, centro.lng] : LIMA_CENTER} zoom={zoom} zoomControl={false} className="mapa-osm">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
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
              [p.activo ? '' : 'is-offline', p.aproximado ? 'is-aproximado' : '', seleccionado?.id === p.id ? 'is-selected' : ''].join(' '),
            )}
            eventHandlers={{ click: () => onSelect(p) }}
          >
            <Tooltip direction="top">
              {p.nombre}
              {p.detalle && (
                <>
                  <br />
                  {p.detalle}
                </>
              )}
            </Tooltip>
          </Marker>
        ))}
        {borrador && <Marker position={[borrador.lat, borrador.lng]} icon={iconoEmoliente('is-draft')} />}
        {yo && <Marker position={[yo.lat, yo.lng]} icon={ICONO_YO} interactive={false} zIndexOffset={-100} />}
      </MapContainer>
    </div>
  )
}
