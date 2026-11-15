import { useCallback, useEffect, useState } from 'react'
import MapaLima from '../components/MapaLima.jsx'
import {
  CENTRO_LA_MOLINA,
  DIAS_SEMANA,
  crearPuntoHabitual,
  eliminarPuntoHabitual,
  listarPuntosHabituales,
  validarPuntoHabitual,
} from '../services/puntosHabitualesService.js'

// US10 - T46: el emolientero registra sus puntos habituales: zona (punto en el mapa + referencia),
// día de la semana y rango horario. Con ellos, PatronHistorico lo muestra de forma aproximada en el
// mapa cuando no tiene la jornada abierta.

const VACIO = { referencia: '', diaSemana: '', horaInicio: '', horaFin: '' }

const claseCampo = (error) =>
  `w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 ${
    error ? 'border-red-300 focus:ring-red-200' : 'border-[#ebe3d9] focus:ring-orange-200'
  }`

function ErrorCampo({ mensaje }) {
  return mensaje ? <p className="mt-1 text-xs font-medium text-red-600">⚠ {mensaje}</p> : null
}

export default function PuntosHabituales() {
  const [puntos, setPuntos] = useState(null)
  const [form, setForm] = useState(VACIO)
  const [zona, setZona] = useState(null)
  const [errores, setErrores] = useState({})
  const [intentoEnviar, setIntentoEnviar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  const cargar = useCallback(() => {
    listarPuntosHabituales()
      .then(setPuntos)
      .catch((err) => setError(err.status === 403 ? 'Esta sección es solo para emolienteros.' : err.message))
  }, [])
  useEffect(cargar, [cargar])

  const datos = { ...form, diaSemana: Number(form.diaSemana) || null, zona }

  // Tras el primer intento de envío, los errores se actualizan mientras el usuario corrige.
  useEffect(() => {
    if (intentoEnviar) setErrores(validarPuntoHabitual(datos, puntos ?? []))
  }, [form, zona, puntos, intentoEnviar]) // eslint-disable-line react-hooks/exhaustive-deps

  const cambiar = (campo) => (e) => {
    setExito('')
    setForm((f) => ({ ...f, [campo]: e.target.value }))
  }

  async function guardar(e) {
    e.preventDefault()
    setIntentoEnviar(true)
    setError('')
    setExito('')
    const errs = validarPuntoHabitual(datos, puntos ?? [])
    setErrores(errs)
    if (Object.keys(errs).length) return

    setGuardando(true)
    try {
      const nuevo = await crearPuntoHabitual({
        referencia: form.referencia,
        lat: zona.lat,
        lng: zona.lng,
        diaSemana: datos.diaSemana,
        horaInicio: form.horaInicio,
        horaFin: form.horaFin,
      })
      setExito(`Punto "${nuevo.referencia}" registrado para el ${DIAS_SEMANA[nuevo.diaSemana - 1].toLowerCase()} de ${nuevo.horaInicio} a ${nuevo.horaFin}.`)
      // Se conservan la zona y la referencia para registrar rápido el mismo punto otro día.
      setForm((f) => ({ ...f, diaSemana: '', horaInicio: '', horaFin: '' }))
      setIntentoEnviar(false)
      setErrores({})
      cargar()
    } catch (err) {
      if (err.campos) setErrores(err.campos)
      else setError(err.message)
      if (err.status === 409) cargar()
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(p) {
    if (!window.confirm(`¿Eliminar "${p.referencia}" del ${DIAS_SEMANA[p.diaSemana - 1].toLowerCase()} (${p.horaInicio}–${p.horaFin})?`)) return
    setError('')
    setExito('')
    try {
      await eliminarPuntoHabitual(p.id)
    } catch (err) {
      setError(err.message)
    } finally {
      cargar()
    }
  }

  // Al tocar un punto ya registrado se copian su zona y referencia (para usarlo otro día).
  const marcadores = (puntos ?? []).map((p) => ({
    id: p.id,
    nombre: `${p.referencia} · ${DIAS_SEMANA[p.diaSemana - 1]} ${p.horaInicio}–${p.horaFin}`,
    referencia: p.referencia,
    lat: p.lat,
    lng: p.lng,
    activo: true,
  }))

  return (
    <div className="min-h-screen bg-[#f7f3ee] text-[#2b1a0f] flex flex-col">
      <header className="bg-white border-b border-[#ebe3d9] py-4 px-6 flex items-center justify-between shadow-xs sticky top-0 z-20">
        <a href="#inicio" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#b8581a] to-[#e67e22] flex items-center justify-center text-white font-bold text-lg shadow-sm">
            E
          </span>
          <span className="font-extrabold text-2xl tracking-tight text-[#2b1a0f]">
            Emolivery<span className="text-[#b8581a]">.</span>
          </span>
        </a>
        <a
          href="#emolientero"
          className="text-sm font-semibold text-[#6b5443] hover:text-[#2b1a0f] transition-colors py-1.5 px-3 rounded-lg hover:bg-[#fbf6ef]"
        >
          ← Panel Emolientero
        </a>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="text-center mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 text-[#b8581a] mb-2">
            US10 - Puntos habituales
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Mis puntos habituales</h1>
          <p className="text-sm text-[#6b5443] mt-1.5 max-w-xl mx-auto">
            Indica dónde sueles vender cada día. Cuando no tengas la jornada abierta, los clientes te verán en el mapa
            como <strong>ubicación aproximada</strong> según este horario.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          {/* Formulario (T46) */}
          <form onSubmit={guardar} noValidate className="bg-white rounded-3xl border border-[#ebe3d9] shadow-xl p-5 sm:p-6 space-y-4">
            <h2 className="text-lg font-bold">Nuevo punto habitual</h2>

            <div>
              <p className="block text-sm font-semibold mb-1.5">Zona</p>
              <div className={`relative h-72 rounded-2xl overflow-hidden border ${errores.ubicacion ? 'border-red-300' : 'border-[#ebe3d9]'}`}>
                <MapaLima
                  puntos={marcadores}
                  seleccionado={null}
                  onSelect={(p) => {
                    setZona({ lat: p.lat, lng: p.lng })
                    setForm((f) => ({ ...f, referencia: p.referencia }))
                  }}
                  modoRegistro
                  borrador={zona}
                  onPick={setZona}
                  centro={CENTRO_LA_MOLINA}
                  zoom={14}
                />
              </div>
              <p className="mt-1 text-xs text-[#9a8676]">
                {zona
                  ? `Zona marcada (${zona.lat.toFixed(5)}, ${zona.lng.toFixed(5)}). Haz clic en otro lugar para cambiarla.`
                  : 'Haz clic en el mapa para marcar la zona (dentro de La Molina), o toca uno de tus puntos para reutilizarlo.'}
              </p>
              <ErrorCampo mensaje={errores.ubicacion} />
            </div>

            <div>
              <label htmlFor="referencia" className="block text-sm font-semibold mb-1.5">Referencia de la zona</label>
              <input
                id="referencia"
                type="text"
                maxLength={100}
                placeholder="Ej. Parque Los Fresnos, frente a la UNALM"
                value={form.referencia}
                onChange={cambiar('referencia')}
                className={claseCampo(errores.referencia)}
              />
              <ErrorCampo mensaje={errores.referencia} />
            </div>

            <div>
              <label htmlFor="dia" className="block text-sm font-semibold mb-1.5">Día</label>
              <select id="dia" value={form.diaSemana} onChange={cambiar('diaSemana')} className={claseCampo(errores.diaSemana)}>
                <option value="">Elige un día</option>
                {DIAS_SEMANA.map((d, i) => (
                  <option key={d} value={i + 1}>{d}</option>
                ))}
              </select>
              <ErrorCampo mensaje={errores.diaSemana} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="inicio" className="block text-sm font-semibold mb-1.5">Desde</label>
                <input id="inicio" type="time" value={form.horaInicio} onChange={cambiar('horaInicio')} className={claseCampo(errores.horaInicio)} />
              </div>
              <div>
                <label htmlFor="fin" className="block text-sm font-semibold mb-1.5">Hasta</label>
                <input id="fin" type="time" value={form.horaFin} onChange={cambiar('horaFin')} className={claseCampo(errores.horaFin)} />
              </div>
            </div>
            <ErrorCampo mensaje={errores.horaInicio} />
            <ErrorCampo mensaje={errores.horaFin} />

            {error && (
              <div role="alert" className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium">
                {error}
              </div>
            )}
            {exito && (
              <div role="status" className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium">
                {exito}
              </div>
            )}

            <button
              type="submit"
              disabled={guardando || !puntos}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white shadow-md bg-gradient-to-r from-[#b8581a] to-[#e67e22] hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {guardando ? 'Guardando…' : 'Guardar punto habitual'}
            </button>
          </form>

          {/* Horario semanal */}
          <section className="bg-white rounded-3xl border border-[#ebe3d9] shadow-xl p-5 sm:p-6">
            <h2 className="text-lg font-bold mb-4">Mi horario semanal</h2>
            {!puntos && !error && <p className="text-sm text-[#9a8676]">Cargando…</p>}
            {puntos?.length === 0 && <p className="text-sm text-[#9a8676]">Aún no registras puntos habituales.</p>}
            <div className="space-y-4">
              {DIAS_SEMANA.map((dia, i) => {
                const delDia = (puntos ?? []).filter((p) => p.diaSemana === i + 1)
                if (!delDia.length) return null
                return (
                  <div key={dia}>
                    <h3 className="text-xs font-bold text-[#9a8676] uppercase tracking-wider mb-2">{dia}</h3>
                    <ul className="space-y-2">
                      {delDia.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#fbf6ef] border border-[#ebe3d9]">
                          <div className="min-w-0">
                            <p className="font-mono text-sm font-bold text-[#b8581a]">{p.horaInicio} – {p.horaFin}</p>
                            <p className="text-sm truncate">{p.referencia}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => eliminar(p)}
                            className="shrink-0 text-xs font-bold text-red-600 hover:underline"
                          >
                            Eliminar
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-[#9a8676]">
        EMOLIVERY &copy; {new Date().getFullYear()} - Plataforma de Emolientes Tradicionales de Lima
      </footer>
    </div>
  )
}
