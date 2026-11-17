import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Encabezado, { usuarioDeLaSesion } from '../components/Encabezado.jsx'
import EmolienteIcon from '../components/EmolienteIcon.jsx'
import MapaLima from '../components/MapaLima.jsx'
import { describirConfiabilidad, listarUbicaciones, obtenerPosicionGps } from '../services/ubicacionesService.js'
import { CENTRO_LA_MOLINA, listarUbicacionesEstimadas } from '../services/puntosHabitualesService.js'

// Portada: los emolienteros reales cerca del usuario, en un mapa y en una lista ordenada por distancia.
// - Atendiendo ahora: jornada abierta, con su ubicación más confiable (US05/US08).
// - Suele estar aquí: sin jornada abierta, según su horario habitual (US10, baja precisión).
// Al tocar uno se ve en el mapa; "Ver carta" abre su catálogo (US12).

const REFRESCO_MS = 60_000
const METROS_POR_MINUTO_A_PIE = 80

// Distancia en metros entre dos puntos (fórmula del semiverseno).
function distanciaMetros(a, b) {
  const rad = (g) => (g * Math.PI) / 180
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h))
}

const formatoKm = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })
const textoDistancia = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${formatoKm.format(m / 1000)} km`)
const textoCaminata = (m) => {
  const min = Math.max(1, Math.round(m / METROS_POR_MINUTO_A_PIE))
  return min > 60 ? 'lejos a pie' : `${min} min a pie`
}

export default function MainPage() {
  const [atendiendo, setAtendiendo] = useState(null)
  const [habituales, setHabituales] = useState([])
  const [yo, setYo] = useState(null) // posición del GPS, si el usuario la comparte
  const [estadoGps, setEstadoGps] = useState('inactivo') // inactivo | buscando | error
  const [errorGps, setErrorGps] = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [usuario, setUsuario] = useState(undefined)
  const refsTarjetas = useRef({})

  const cargar = useCallback(() => {
    listarUbicaciones()
      .then((lista) =>
        setAtendiendo(
          lista.map((u) => ({ id: `gps-${u.emolienteroId}`, emolienteroId: u.emolienteroId, nombre: u.nombre, lat: u.lat, lng: u.lng, detalle: describirConfiabilidad(u) })),
        ),
      )
      .catch(() => setAtendiendo([]))
    listarUbicacionesEstimadas()
      .then((lista) =>
        setHabituales(
          lista.map((u) => ({
            id: `habitual-${u.emolienteroId}`,
            emolienteroId: u.emolienteroId,
            nombre: u.nombre,
            lat: u.lat,
            lng: u.lng,
            aproximado: true,
            detalle: `Suele estar en ${u.referencia} de ${u.horaInicio} a ${u.horaFin}`,
          })),
        ),
      )
      .catch(() => setHabituales([]))
  }, [])

  useEffect(() => {
    cargar()
    const intervalo = setInterval(cargar, REFRESCO_MS)
    return () => clearInterval(intervalo)
  }, [cargar])

  useEffect(() => {
    usuarioDeLaSesion().then((u) => setUsuario(u ?? null))
  }, [])

  // Distancia desde el GPS del usuario o, si no lo compartió, desde el centro de La Molina.
  const origen = yo ?? CENTRO_LA_MOLINA
  const cercanos = useMemo(
    () =>
      [...(atendiendo ?? []), ...habituales]
        .map((e) => ({ ...e, activo: true, distancia: distanciaMetros(origen, e) }))
        .sort((a, b) => a.distancia - b.distancia),
    [atendiendo, habituales, origen],
  )

  async function usarMiUbicacion() {
    setErrorGps('')
    setEstadoGps('buscando')
    try {
      const p = await obtenerPosicionGps()
      setYo({ id: 'yo', lat: p.lat, lng: p.lng })
      setSeleccionado({ id: 'yo', lat: p.lat, lng: p.lng })
      setEstadoGps('inactivo')
    } catch (err) {
      setErrorGps(err.message)
      setEstadoGps('error')
    }
  }

  function elegir(e) {
    setSeleccionado(e)
    refsTarjetas.current[e.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const cargando = atendiendo === null

  return (
    <div>
      <Encabezado />
      <div className="inicio">
        <aside className="inicio-panel" aria-label="Emolienteros cerca de ti">
          <div className="inicio-cabecera">
            <h1>¿Se te antoja un emoliente?</h1>
            <p>Estos puestos de La Molina están cerca de ti. Toca uno para verlo en el mapa.</p>
            <div className="inicio-ubicacion" role="status">
              <span>
                {yo ? (
                  <>Distancias desde <strong>tu ubicación</strong></>
                ) : (
                  <>Distancias desde <strong>el centro de La Molina</strong></>
                )}
              </span>
              {!yo && (
                <button type="button" onClick={usarMiUbicacion} disabled={estadoGps === 'buscando'}>
                  {estadoGps === 'buscando' ? 'Buscando…' : 'Usar mi ubicación'}
                </button>
              )}
            </div>
            {errorGps && <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: '#9b2c1f' }}>{errorGps}</p>}
          </div>

          <div className="inicio-lista">
            {cargando && <p style={{ padding: '0 8px', color: 'var(--cafe-suave)' }}>Buscando emolienteros…</p>}

            {!cargando && cercanos.length === 0 && (
              <div className="inicio-vacio">
                <EmolienteIcon size={56} />
                <h3>Nadie está atendiendo en este momento</h3>
                <p>Los emolienteros suelen salir temprano por la mañana y al caer la tarde. Vuelve en un rato.</p>
                {usuario === null && (
                  <p style={{ marginTop: 14 }}>
                    ¿Tienes un puesto?{' '}
                    <a href="#registro-emolientero" style={{ color: 'var(--caramelo)', fontWeight: 700 }}>
                      Regístralo gratis
                    </a>
                  </p>
                )}
              </div>
            )}

            <ul>
              {cercanos.map((e) => (
                <li key={e.id} ref={(el) => (refsTarjetas.current[e.id] = el)}>
                  <div
                    role="button"
                    tabIndex={0}
                    className={`tarjeta-emo ${seleccionado?.id === e.id ? 'is-activa' : ''}`}
                    onClick={() => elegir(e)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault()
                        elegir(e)
                      }
                    }}
                    aria-pressed={seleccionado?.id === e.id}
                  >
                    <span className="tarjeta-emo-icono" aria-hidden="true">
                      <EmolienteIcon size={30} />
                    </span>
                    <div>
                      <h3>{e.nombre}</h3>
                      <span className="tarjeta-emo-estado">
                        <span className={`punto ${e.aproximado ? 'is-aproximado' : ''}`} aria-hidden="true" />
                        {e.aproximado ? 'Suele estar aquí a esta hora' : 'Atendiendo ahora'}
                      </span>
                    </div>
                    <span className="tarjeta-emo-distancia">
                      {textoDistancia(e.distancia)}
                      <small>{textoCaminata(e.distancia)}</small>
                    </span>
                    {seleccionado?.id === e.id && (
                      <span className="tarjeta-emo-acciones">
                        <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--cafe-medio)', alignSelf: 'center' }}>{e.detalle}</span>
                        <a
                          className="ui-boton ui-boton-suave"
                          style={{ padding: '7px 12px', fontSize: '0.85rem' }}
                          href={`https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}&travelmode=walking`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          Cómo llegar
                        </a>
                        <a
                          className="ui-boton ui-boton-primario"
                          style={{ padding: '7px 12px', fontSize: '0.85rem' }}
                          href={`#catalogo?id=${e.emolienteroId}`}
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          Ver carta
                        </a>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="inicio-mapa" aria-label="Mapa">
          <MapaLima
            puntos={cercanos}
            seleccionado={seleccionado}
            onSelect={elegir}
            modoRegistro={false}
            borrador={null}
            onPick={() => {}}
            centro={CENTRO_LA_MOLINA}
            zoom={14}
            yo={yo}
          />
          <div className="inicio-leyenda" aria-hidden="true">
            <span>
              <span className="punto" /> Atendiendo
            </span>
            <span>
              <span className="punto is-aproximado" /> Suele estar
            </span>
            {yo && (
              <span>
                <span className="punto" style={{ background: '#2563eb' }} /> Tú
              </span>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
