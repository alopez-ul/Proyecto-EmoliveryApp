import { useCallback, useEffect, useState } from 'react'
import Encabezado, { usuarioDeLaSesion } from '../components/Encabezado.jsx'
import EmolienteIcon from '../components/EmolienteIcon.jsx'
import {
  desmarcarFavorito,
  directorioEmolienteros,
  guardarPreferenciasAvisos,
  marcarFavorito,
  misFavoritos,
} from '../services/favoritosService.js'

// US21 - Emolienteros favoritos con datos reales: el cliente marca sus puestos favoritos y elige si quiere
// que le avisemos cuando abren su jornada y en qué zonas de La Molina (T93, T95, T96).
// La demostración en memoria de Rodrigo sigue en #favoritos?demo.

const fecha = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' })

function Corazon({ lleno }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={lleno ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  )
}

function Puesto({ e, ocupado, onAlternar }) {
  return (
    <li className="flex items-center gap-3 p-3 rounded-2xl border border-[#e6dcc8] bg-white">
      <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#efe6d3] shrink-0" aria-hidden="true">
        <EmolienteIcon size={30} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-bold truncate">{e.nombre}</p>
        <p className="text-sm text-[#6b4a2f] flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${e.atendiendo ? 'bg-[#2f6b3a]' : 'bg-[#c9b8a3]'}`} aria-hidden="true" />
          {e.atendiendo ? 'Atendiendo ahora' : 'Cerrado por ahora'}
          {e.zona && <span className="text-[#9a8670]">· {e.zona}</span>}
        </p>
      </div>
      <a href={`#catalogo?id=${e.id}`} className="ui-boton ui-boton-suave" style={{ padding: '7px 12px', fontSize: '0.85rem' }}>
        Ver carta
      </a>
      <button
        type="button"
        onClick={() => onAlternar(e)}
        disabled={ocupado}
        aria-pressed={e.favorito}
        aria-label={e.favorito ? `Quitar a ${e.nombre} de favoritos` : `Agregar a ${e.nombre} a favoritos`}
        className={`grid place-items-center w-10 h-10 rounded-full border transition-colors disabled:opacity-50 ${
          e.favorito ? 'bg-[#e8ead5] border-[#e8ead5] text-[#2f4a2e]' : 'border-[#d6c8ad] text-[#9a8670] hover:text-[#2f4a2e]'
        }`}
      >
        <Corazon lleno={e.favorito} />
      </button>
    </li>
  )
}

export default function EmolienterosFavoritos() {
  const [usuario, setUsuario] = useState(undefined)
  const [datos, setDatos] = useState(null) // { favoritos, preferencias, zonas, avisos }
  const [directorio, setDirectorio] = useState([])
  const [prefs, setPrefs] = useState(null)
  const [estadoGuardado, setEstadoGuardado] = useState('') // '' | 'guardando' | 'guardado' | mensaje de error
  const [ocupado, setOcupado] = useState(null)
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    Promise.all([misFavoritos(), directorioEmolienteros()])
      .then(([d, dir]) => {
        setDatos(d)
        setPrefs((p) => p ?? d.preferencias)
        setDirectorio(dir)
      })
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    usuarioDeLaSesion().then((u) => {
      setUsuario(u ?? null)
      if (u?.rol === 'cliente') cargar()
    })
  }, [cargar])

  async function alternar(e) {
    setOcupado(e.id)
    setError('')
    try {
      if (e.favorito) await desmarcarFavorito(e.id)
      else await marcarFavorito(e.id)
      cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(null)
    }
  }

  async function cambiarPreferencias(cambios) {
    const nuevas = { ...prefs, ...cambios }
    setPrefs(nuevas)
    setEstadoGuardado('guardando')
    try {
      setPrefs(await guardarPreferenciasAvisos(nuevas))
      setEstadoGuardado('guardado')
    } catch (err) {
      setEstadoGuardado(err.message)
    }
  }

  const alternarZona = (zona) =>
    cambiarPreferencias({ zonas: prefs.zonas.includes(zona) ? prefs.zonas.filter((z) => z !== zona) : [...prefs.zonas, zona] })

  const otros = directorio.filter((e) => !e.favorito)

  return (
    <div style={{ minHeight: '100vh' }}>
      <Encabezado />
      <main className="panel">
        <div className="panel-saludo">
          <h1>Tus favoritos</h1>
          <p>Guarda tus puestos preferidos y te avisamos cuando abran.</p>
        </div>

        {usuario === null && (
          <p className="panel-tarjeta" style={{ marginTop: 24 }}>
            <a href="#login" className="ui-boton ui-boton-primario">Ingresa</a> para guardar tus emolienteros favoritos.
          </p>
        )}
        {usuario && usuario.rol !== 'cliente' && (
          <p className="panel-tarjeta" style={{ marginTop: 24 }}>Los favoritos son para clientes.</p>
        )}
        {error && (
          <p role="alert" style={{ marginTop: 16, padding: '12px 14px', borderRadius: 12, background: '#fdecea', color: '#9b2c1f' }}>
            {error}
          </p>
        )}

        {datos && prefs && (
          <div className="panel-grid">
            <div className="panel-columna">
              <section className="panel-tarjeta">
                <h2 className="text-xl mb-3">Mis favoritos</h2>
                {datos.favoritos.length === 0 ? (
                  <p className="text-[#6b4a2f]">Aún no tienes favoritos. Toca el corazón de un puesto para guardarlo.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {datos.favoritos.map((e) => (
                      <Puesto key={e.id} e={e} ocupado={ocupado === e.id} onAlternar={alternar} />
                    ))}
                  </ul>
                )}
              </section>

              {otros.length > 0 && (
                <section className="panel-tarjeta">
                  <h2 className="text-xl mb-1">Descubre más puestos</h2>
                  <p className="text-sm text-[#6b4a2f] mb-3">Emolienteros verificados de La Molina.</p>
                  <ul className="flex flex-col gap-2">
                    {otros.map((e) => (
                      <Puesto key={e.id} e={e} ocupado={ocupado === e.id} onAlternar={alternar} />
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <div className="panel-columna">
              <section className="panel-tarjeta">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl">Avisos de apertura</h2>
                    <p className="text-sm text-[#6b4a2f] mt-1">Te avisamos cuando uno de tus favoritos abre su jornada.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs.avisosActivos}
                    aria-label="Recibir avisos de apertura"
                    onClick={() => cambiarPreferencias({ avisosActivos: !prefs.avisosActivos })}
                    className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${prefs.avisosActivos ? 'bg-[#2f6b3a]' : 'bg-[#d6c8ad]'}`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${prefs.avisosActivos ? 'left-6' : 'left-1'}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>

                <p className="text-sm font-semibold mt-4 mb-2">Solo en estas zonas</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Zonas de interés">
                  {datos.zonas.map((z) => {
                    const activa = prefs.zonas.includes(z)
                    return (
                      <button
                        key={z}
                        type="button"
                        aria-pressed={activa}
                        disabled={!prefs.avisosActivos}
                        onClick={() => alternarZona(z)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors disabled:opacity-50 ${
                          activa ? 'bg-[#2f4a2e] border-[#2f4a2e] text-white' : 'border-[#d6c8ad] text-[#6b4a2f] hover:bg-[#efe6d3]'
                        }`}
                      >
                        {z}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-[#9a8670] mt-2" role="status">
                  {estadoGuardado === 'guardando'
                    ? 'Guardando…'
                    : estadoGuardado === 'guardado'
                      ? 'Preferencias guardadas.'
                      : estadoGuardado || (prefs.zonas.length ? '' : 'Sin zonas elegidas: te avisamos en cualquier zona.')}
                </p>
              </section>

              <section className="panel-tarjeta">
                <h2 className="text-xl mb-3">Últimos avisos</h2>
                {datos.avisos.length === 0 ? (
                  <p className="text-sm text-[#6b4a2f]">Cuando un favorito abra su jornada, lo verás aquí.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {datos.avisos.map((a) => (
                      <li key={a.id} className="text-sm">
                        <p className="font-semibold">
                          {a.enviado ? '🔔 ' : ''}
                          {a.emolientero} abrió en {a.zona}
                        </p>
                        <p className="text-[#6b4a2f]">{a.enviado ? "Te avisamos." : `No te avisamos: ${a.motivo}.`}</p>
                        <p className="text-xs text-[#9a8670]">{fecha.format(new Date(a.creadoEn))}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
