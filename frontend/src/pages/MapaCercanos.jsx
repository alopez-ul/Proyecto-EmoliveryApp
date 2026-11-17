import Encabezado from '../components/Encabezado.jsx'
import { useEffect, useMemo, useState } from 'react'
import { Circle, MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  CriterioPorCalificacion,
  CriterioPorDistancia,
  EMOLIENTEROS_SEMILLA_LA_MOLINA,
  Localizador,
  MapaController,
  RADIOS_DISPONIBLES_METROS,
  UBICACION_DEFAULT_LA_MOLINA,
  UBICACION_SIN_CERCANOS,
  Ubicacion,
  ZONAS_LA_MOLINA,
} from '../domain/ubicacion/index.js'

// Los paneles técnicos (simuladores, benchmark, bitácora) solo se muestran en modo demostración: agrega ?demo a la ruta.
const modoDemo = () => /[?&]demo\b/.test(window.location.hash)

const CENTRO_LA_MOLINA = [-12.0780, -76.9420]

function crearIconoCliente() {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
        <span style="position:absolute;inset:0;border-radius:9999px;background:rgba(37,99,235,0.25);animation:ping 1.6s cubic-bezier(0,0,0.2,1) infinite;"></span>
        <span style="position:relative;width:20px;height:20px;border-radius:9999px;background:#2563eb;border:3px solid #ffffff;box-shadow:0 4px 10px rgba(37,99,235,0.5);"></span>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

function crearIconoEmolientero(emo, seleccionado) {
  const nivel = emo.infoConfiabilidad?.nivel ?? emo.confiabilidad ?? 'alto'
  const bordeColor =
    seleccionado
      ? '#15803d'
      : nivel === 'alto'
        ? '#b8581a'
        : nivel === 'medio'
          ? '#d97706'
          : '#78716c'

  const distanciaEtiqueta =
    typeof emo.distanciaMetros === 'number' ? `${emo.distanciaMetros}m` : emo.zona

  return L.divIcon({
    className: '',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:${seleccionado ? 'scale(1.12)' : 'scale(1)'};transition:transform 0.15s;">
        <div style="background:#ffffff;border:3px solid ${bordeColor};border-radius:14px;padding:3px 7px;box-shadow:0 6px 16px rgba(43,26,15,0.22);display:flex;align-items:center;gap:4px;white-space:nowrap;">
          <span style="font-size:13px;">🍵</span>
          <span style="font-size:11px;font-weight:800;color:#2b1a0f;">${distanciaEtiqueta}</span>
        </div>
        <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid ${bordeColor};margin-top:-1px;"></div>
      </div>
    `,
    iconSize: [68, 42],
    iconAnchor: [34, 40],
    popupAnchor: [0, -38],
  })
}

function ControladorVistaMapa({ centro, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (centro && Array.isArray(centro) && centro.length === 2) {
      map.flyTo(centro, zoom ?? map.getZoom(), { duration: 0.75 })
    }
  }, [map, centro?.[0], centro?.[1], zoom]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function BadgeConfiabilidadWCAG({ infoConfiabilidad }) {
  const nivel = infoConfiabilidad?.nivel ?? 'alto'
  const estilos =
    nivel === 'alto'
      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
      : nivel === 'medio'
        ? 'bg-amber-50 text-amber-900 border-amber-300'
        : 'bg-stone-100 text-stone-800 border-stone-300'

  return (
    <div className={`inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${estilos}`}>
      <span aria-hidden="true" className="text-xs leading-none">
        {infoConfiabilidad?.icono ?? '●'}
      </span>
      <span>{infoConfiabilidad?.etiqueta ?? 'Confiabilidad ALTA (< 15 min)'}</span>
      {infoConfiabilidad?.descripcionAntiguedad && (
        <span className="font-normal opacity-80">· {infoConfiabilidad.descripcionAntiguedad}</span>
      )}
    </div>
  )
}

export default function MapaCercanos() {
  // T34: Estado del consentimiento explícito de geolocalización (Ley N.° 29733)
  // 'pendiente_consentimiento' | 'otorgado' | 'denegado'
  const [estadoPermiso, setEstadoPermiso] = useState('otorgado')
  const [mostrarModalConsentimiento, setMostrarModalConsentimiento] = useState(true)
  const [coordenadasCliente, setCoordenadasCliente] = useState(UBICACION_DEFAULT_LA_MOLINA)
  const [modoSimulacion, setModoSimulacion] = useState('gps_la_fontana')

  // T36 y T37: Radio de búsqueda en metros y estrategia CriterioOrden
  const [radioMetros, setRadioMetros] = useState(1500)
  const [criterioSeleccionado, setCriterioSeleccionado] = useState('distancia')

  // T39: Búsqueda manual por zonas de La Molina
  const [zonaManual, setZonaManual] = useState('Todas las zonas')
  const [textoManual, setTextoManual] = useState('')
  const [usarBusquedaManual, setUsarBusquedaManual] = useState(false)

  // T40: Estado del Benchmark RNF01 (50 emolienteros activos)
  const [resultadoBenchmark, setResultadoBenchmark] = useState(null)
  const [modoBenchmark50, setModoBenchmark50] = useState(false)

  // Selección activa en el mapa / lista
  const [emolienteroSeleccionado, setEmolienteroSeleccionado] = useState(null)
  const [centroMapa, setCentroMapa] = useState([
    UBICACION_DEFAULT_LA_MOLINA.latitud,
    UBICACION_DEFAULT_LA_MOLINA.longitud,
  ])
  const [zoomMapa, setZoomMapa] = useState(14)

  // Instancia de Localizador (con 18 activos + 2 excluidos por jornada cerrada/expiración, o los 50 del benchmark)
  const localizador = useMemo(() => {
    if (modoBenchmark50 && resultadoBenchmark?.emolienteros) {
      return new Localizador(resultadoBenchmark.emolienteros)
    }
    return new Localizador(EMOLIENTEROS_SEMILLA_LA_MOLINA)
  }, [modoBenchmark50, resultadoBenchmark])

  // Instancia de CriterioOrden (Patrón Strategy - RNF18)
  const estrategiaOrden = useMemo(() => {
    return criterioSeleccionado === 'calificacion'
      ? new CriterioPorCalificacion()
      : new CriterioPorDistancia()
  }, [criterioSeleccionado])

  // Ubicación del cliente encapsulada en la clase de dominio Ubicacion (T35)
  const ubicacionClienteObj = useMemo(() => {
    if (estadoPermiso !== 'otorgado' || !coordenadasCliente) return null
    return new Ubicacion(coordenadasCliente)
  }, [estadoPermiso, coordenadasCliente])

  // Emolienteros cercanos filtrados por radio y ordenados con CriterioOrden (T36, T37)
  const emolienterosCercanos = useMemo(() => {
    if (estadoPermiso !== 'otorgado' || !ubicacionClienteObj) return []
    return localizador.buscarCercanos({
      ubicacionCliente: ubicacionClienteObj,
      radioMetros,
      criterioOrden: estrategiaOrden,
    })
  }, [localizador, estadoPermiso, ubicacionClienteObj, radioMetros, estrategiaOrden])

  // Determina si aplica el caso sin resultados (permiso denegado o 0 emolienteros en el radio)
  const sinResultadosEnRadio =
    estadoPermiso === 'denegado' ||
    (estadoPermiso === 'otorgado' && emolienterosCercanos.length === 0)

  // T39: Lista obtenida por el buscador manual de zonas de La Molina
  const emolienterosPorZona = useMemo(() => {
    return localizador.buscarPorZona({
      zona: zonaManual,
      textoBusqueda: textoManual,
      ubicacionCliente: ubicacionClienteObj,
    })
  }, [localizador, zonaManual, textoManual, ubicacionClienteObj])

  // Lista que se dibuja en el mapa y en las tarjetas laterales
  const listaActiva =
    usarBusquedaManual || sinResultadosEnRadio ? emolienterosPorZona : emolienterosCercanos

  // Acciones de consentimiento y simulación (T34)
  const solicitarGPSRealNavegador = () => {
    setMostrarModalConsentimiento(false)
    if (!('geolocation' in navigator)) {
      simularPermisoOtorgado()
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const candidata = new Ubicacion({ latitud: lat, longitud: lng })
        // Si el navegador devuelve una coordenada fuera de La Molina (ej. otro distrito durante la prueba),
        // situamos al cliente en Av. La Fontana para garantizar experiencia dentro de la zona piloto.
        if (candidata.estaEnLaMolina()) {
          setCoordenadasCliente({
            latitud: lat,
            longitud: lng,
            zona: 'La Molina (GPS Dispositivo)',
            referencia: `GPS real (±${Math.round(pos.coords.accuracy || 15)} m)`,
          })
          setCentroMapa([lat, lng])
        } else {
          setCoordenadasCliente({
            ...UBICACION_DEFAULT_LA_MOLINA,
            referencia: 'Av. La Fontana (Ajustado a zona piloto La Molina)',
          })
          setCentroMapa([UBICACION_DEFAULT_LA_MOLINA.latitud, UBICACION_DEFAULT_LA_MOLINA.longitud])
        }
        setEstadoPermiso('otorgado')
        setUsarBusquedaManual(false)
        setModoSimulacion('gps_real')
        setZoomMapa(15)
      },
      () => {
        simularPermisoDenegado()
      },
      { enableHighAccuracy: true, timeout: 6000 },
    )
  }

  const simularPermisoOtorgado = () => {
    setMostrarModalConsentimiento(false)
    setModoBenchmark50(false)
    setEstadoPermiso('otorgado')
    setCoordenadasCliente(UBICACION_DEFAULT_LA_MOLINA)
    setRadioMetros(1500)
    setUsarBusquedaManual(false)
    setModoSimulacion('gps_la_fontana')
    setCentroMapa([UBICACION_DEFAULT_LA_MOLINA.latitud, UBICACION_DEFAULT_LA_MOLINA.longitud])
    setZoomMapa(15)
  }

  const simularPermisoDenegado = () => {
    setMostrarModalConsentimiento(false)
    setModoBenchmark50(false)
    setEstadoPermiso('denegado')
    setCoordenadasCliente(null)
    setUsarBusquedaManual(true)
    setZonaManual('La Fontana')
    setModoSimulacion('gps_denegado')
    setCentroMapa(CENTRO_LA_MOLINA)
    setZoomMapa(13)
  }

  const simularRadioSinCercanos = () => {
    setMostrarModalConsentimiento(false)
    setModoBenchmark50(false)
    setEstadoPermiso('otorgado')
    setCoordenadasCliente(UBICACION_SIN_CERCANOS)
    setRadioMetros(500)
    setUsarBusquedaManual(false)
    setZonaManual('La Fontana')
    setModoSimulacion('radio_vacio')
    setCentroMapa([UBICACION_SIN_CERCANOS.latitud, UBICACION_SIN_CERCANOS.longitud])
    setZoomMapa(15)
  }

  // T40: Ejecutar Benchmark RNF01 con 50 emolienteros activos
  const ejecutarPruebaRendimiento50 = () => {
    const controller = new MapaController()
    const coords = coordenadasCliente ?? UBICACION_DEFAULT_LA_MOLINA
    const res = controller.ejecutarBenchmarkRNF01(50, coords, 5000)
    setResultadoBenchmark(res)
    setModoBenchmark50(true)
    setEstadoPermiso('otorgado')
    setCoordenadasCliente(coords)
    setRadioMetros(5000)
    setUsarBusquedaManual(false)
    setModoSimulacion('benchmark_50')
    setCentroMapa([coords.latitud, coords.longitud])
    setZoomMapa(13)
  }

  const restaurarSemillaNormal = () => {
    setModoBenchmark50(false)
    setResultadoBenchmark(null)
    simularPermisoOtorgado()
  }

  const seleccionarPuesto = (emo) => {
    setEmolienteroSeleccionado(emo)
    setCentroMapa([emo.latitud, emo.longitud])
    setZoomMapa(16)
  }

  return (
    <div className="min-h-screen bg-[#faf6f0] text-[#2b1a0f] flex flex-col">
      {/* Header Principal */}
      <Encabezado />

      {/* T34: Modal/Banner de Consentimiento Explícito de Geolocalización (Ley N.° 29733) */}
      {mostrarModalConsentimiento && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="titulo-consentimiento-gps"
          className="bg-[#3b2313] text-white px-4 py-4 sm:px-6 border-b border-amber-700/50 shadow-md"
        >
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-1 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-bold">
                <span>🔒</span> Consentimiento Explícito de Geolocalización (Ley N.° 29733)
              </div>
              <h2 id="titulo-consentimiento-gps" className="text-base sm:text-lg font-extrabold">
                ¿Autorizas a EMOLIVERY a utilizar tu ubicación actual para buscar emolienteros cercanos en La Molina?
              </h2>
              <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed">
                Tus coordenadas solo se procesan en esta sesión para calcular la distancia geodésica (fórmula de Haversine)
                hacia los puestos formales con jornada abierta. Si prefieres no compartir tu GPS, puedes buscar manualmente por zonas.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={solicitarGPSRealNavegador}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
              >
                ✓ Autorizar GPS del navegador
              </button>
              <button
                type="button"
                onClick={simularPermisoOtorgado}
                className="px-4 py-2.5 rounded-xl bg-[#e67e22] hover:bg-[#d35400] text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
              >
                📍 Usar ubicación La Fontana (USIL / U. de Lima)
              </button>
              <button
                type="button"
                onClick={simularPermisoDenegado}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-amber-100 font-semibold text-xs sm:text-sm border border-white/20 transition-all cursor-pointer"
              >
                ✕ No autorizar (Búsqueda manual)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Simulación Rápida para Evaluación / Sprint Review (T34, T39, T40) */}
      {modoDemo() && (
      <section
        aria-label="Barra de simulación para evaluación de criterios de aceptación"
        className="bg-[#fbf6ef] border-b border-[#ebe3d9] px-4 py-3 sm:px-6"
      >
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold text-[#b8581a] bg-amber-100 px-2.5 py-1 rounded-lg">
              Simulador Sprint Review:
            </span>
            <button
              type="button"
              onClick={simularPermisoOtorgado}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                modoSimulacion === 'gps_la_fontana'
                  ? 'bg-[#b8581a] text-white border-[#b8581a] shadow-xs'
                  : 'bg-white text-[#2b1a0f] border-[#ddd2c4] hover:bg-amber-50'
              }`}
            >
              1. Permiso GPS Otorgado (Av. La Fontana)
            </button>
            <button
              type="button"
              onClick={simularPermisoDenegado}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                modoSimulacion === 'gps_denegado'
                  ? 'bg-red-700 text-white border-red-700 shadow-xs'
                  : 'bg-white text-[#2b1a0f] border-[#ddd2c4] hover:bg-red-50'
              }`}
            >
              2. Permiso GPS Denegado por el cliente
            </button>
            <button
              type="button"
              onClick={simularRadioSinCercanos}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                modoSimulacion === 'radio_vacio'
                  ? 'bg-amber-700 text-white border-amber-700 shadow-xs'
                  : 'bg-white text-[#2b1a0f] border-[#ddd2c4] hover:bg-amber-50'
              }`}
            >
              3. Radio sin emolienteros cercanos
            </button>
          </div>

          {/* T40: Botón y Evidencia de Rendimiento RNF01 (50 emolienteros activos) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={ejecutarPruebaRendimiento50}
              className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>⚡</span> Ejecutar Benchmark RNF01 (50 Emolienteros Activos)
            </button>
            {modoBenchmark50 && (
              <button
                type="button"
                onClick={restaurarSemillaNormal}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-stone-200 hover:bg-stone-300 text-stone-800 transition-all cursor-pointer"
              >
                Restaurar 18 puestos semilla
              </button>
            )}
          </div>
        </div>

        {/* Badge de Evidencia Técnica T40 (RNF01) */}
        {resultadoBenchmark && (
          <div
            role="status"
            className="max-w-7xl mx-auto mt-2.5 p-3 rounded-2xl bg-emerald-950 text-emerald-100 border border-emerald-600 flex flex-wrap items-center justify-between gap-2 text-xs"
          >
            <div className="flex items-center gap-2 font-bold">
              <span className="px-2 py-0.5 rounded bg-emerald-500 text-emerald-950 font-extrabold uppercase">
                Evidencia RNF01
              </span>
              <span>
                Tiempo de respuesta y renderizado con {resultadoBenchmark.cantidadGenerada} emolienteros:{' '}
                <strong className="text-emerald-300 text-sm">{resultadoBenchmark.duracionMs} ms</strong>{' '}
                (&lt; 3000 ms — {resultadoBenchmark.cumpleRNF01 ? 'CUMPLE RNF01' : 'EXCEDE UMBRAL'})
              </span>
            </div>
            <span className="text-emerald-300/90">
              Haversine (`Ubicacion`) + Filtro Jornada Abierta (`Localizador`) + `CriterioPorDistancia` ejecutados sobre 50 registros activos.
            </span>
          </div>
        )}
      </section>
      )}

      {/* Contenedor Principal: Panel de Controles / Lista + Mapa Interactivo */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Filtros, Caso sin resultados (T39) y Lista ordenada (T38) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Tarjeta de Controles de Radio y Ordenamiento (T36, T37) */}
          <div className="bg-white rounded-2xl border border-[#ebe3d9] p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="text-lg font-extrabold text-[#2b1a0f]">Emolienteros en La Molina</h1>
                <p className="text-xs text-[#6b5443]">
                  {estadoPermiso === 'otorgado' && coordenadasCliente
                    ? `📍 Ubicación cliente: ${coordenadasCliente.referencia}`
                    : '🚫 Permiso GPS denegado · Modo consulta manual por zona'}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-[#b8581a]">
                {listaActiva.length} {listaActiva.length === 1 ? 'puesto activo' : 'puestos activos'}
              </span>
            </div>

            {/* Selector de Radio de Búsqueda (T36) */}
            <div>
              <label className="block text-xs font-bold text-[#6b5443] mb-1.5">
                Radio de búsqueda geodésica:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {RADIOS_DISPONIBLES_METROS.map((r) => (
                  <button
                    key={r.valor}
                    type="button"
                    disabled={estadoPermiso !== 'otorgado'}
                    onClick={() => {
                      setRadioMetros(r.valor)
                      setUsarBusquedaManual(false)
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      !usarBusquedaManual && radioMetros === r.valor
                        ? 'bg-[#b8581a] text-white border-[#b8581a] shadow-xs'
                        : 'bg-[#fbf6ef] text-[#2b1a0f] border-[#ddd2c4] hover:border-[#b8581a]'
                    }`}
                  >
                    {r.etiqueta}
                  </button>
                ))}
              </div>
            </div>

            {/* Selector de Estrategia CriterioOrden (T37 - RNF18) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label
                  htmlFor="select-criterio-orden"
                  className="block text-xs font-bold text-[#6b5443] mb-1"
                >
                  Ordenar por:
                </label>
                <select
                  id="select-criterio-orden"
                  value={criterioSeleccionado}
                  onChange={(e) => setCriterioSeleccionado(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#ddd2c4] bg-[#fbf6ef] text-xs font-bold text-[#2b1a0f]"
                >
                  <option value="distancia">Menor a mayor distancia (m)</option>
                  <option value="calificacion">Mayor calificación promedio (★)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="select-zona-rapida"
                  className="block text-xs font-bold text-[#6b5443] mb-1"
                >
                  Filtrar por zona de La Molina:
                </label>
                <select
                  id="select-zona-rapida"
                  value={zonaManual}
                  onChange={(e) => {
                    setZonaManual(e.target.value)
                    setUsarBusquedaManual(true)
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[#ddd2c4] bg-[#fbf6ef] text-xs font-bold text-[#2b1a0f]"
                >
                  {ZONAS_LA_MOLINA.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* T39: Criterio de Aceptación Inválido Obligatorio y Buscador Manual por Zonas */}
          {sinResultadosEnRadio && (
            <div
              role="alert"
              className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3"
            >
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center font-extrabold text-lg shrink-0">
                  !
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-amber-950">
                    No hay emolienteros cercanos disponibles
                  </h2>
                  <p className="text-xs text-amber-900 mt-0.5">
                    {estadoPermiso === 'denegado'
                      ? 'No se otorgó permiso de geolocalización GPS. Utiliza el buscador manual por zonas de La Molina a continuación:'
                      : `No se encontraron emolienteros con jornada abierta dentro de un radio de ${radioMetros} m. Selecciona una zona de La Molina manualmente o amplía el radio:`}
                  </p>
                </div>
              </div>

              {/* Selector Manual por Zonas de La Molina (T39) */}
              <div className="pt-2 border-t border-amber-200/80 space-y-2.5">
                <label className="block text-xs font-extrabold text-amber-950">
                  Buscador Manual por Zonas de La Molina:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ZONAS_LA_MOLINA.map((zona) => (
                    <button
                      key={zona}
                      type="button"
                      onClick={() => {
                        setZonaManual(zona)
                        setUsarBusquedaManual(true)
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        zonaManual === zona
                          ? 'bg-[#b8581a] text-white shadow-xs'
                          : 'bg-white text-[#2b1a0f] border border-amber-300 hover:bg-amber-100'
                      }`}
                    >
                      {zona}
                    </button>
                  ))}
                </div>
                <input
                  type="search"
                  value={textoManual}
                  onChange={(e) => {
                    setTextoManual(e.target.value)
                    setUsarBusquedaManual(true)
                  }}
                  placeholder="Buscar por avenida, referencia, puesto o código MLM..."
                  className="w-full px-3.5 py-2 rounded-xl border border-amber-300 bg-white text-xs text-[#2b1a0f] placeholder:text-[#9a8676]"
                />
              </div>
            </div>
          )}

          {/* Lista de Tarjetas de Emolienteros Ordenados (T38) */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {listaActiva.map((emo, idx) => {
              const esSeleccionado = emolienteroSeleccionado?.id === emo.id
              return (
                <article
                  key={emo.id}
                  onClick={() => seleccionarPuesto(emo)}
                  className={`bg-white rounded-2xl border p-4 transition-all cursor-pointer shadow-xs hover:shadow-md ${
                    esSeleccionado
                      ? 'border-2 border-[#b8581a] ring-2 ring-amber-200/70'
                      : 'border-[#ebe3d9] hover:border-[#ddd2c4]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="px-2 py-0.5 rounded-md bg-[#fbf6ef] border border-[#ebe3d9] text-[11px] font-extrabold text-[#b8581a]">
                          #{idx + 1}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 text-[11px] font-mono font-bold text-stone-700">
                          {emo.codigoMunicipal}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-[11px] font-bold text-amber-900">
                          {emo.zona}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-base text-[#2b1a0f] leading-snug">{emo.nombre}</h3>
                      <p className="text-xs text-[#6b5443] mt-0.5">{emo.direccionReferencia}</p>
                    </div>

                    {/* Distancia en metros y Calificación promedio (T38) */}
                    <div className="text-right shrink-0">
                      {typeof emo.distanciaMetros === 'number' ? (
                        <span className="inline-block px-2.5 py-1 rounded-xl bg-[#b8581a] text-white font-extrabold text-xs tabular-nums">
                          {emo.distanciaMetros} m
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-1 rounded-xl bg-stone-200 text-stone-700 font-bold text-xs">
                          Zona {emo.zona}
                        </span>
                      )}
                      <div
                        className="mt-1.5 flex items-center justify-end gap-1 text-xs font-extrabold text-amber-700"
                        aria-label={`Calificación promedio ${emo.calificacionPromedio} de 5 estrellas`}
                      >
                        <span aria-hidden="true">★</span>
                        <span>{emo.calificacionPromedio.toFixed(1)}</span>
                        <span className="text-[11px] font-normal text-[#9a8676]">({emo.totalResenas})</span>
                      </div>
                    </div>
                  </div>

                  {/* Especialidad */}
                  <p className="text-xs text-[#6b5443] mt-2 bg-[#fbf6ef] px-3 py-1.5 rounded-lg border border-[#ebe3d9]">
                    🍵 <strong>Especialidad:</strong> {emo.especialidad} · Desde{' '}
                    <strong>S/ {Number(emo.precioDesde ?? 3.5).toFixed(2)}</strong>
                  </p>

                  {/* Indicador de Confiabilidad y Antigüedad accesible (US08 / RNF15 WCAG 2.1 AA) */}
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    <BadgeConfiabilidadWCAG infoConfiabilidad={emo.infoConfiabilidad} />
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Jornada Abierta
                    </span>
                  </div>

                  {/* Acciones hacia US12 (Catálogo) y US14 (Pago con QR de Yape) */}
                  <div
                    className="mt-3 pt-2.5 border-t border-[#ebe3d9] flex flex-wrap items-center justify-end gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a
                      href={`#catalogo?id=${emo.id}`}
                      className="px-3 py-1.5 rounded-xl border border-[#ddd2c4] bg-[#fbf6ef] hover:bg-amber-50 text-xs font-bold text-[#2b1a0f] transition-colors"
                    >
                      Ver Catálogo
                    </a>
                    <a
                      href={`#pago-yape?emolientero=${emo.id}`}
                      className="px-3.5 py-1.5 rounded-xl bg-[#742384] hover:bg-[#5c1b69] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1"
                    >
                      <span>⚡</span> Compra Anticipada / QR Yape
                    </a>
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        {/* Columna Derecha: Mapa Interactivo de La Molina (T33, T38) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="bg-white rounded-2xl border border-[#ebe3d9] p-3 shadow-lg flex-1 min-h-[520px] flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2.5 text-xs text-[#6b5443]">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow-xs" />
                <span className="font-bold text-[#2b1a0f]">Tu ubicación</span>
                <span className="mx-1">·</span>
                <span className="inline-block w-3 h-3 rounded-full bg-[#b8581a]" />
                <span className="font-bold text-[#2b1a0f]">Confiabilidad Alta (&lt;15m)</span>
                <span className="mx-1">·</span>
                <span className="inline-block w-3 h-3 rounded-full bg-amber-600" />
                <span className="font-bold text-[#2b1a0f]">Media (15-60m)</span>
                <span className="mx-1">·</span>
                <span className="inline-block w-3 h-3 rounded-full bg-stone-500" />
                <span className="font-bold text-[#2b1a0f]">Baja (Horario habitual)</span>
              </div>
              <span className="font-mono text-[11px] text-[#9a8676]">
                Distrito: La Molina · Radio activo: {estadoPermiso === 'otorgado' ? `${radioMetros} m` : 'Manual'}
              </span>
            </div>

            <div className="relative flex-1 rounded-2xl overflow-hidden border border-[#ebe3d9] min-h-[470px]">
              <MapContainer
                center={centroMapa}
                zoom={zoomMapa}
                zoomControl={false}
                style={{ width: '100%', height: '100%', minHeight: '470px' }}
              >
                <TileLayer
                  attribution='Tiles &copy; Esri &mdash; OpenStreetMap contributors'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={19}
                />
                <ZoomControl position="bottomright" zoomInTitle="Acercar" zoomOutTitle="Alejar" />
                <ControladorVistaMapa centro={centroMapa} zoom={zoomMapa} />

                {/* Pin y Círculo de Radio del Cliente cuando tiene GPS autorizado */}
                {estadoPermiso === 'otorgado' && coordenadasCliente && (
                  <>
                    <Circle
                      center={[coordenadasCliente.latitud, coordenadasCliente.longitud]}
                      radius={radioMetros}
                      pathOptions={{
                        color: '#b8581a',
                        fillColor: '#e67e22',
                        fillOpacity: 0.1,
                        weight: 2,
                        dashArray: '6 4',
                      }}
                    />
                    <Marker
                      position={[coordenadasCliente.latitud, coordenadasCliente.longitud]}
                      icon={crearIconoCliente()}
                    >
                      <Popup>
                        <div className="text-xs space-y-1">
                          <p className="font-extrabold text-blue-900">📍 Tu ubicación actual (Cliente)</p>
                          <p className="text-stone-700">{coordenadasCliente.referencia}</p>
                          <p className="font-mono text-[11px] text-stone-500">
                            Lat: {coordenadasCliente.latitud.toFixed(4)}, Lng: {coordenadasCliente.longitud.toFixed(4)}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  </>
                )}

                {/* Marcadores de Emolienteros Activos (T38) */}
                {listaActiva.map((emo) => (
                  <Marker
                    key={emo.id}
                    position={[emo.latitud, emo.longitud]}
                    icon={crearIconoEmolientero(emo, emolienteroSeleccionado?.id === emo.id)}
                    eventHandlers={{
                      click: () => setEmolienteroSeleccionado(emo),
                    }}
                  >
                    <Popup>
                      <div className="text-xs space-y-1.5 min-w-[230px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-[#b8581a] font-mono font-bold text-[10px]">
                            {emo.codigoMunicipal}
                          </span>
                          {typeof emo.distanciaMetros === 'number' && (
                            <span className="font-extrabold text-[#b8581a]">{emo.distanciaMetros} m</span>
                          )}
                        </div>
                        <p className="font-extrabold text-sm text-[#2b1a0f] m-0">{emo.nombre}</p>
                        <p className="text-stone-600 m-0">{emo.direccionReferencia}</p>
                        <p className="font-bold text-amber-700 m-0">
                          ★ {emo.calificacionPromedio.toFixed(1)} ({emo.totalResenas} reseñas)
                        </p>
                        <p className="font-semibold text-emerald-800 m-0">
                          {emo.infoConfiabilidad?.icono} {emo.infoConfiabilidad?.etiqueta}
                        </p>
                        <div className="pt-1.5 flex items-center gap-2">
                          <a
                            href={`#pago-yape?emolientero=${emo.id}`}
                            className="px-2.5 py-1 rounded-lg bg-[#742384] text-white font-bold text-[11px] no-underline"
                          >
                            Pagar con Yape
                          </a>
                          <a
                            href={`#catalogo?id=${emo.id}`}
                            className="px-2.5 py-1 rounded-lg bg-amber-100 text-[#2b1a0f] font-bold text-[11px] no-underline"
                          >
                            Catálogo
                          </a>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
