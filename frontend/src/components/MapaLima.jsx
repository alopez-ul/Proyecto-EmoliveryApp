import MapaGoogle from './MapaGoogle.jsx'
import MapaOSM from './MapaOSM.jsx'

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

// Usa Google Maps si hay API key en frontend/.env; si no, OpenStreetMap.
export default function MapaLima(props) {
  return GOOGLE_API_KEY ? <MapaGoogle apiKey={GOOGLE_API_KEY} {...props} /> : <MapaOSM {...props} />
}
