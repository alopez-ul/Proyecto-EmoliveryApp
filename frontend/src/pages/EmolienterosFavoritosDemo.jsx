import Encabezado from '../components/Encabezado.jsx'
import { useMemo, useState } from 'react'
import {
  CLIENTE_DEMO_ID,
  ZONAS_FAVORITOS_LA_MOLINA,
} from '../domain/favoritos/index.js'
import {
  alternarFavoritoRemotoOLocal,
  obtenerInstanciaFavoritoService,
  simularAperturaJornadaFavoritoRemotoOLocal,
} from '../services/favoritosService.js'

// Los paneles técnicos (simuladores, bitácora) solo se muestran en modo demostración: agrega ?demo a la ruta.
const modoDemo = () => /[?&]demo\b/.test(window.location.hash)

export default function EmolienterosFavoritosDemo() {
  const servicio = useMemo(() => obtenerInstanciaFavoritoService(), [])

  const [directorio, setDirectorio] = useState(() =>
    servicio.obtenerDirectorioConEstado(CLIENTE_DEMO_ID),
  )
  const [preferencias, setPreferencias] = useState(() =>
    servicio.obtenerPreferencias(CLIENTE_DEMO_ID),
  )
  const [avisosEnviados, setAvisosEnviados] = useState(() => [
    ...servicio.obtenerAvisosEnviados(),
  ])
  const [historialActividad, setHistorialActividad] = useState(() => [
    ...servicio.obtenerHistorialActividad(),
  ])

  const [ultimoResultado, setUltimoResultado] = useState(null)
  const [filtroVista, setFiltroVista] = useState('todos') // 'todos' | 'favoritos'
  const [zonaFiltroDirectorio, setZonaFiltroDirectorio] = useState('Todas')

  const sincronizarEstado = () => {
    setDirectorio([...servicio.obtenerDirectorioConEstado(CLIENTE_DEMO_ID)])
    setPreferencias({ ...servicio.obtenerPreferencias(CLIENTE_DEMO_ID) })
    setAvisosEnviados([...servicio.obtenerAvisosEnviados()])
    setHistorialActividad([...servicio.obtenerHistorialActividad()])
  }

  // T93: Marcar o quitar un emolientero de favoritos
  const handleToggleFavorito = async (emolienteroId) => {
    await alternarFavoritoRemotoOLocal(emolienteroId, CLIENTE_DEMO_ID)
    sincronizarEstado()
  }

  // Toggle de notificaciones habilitadas
  const handleToggleNotificaciones = () => {
    const nuevoValor = !preferencias.notificacionesHabilitadas
    servicio.actualizarPreferencias(CLIENTE_DEMO_ID, {
      notificacionesHabilitadas: nuevoValor,
    })
    sincronizarEstado()
  }

  // Selector de Zona de Interés principal o múltiple en La Molina
  const handleToggleZonaInteres = (zona) => {
    const actuales = new Set(preferencias.zonasInteres)
    if (actuales.has(zona)) {
      if (actuales.size > 1) actuales.delete(zona)
    } else {
      actuales.add(zona)
    }
    servicio.actualizarPreferencias(CLIENTE_DEMO_ID, {
      zonasInteres: Array.from(actuales),
    })
    sincronizarEstado()
  }

  const handleSeleccionarZonaUnica = (e) => {
    const zona = e.target.value
    servicio.actualizarPreferencias(CLIENTE_DEMO_ID, {
      zonasInteres: [zona],
    })
    sincronizarEstado()
  }

  const handleCambiarCanal = (e) => {
    servicio.actualizarPreferencias(CLIENTE_DEMO_ID, {
      canalPreferido: e.target.value,
    })
    sincronizarEstado()
  }

  // Simular apertura desde cualquier tarjeta del directorio
  const simularAperturaDesdeTarjeta = async (emo) => {
    const res = await simularAperturaJornadaFavoritoRemotoOLocal(servicio, {
      clienteId: CLIENTE_DEMO_ID,
      emolientero: emo,
      zonaApertura: emo.zona,
      direccionEspecifica: emo.direccionReferencia,
      ahora: new Date(),
    })
    setUltimoResultado(res)
    sincronizarEstado()
  }

  // =========================================================================
  // T95 y T96: Los 3 Botones del Simulador de Casos de Prueba para Evidencias
  // =========================================================================

  // Botón 1 (Escenario Exitoso - T95): Favorito abre dentro de la zona de interés con notificaciones ON
  const ejecutarCaso1ExitosoT95 = async () => {
    servicio.marcarFavorito(CLIENTE_DEMO_ID, 'emo-01')
    servicio.actualizarPreferencias(CLIENTE_DEMO_ID, {
      notificacionesHabilitadas: true,
      zonasInteres: ['La Fontana', 'Camacho'],
    })

    const donLucho = directorio.find((e) => e.id === 'emo-01') ?? directorio[0]
    const res = await simularAperturaJornadaFavoritoRemotoOLocal(servicio, {
      clienteId: CLIENTE_DEMO_ID,
      emolientero: donLucho,
      zonaApertura: 'La Fontana',
      direccionEspecifica: 'Av. La Fontana 550 (Frente a Puerta Principal USIL)',
      ahora: new Date(),
    })

    setUltimoResultado({
      ...res,
      etiquetaCaso: 'Caso 1 (Exitoso): Favorito abre en tu zona de interés con notificaciones activas',
    })
    sincronizarEstado()
  }

  // Botón 2 (Escenario Inválido 1 - T96 Fuera de zona): Favorito abre fuera de la zona de interés
  const ejecutarCaso2FueraDeZonaT96 = async () => {
    servicio.marcarFavorito(CLIENTE_DEMO_ID, 'emo-01')
    servicio.actualizarPreferencias(CLIENTE_DEMO_ID, {
      notificacionesHabilitadas: true,
      zonasInteres: ['La Fontana'],
    })

    const donLucho = directorio.find((e) => e.id === 'emo-01') ?? directorio[0]
    const res = await simularAperturaJornadaFavoritoRemotoOLocal(servicio, {
      clienteId: CLIENTE_DEMO_ID,
      emolientero: donLucho,
      zonaApertura: 'Musa',
      direccionEspecifica: 'Av. La Molina cdra. 36 (Mercado Cooperativo Musa)',
      ahora: new Date(),
    })

    setUltimoResultado({
      ...res,
      etiquetaCaso: 'Caso 2 (Inválido Fuera de zona): Actividad registrada en bitácora — Aviso NO enviado (Fuera de tu zona de interés)',
    })
    sincronizarEstado()
  }

  // Botón 3 (Escenario Inválido 2 - T96 Notificaciones OFF): Cliente desactivó las notificaciones
  const ejecutarCaso3NotificacionesOffT96 = async () => {
    servicio.marcarFavorito(CLIENTE_DEMO_ID, 'emo-04')
    servicio.actualizarPreferencias(CLIENTE_DEMO_ID, {
      notificacionesHabilitadas: false,
      zonasInteres: ['La Fontana', 'Camacho'],
    })

    const elSabio = directorio.find((e) => e.id === 'emo-04') ?? directorio[0]
    const res = await simularAperturaJornadaFavoritoRemotoOLocal(servicio, {
      clienteId: CLIENTE_DEMO_ID,
      emolientero: elSabio,
      zonaApertura: 'Camacho',
      direccionEspecifica: 'Av. Javier Prado Este cdra. 46 (Frente a U. de Lima)',
      ahora: new Date(),
    })

    setUltimoResultado({
      ...res,
      etiquetaCaso: 'Caso 3 (Inválido Notificaciones OFF): Actividad registrada en bitácora — Aviso NO enviado (Notificaciones desactivadas)',
    })
    sincronizarEstado()
  }

  const totalFavoritos = directorio.filter((e) => e.esFavorito).length

  const listaVisible = useMemo(() => {
    return directorio.filter((emo) => {
      if (filtroVista === 'favoritos' && !emo.esFavorito) return false
      if (zonaFiltroDirectorio !== 'Todas' && emo.zona !== zonaFiltroDirectorio) return false
      return true
    })
  }, [directorio, filtroVista, zonaFiltroDirectorio])

  return (
    <div className="min-h-screen bg-[#f8f3e8] text-[#2b2118] flex flex-col">
      {/* Header Principal */}
      <Encabezado />

      {/* Barra de Simulación de Casos de Prueba (T95 y T96) */}
      {modoDemo() && (
      <section
        aria-label="Simulador de apertura de jornada y casos de prueba"
        className="bg-gradient-to-r from-[#2b2118] via-[#432818] to-[#2f4a2e] text-white px-4 py-3.5 sm:px-6 border-b border-amber-900 shadow-sm"
      >
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-[#2b2118] text-xs font-extrabold">
              Simulador de avisos
            </span>
            <span className="text-xs text-amber-100">
              Prueba los 3 escenarios de negocio de `FavoritoService` y la jerarquía `Notificacion`:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={ejecutarCaso1ExitosoT95}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs shadow-xs transition-all cursor-pointer"
            >
              ✓ Botón 1 (Exitoso): Favorito abre en mi zona (Envía Aviso)
            </button>
            <button
              type="button"
              onClick={ejecutarCaso2FueraDeZonaT96}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-xs transition-all cursor-pointer"
            >
              ✕ Botón 2 (Inválido 1): Abre fuera de mi zona (Suprime Aviso)
            </button>
            <button
              type="button"
              onClick={ejecutarCaso3NotificacionesOffT96}
              className="px-3.5 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-extrabold text-xs shadow-xs transition-all cursor-pointer"
            >
              🔕 Botón 3 (Inválido 2): Notificaciones OFF (Suprime Aviso)
            </button>
          </div>
        </div>
      </section>
      )}

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Banner dinámico del último resultado de simulación (T95 / T96) */}
        {ultimoResultado && (
          <div
            role={ultimoResultado.avisoEnviado ? 'status' : 'alert'}
            className={`rounded-2xl border-2 p-5 shadow-md transition-all ${
              ultimoResultado.avisoEnviado
                ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                : 'bg-amber-50 border-amber-400 text-amber-950'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                  ultimoResultado.avisoEnviado
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-800 text-white'
                }`}
              >
                {ultimoResultado.avisoEnviado
                  ? '✓ AVISO RECIBIDO POR EL CLIENTE'
                  : '⚠ ACTIVIDAD REGISTRADA EN BITÁCORA — AVISO NO ENVIADO'}
              </span>
              <span className="text-xs font-mono font-bold opacity-80">
                Estado: {ultimoResultado.estado}
              </span>
            </div>

            {ultimoResultado.avisoEnviado && ultimoResultado.notificacion ? (
              <div className="space-y-1.5">
                <h2 className="text-lg sm:text-xl font-extrabold text-emerald-950">
                  {ultimoResultado.notificacion.titulo}
                </h2>
                <p className="text-xs sm:text-sm text-emerald-900">
                  {ultimoResultado.notificacion.mensaje}
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-3 text-xs font-bold text-emerald-900">
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300">
                    📍 Ubicación exacta: {ultimoResultado.notificacion.ubicacion}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300">
                    🏘 Zona: {ultimoResultado.notificacion.zona}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 font-mono">
                    Subclase RNF18: {ultimoResultado.notificacion.tipo} ({ultimoResultado.notificacion.canal})
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-extrabold text-amber-950">
                  Actividad registrada en bitácora — Aviso NO enviado (
                  {ultimoResultado.estado === 'AVISO_SUPRIMIDO_CONFIGURACION'
                    ? 'Notificaciones desactivadas'
                    : ultimoResultado.estado === 'AVISO_SUPRIMIDO_ZONA'
                      ? 'Fuera de tu zona de interés'
                      : ultimoResultado.motivo}
                  )
                </h2>
                <p className="text-xs sm:text-sm text-amber-900">
                  Puesto: <strong>{ultimoResultado.registroActividad?.emolienteroNombre}</strong> · Zona de apertura:{' '}
                  <strong>{ultimoResultado.registroActividad?.zonaApertura}</strong> (
                  {ultimoResultado.registroActividad?.ubicacion}). El evento quedó guardado en el registro interno sin interrumpir al cliente.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Fila Superior: Panel de Configuración del Cliente + Resumen de Reglas US21 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Panel de Configuración del Cliente (T95 / T96) */}
          <section
            aria-labelledby="titulo-config-favoritos"
            className={`${modoDemo() ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white rounded-2xl border border-[#e6dcc8] shadow-sm p-5 sm:p-6 space-y-4`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#e6dcc8]">
              <div>
                <span className="text-[11px] font-bold text-[#2f4a2e] block">
                  Preferencias del Cliente
                </span>
                <h1 id="titulo-config-favoritos" className="text-xl font-extrabold text-[#2b2118]">
                  Configuración de Avisos de Apertura de Jornada
                </h1>
              </div>

              {/* Toggle Visible de Notificaciones Habilitadas */}
              <button
                type="button"
                role="switch"
                aria-checked={preferencias.notificacionesHabilitadas}
                onClick={handleToggleNotificaciones}
                className={`px-4 py-2 rounded-2xl font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer border ${
                  preferencias.notificacionesHabilitadas
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-stone-200 text-stone-700 border-stone-300'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    preferencias.notificacionesHabilitadas ? 'bg-white animate-pulse' : 'bg-stone-500'
                  }`}
                />
                Notificaciones de apertura habilitadas:{' '}
                {preferencias.notificacionesHabilitadas ? 'ACTIVADO' : 'DESACTIVADO'}
              </button>
            </div>

            {/* Selector de Mi Zona de Interés en La Molina */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="select-zona-interes-principal"
                  className="block text-xs font-bold text-[#6b4a2f] mb-1.5"
                >
                  Mi Zona de Interés Principal en La Molina:
                </label>
                <select
                  id="select-zona-interes-principal"
                  value={preferencias.zonasInteres[0] ?? 'La Fontana'}
                  onChange={handleSeleccionarZonaUnica}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#d6c8ad] bg-[#fbf7ee] text-xs sm:text-sm font-bold text-[#2b2118]"
                >
                  {ZONAS_FAVORITOS_LA_MOLINA.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="select-subclase-notificacion"
                  className="block text-xs font-bold text-[#6b4a2f] mb-1.5"
                >
                  Tipo de aviso:
                </label>
                <select
                  id="select-subclase-notificacion"
                  value={preferencias.canalPreferido ?? 'IN_APP'}
                  onChange={handleCambiarCanal}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#d6c8ad] bg-[#fbf7ee] text-xs sm:text-sm font-bold text-[#2b2118]"
                >
                  <option value="IN_APP">NotificacionEnApp (Banner + Acciones)</option>
                  <option value="APERTURA_JORNADA">NotificacionAperturaJornada (Estándar)</option>
                  <option value="PUSH_MOVIL">NotificacionPushSimulada (Push Móvil)</option>
                </select>
              </div>
            </div>

            {/* Chips multi-zona de interés en La Molina */}
            <div>
              <span className="block text-xs font-bold text-[#6b4a2f] mb-1.5">
                Zonas de interés activas para recibir avisos ({preferencias.zonasInteres.join(', ')}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ZONAS_FAVORITOS_LA_MOLINA.map((zona) => {
                  const activa = preferencias.zonasInteres.includes(zona)
                  return (
                    <button
                      key={zona}
                      type="button"
                      onClick={() => handleToggleZonaInteres(zona)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        activa
                          ? 'bg-[#2f4a2e] text-white border-[#2f4a2e] shadow-xs'
                          : 'bg-[#fbf7ee] text-[#6b4a2f] border-[#d6c8ad] hover:border-[#2f4a2e]'
                      }`}
                    >
                      {activa ? '✓ ' : '+ '}
                      {zona}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          {/* Tarjeta Derecha: Métricas de Favoritos y Diseño Polimórfico (T93 / T94) */}
          {modoDemo() && (
          <section className="lg:col-span-5 bg-white rounded-2xl border border-[#e6dcc8] shadow-sm p-5 sm:p-6 flex flex-col justify-between space-y-4">
            <div>
              <span className="text-[11px] font-bold text-[#2f4a2e] block">
                Arquitectura
              </span>
              <h2 className="text-lg font-extrabold text-[#2b2118]">
                Estado de Favoritos y Notificaciones
              </h2>
              <p className="text-xs text-[#6b4a2f] mt-1">
                `FavoritoService` desacopla la lógica de negocio mediante la jerarquía polimórfica `Notificacion`,
                cumpliendo el Principio Abierto/Cerrado (`RNF18`).
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                <span className="text-2xl font-extrabold text-[#2f4a2e] block">{totalFavoritos}</span>
                <span className="text-[11px] font-bold text-[#6b4a2f]">Mis Favoritos</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                <span className="text-2xl font-extrabold text-emerald-700 block">
                  {avisosEnviados.length}
                </span>
                <span className="text-[11px] font-bold text-emerald-900">Avisos Enviados</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-stone-100 border border-stone-200">
                <span className="text-2xl font-extrabold text-stone-800 block">
                  {historialActividad.length}
                </span>
                <span className="text-[11px] font-bold text-stone-700">Eventos Bitácora</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#fbf7ee] border border-[#e6dcc8] text-xs text-[#6b4a2f]">
              💡 <strong>Regla de negocio:</strong> Solo se emite notificación cuando el emolientero es{' '}
              <strong>favorito</strong>, las notificaciones están <strong>activas</strong> y abre jornada{' '}
              <strong>dentro de tu zona de interés</strong>. En caso contrario, solo se registra la actividad.
            </div>
          </section>
          )}
        </div>

        {/* Directorio de Emolienteros de La Molina y Lista de Favoritos (T93) */}
        <section
          aria-labelledby="titulo-directorio-favoritos"
          className="bg-white rounded-2xl border border-[#e6dcc8] shadow-sm p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e6dcc8]">
            <div>
              <h2 id="titulo-directorio-favoritos" className="text-lg font-extrabold text-[#2b2118]">
                Directorio de Emolienteros Verificados en La Molina
              </h2>
              <p className="text-xs text-[#6b4a2f]">
                Marca o desmarca tus emolienteros favoritos y simula la apertura de su jornada con un clic.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltroVista('todos')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                  filtroVista === 'todos'
                    ? 'bg-[#2b2118] text-white'
                    : 'bg-[#fbf7ee] text-[#6b4a2f] border border-[#d6c8ad]'
                }`}
              >
                Todos ({directorio.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroVista('favoritos')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                  filtroVista === 'favoritos'
                    ? 'bg-[#2f4a2e] text-white'
                    : 'bg-[#fbf7ee] text-[#2f4a2e] border border-amber-300'
                }`}
              >
                ♥ Solo Mis Favoritos ({totalFavoritos})
              </button>

              <select
                value={zonaFiltroDirectorio}
                onChange={(e) => setZonaFiltroDirectorio(e.target.value)}
                aria-label="Filtrar directorio por zona de La Molina"
                className="px-3 py-1.5 rounded-xl border border-[#d6c8ad] bg-[#fbf7ee] text-xs font-bold text-[#2b2118]"
              >
                <option value="Todas">Todas las zonas</option>
                {ZONAS_FAVORITOS_LA_MOLINA.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {listaVisible.map((emo) => {
              const enZonaInteres = preferencias.zonasInteres.includes(emo.zona)
              return (
                <article
                  key={emo.id}
                  className={`rounded-2xl border p-4 flex flex-col justify-between transition-all ${
                    emo.esFavorito
                      ? 'bg-amber-50/40 border-2 border-[#2f4a2e] shadow-xs'
                      : 'bg-white border-[#e6dcc8]'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-stone-100 font-mono font-bold text-[11px] text-stone-700">
                          {emo.codigoMunicipal}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                            enZonaInteres
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {emo.zona} {enZonaInteres ? '· Tu zona' : ''}
                        </span>
                      </div>

                      {/* Botón de Corazón / Favorito (T93) */}
                      <button
                        type="button"
                        onClick={() => handleToggleFavorito(emo.id)}
                        aria-label={
                          emo.esFavorito
                            ? `Quitar a ${emo.nombre} de favoritos`
                            : `Marcar a ${emo.nombre} como favorito`
                        }
                        className={`px-2.5 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 border ${
                          emo.esFavorito
                            ? 'bg-[#2f4a2e] text-white border-[#2f4a2e] shadow-xs'
                            : 'bg-[#fbf7ee] text-[#6b4a2f] border-[#d6c8ad] hover:border-[#2f4a2e]'
                        }`}
                      >
                        <span aria-hidden="true">{emo.esFavorito ? '♥' : '♡'}</span>
                        <span>{emo.esFavorito ? 'Favorito' : 'Marcar'}</span>
                      </button>
                    </div>

                    <h3 className="font-extrabold text-base text-[#2b2118]">{emo.nombre}</h3>
                    <p className="text-xs text-[#6b4a2f] mt-0.5">📍 {emo.direccionReferencia}</p>
                    <p className="text-xs text-amber-800 font-bold mt-1">
                      ★ {emo.calificacionPromedio.toFixed(1)} ({emo.totalResenas} reseñas) · {emo.especialidad}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[#e6dcc8] flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => simularAperturaDesdeTarjeta(emo)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      🔔 Simular Apertura Ahora
                    </button>
                    <a
                      href={`#pago-yape?emolientero=${emo.id}`}
                      className="px-2.5 py-1.5 rounded-xl bg-[#fbf7ee] hover:bg-amber-100 border border-[#d6c8ad] text-xs font-bold text-[#2b2118]"
                    >
                      Pedir con Yape →
                    </a>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        {/* Bandeja de Avisos Enviados (T95) vs. Registro Interno de Actividad Silenciosa (T96) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna 1: Bandeja de Avisos Efectivamente Enviados al Cliente (T95) */}
          <section
            aria-labelledby="titulo-avisos-enviados"
            className="lg:col-span-5 bg-white rounded-2xl border border-[#e6dcc8] shadow-sm p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#e6dcc8]">
              <div>
                <span className="text-[11px] font-bold text-emerald-700 block">
                  Notificaciones Emitidas
                </span>
                <h2 id="titulo-avisos-enviados" className="text-base sm:text-lg font-extrabold text-[#2b2118]">
                  Bandeja de Avisos Recibidos ({avisosEnviados.length})
                </h2>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-extrabold">
                Solo envíos válidos
              </span>
            </div>

            {avisosEnviados.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#fbf7ee] border border-dashed border-[#d6c8ad] text-center text-xs text-[#6b4a2f]">
                No hay avisos emitidos aún. Pulsa el{' '}
                <strong>Botón 1 (Escenario Exitoso)</strong> en la barra superior para recibir un aviso de apertura con ubicación.
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {avisosEnviados.map((notif) => (
                  <div
                    key={notif.id}
                    className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-300 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-emerald-700 text-white font-extrabold">
                        {notif.tipo} · {notif.canal}
                      </span>
                      <span className="font-mono text-emerald-900">
                        {new Date(notif.fechaHora).toLocaleTimeString('es-PE')}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-sm text-[#2b2118]">{notif.titulo}</h3>
                    <p className="text-xs text-[#6b4a2f]">{notif.mensaje}</p>
                    <p className="text-xs font-bold text-emerald-900 pt-1">
                      📍 {notif.ubicacion} ({notif.zona})
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Columna 2: Registro Interno de Actividad (Incluye Avisos Suprimidos por T96) */}
          <section
            aria-labelledby="titulo-registro-actividad"
            className="lg:col-span-7 bg-white rounded-2xl border border-[#e6dcc8] shadow-sm p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#e6dcc8]">
              <div>
                <span className="text-[11px] font-bold text-[#2f4a2e] block">
                  Trazabilidad de Aperturas y Supresión de Avisos
                </span>
                <h2 id="titulo-registro-actividad" className="text-base sm:text-lg font-extrabold text-[#2b2118]">
                  Registro Interno de Actividad ({historialActividad.length})
                </h2>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-extrabold">
                Enviados + Suprimidos
              </span>
            </div>

            {historialActividad.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#fbf7ee] border border-dashed border-[#d6c8ad] text-center text-xs text-[#6b4a2f]">
                Usa los 3 botones del <strong>Simulador de avisos</strong> para comprobar cómo se registra cada inicio de jornada cuando se envía o se suprime el aviso.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#e6dcc8] text-[#6b4a2f] text-[11px]">
                      <th className="py-2 px-2.5">Hora</th>
                      <th className="py-2 px-2.5">Emolientero</th>
                      <th className="py-2 px-2.5">Zona Apertura</th>
                      <th className="py-2 px-2.5">¿Aviso Enviado?</th>
                      <th className="py-2 px-2.5">Motivo / Regla Aplicada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e6dcc8]">
                    {historialActividad.map((ev) => (
                      <tr key={ev.idEvento} className="hover:bg-[#fbf7ee]/60">
                        <td className="py-2.5 px-2.5 font-mono whitespace-nowrap">
                          {new Date(ev.fechaHora).toLocaleTimeString('es-PE')}
                        </td>
                        <td className="py-2.5 px-2.5 font-bold text-[#2b2118]">
                          {ev.emolienteroNombre}
                        </td>
                        <td className="py-2.5 px-2.5 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-stone-100 font-semibold">
                            {ev.zonaApertura}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-extrabold text-[11px] ${
                              ev.avisoEnviado
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {ev.avisoEnviado ? 'SÍ (ENVIADO)' : 'NO (SOLO BITÁCORA)'}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-[#6b4a2f]">{ev.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
