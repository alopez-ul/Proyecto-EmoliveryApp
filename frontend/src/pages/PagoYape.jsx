import Encabezado from '../components/Encabezado.jsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { EMOLIENTEROS_SEMILLA_LA_MOLINA } from '../domain/ubicacion/index.js'
import {
  NUMEROS_OPERACION_PRE_USADOS,
  PLAZO_VIGENCIA_ORDEN_MS,
  PagoController,
  Yape,
  crearOrdenPendiente,
} from '../domain/pago/index.js'
import { validarPagoYapeRemotoOLocal } from '../services/pagoYapeService.js'

// Los paneles técnicos (simuladores, bitácora) solo se muestran en modo demostración: agrega ?demo a la ruta.
const modoDemo = () => /[?&]demo\b/.test(window.location.hash)

function obtenerEmolienteroIdDesdeHash() {
  const query = window.location.hash.split('?')[1] ?? ''
  return new URLSearchParams(query).get('emolientero') || 'emo-01'
}

/**
 * T64: Renderizador determinista de matriz QR en SVG nítido para la orden de Yape.
 */
export function CodigoQRYapeSVG({ payload = '', size = 200 }) {
  const N = 25
  const matriz = useMemo(() => {
    const grid = Array.from({ length: N }, () => Array(N).fill(false))

    const dibujarPatronPosicion = (r0, c0) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const esBorde = r === 0 || r === 6 || c === 0 || c === 6
          const esCentro = r >= 2 && r <= 4 && c >= 2 && c <= 4
          grid[r0 + r][c0 + c] = esBorde || esCentro
        }
      }
    }

    dibujarPatronPosicion(0, 0)
    dibujarPatronPosicion(0, N - 7)
    dibujarPatronPosicion(N - 7, 0)

    let hash = 2166136261
    for (let i = 0; i < payload.length; i++) {
      hash ^= payload.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const enEsquinaSupIzq = r < 8 && c < 8
        const enEsquinaSupDer = r < 8 && c >= N - 8
        const enEsquinaInfIzq = r >= N - 8 && c < 8
        const enCentroLogo = r >= 10 && r <= 14 && c >= 10 && c <= 14
        if (enEsquinaSupIzq || enEsquinaSupDer || enEsquinaInfIzq || enCentroLogo) continue

        if (r === 6 || c === 6) {
          grid[r][c] = (r + c) % 2 === 0
          continue
        }

        const semilla = Math.abs(hash ^ (r * 37 + c * 101 + r * c * 17))
        grid[r][c] = semilla % 3 !== 0
      }
    }
    return grid
  }, [payload])

  return (
    <svg
      viewBox={`0 0 ${N + 4} ${N + 4}`}
      width={size}
      height={size}
      role="img"
      aria-label="Código QR de Yape para pago de orden anticipada"
      className="mx-auto rounded-2xl bg-white p-2 shadow-md border-2 border-[#742384]/25"
    >
      <rect width={N + 4} height={N + 4} fill="#ffffff" rx="2" />
      {matriz.map((fila, r) =>
        fila.map((celda, c) =>
          celda ? (
            <rect
              key={`${r}-${c}`}
              x={c + 2}
              y={r + 2}
              width="1"
              height="1"
              fill="#3b0747"
              rx="0.15"
            />
          ) : null,
        ),
      )}
      <rect x="11.5" y="11.5" width="6" height="6" rx="1.2" fill="#742384" />
      <text
        x="14.5"
        y="15.7"
        textAnchor="middle"
        fill="#00cba9"
        fontSize="3.4"
        fontWeight="bold"
        fontFamily="sans-serif"
      >
        Y
      </text>
    </svg>
  )
}

export default function PagoYape() {
  // Instancia persistente de PagoController con subclase Yape (T63)
  const controladorRef = useRef(null)
  if (!controladorRef.current) {
    controladorRef.current = new PagoController(new Yape(NUMEROS_OPERACION_PRE_USADOS))
  }
  const controlador = controladorRef.current

  const emolienterosActivos = useMemo(
    () => EMOLIENTEROS_SEMILLA_LA_MOLINA.filter((e) => e.jornadaAbierta),
    [],
  )

  const [emolienteroId, setEmolienteroId] = useState(obtenerEmolienteroIdDesdeHash)
  const [orden, setOrden] = useState(() => crearOrdenPendiente({ emolienteroId: obtenerEmolienteroIdDesdeHash() }))

  // Formulario de constancia de operación (T65)
  const [numeroOperacion, setNumeroOperacion] = useState('48291035')
  const [montoIngresado, setMontoIngresado] = useState(() => String(orden.totalCalculado.toFixed(2)))
  const [resultadoValidacion, setResultadoValidacion] = useState(null)
  const [bitacora, setBitacora] = useState([])
  const [operacionesUsadas, setOperacionesUsadas] = useState(() => controlador.obtenerOperacionesUsadas())
  const [copiado, setCopiado] = useState(false)

  // Temporizador regresivo en vivo de 15:00 minutos (T64)
  const [segundosRestantes, setSegundosRestantes] = useState(15 * 60)

  useEffect(() => {
    if (orden.forzarExpiracion) {
      setSegundosRestantes(0)
      return
    }
    if (orden.estado !== 'PENDIENTE_PAGO') return

    const actualizarReloj = () => {
      const transcurridoMs = Date.now() - new Date(orden.creadaEn).getTime()
      const restanteMs = Math.max(0, PLAZO_VIGENCIA_ORDEN_MS - transcurridoMs)
      setSegundosRestantes(Math.ceil(restanteMs / 1000))
    }

    actualizarReloj()
    const timer = setInterval(actualizarReloj, 1000)
    return () => clearInterval(timer)
  }, [orden])

  const datosQR = useMemo(() => controlador.obtenerDatosQR(orden), [controlador, orden])

  const formatearReloj = (seg) => {
    const m = String(Math.floor(seg / 60)).padStart(2, '0')
    const s = String(seg % 60).padStart(2, '0')
    return `${m}:${s}`
  }

  const generarNuevaOrdenVigente = (nuevoEmolienteroId = emolienteroId) => {
    const nueva = crearOrdenPendiente({ emolienteroId: nuevoEmolienteroId, creadaEn: new Date() })
    setOrden(nueva)
    setResultadoValidacion(null)
    setMontoIngresado(nueva.totalCalculado.toFixed(2))
    const opSugerida = String(Math.floor(30000000 + Math.random() * 60000000))
    setNumeroOperacion(opSugerida)
    setSegundosRestantes(15 * 60)
  }

  const handleCambiarEmolientero = (e) => {
    const nuevoId = e.target.value
    setEmolienteroId(nuevoId)
    generarNuevaOrdenVigente(nuevoId)
  }

  const ejecutarValidacion = async ({
    ordenObjetivo = orden,
    op = numeroOperacion,
    monto = montoIngresado,
    ahora = new Date(),
  } = {}) => {
    const respuesta = await validarPagoYapeRemotoOLocal(controlador, {
      orden: ordenObjetivo,
      numeroOperacion: op,
      montoIngresado: monto,
      ahora,
    })

    setResultadoValidacion(respuesta)
    setOrden(respuesta.ordenActualizada)
    setBitacora([...controlador.obtenerBitacora()])
    setOperacionesUsadas(controlador.obtenerOperacionesUsadas())
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    ejecutarValidacion()
  }

  // T67: Simulador de los 4 Casos de Prueba de Caja Negra
  const ejecutarCaso1Exitoso = () => {
    const nuevaOrden = crearOrdenPendiente({ emolienteroId, creadaEn: new Date() })
    let opNueva = String(Math.floor(40000000 + Math.random() * 50000000))
    while (controlador.metodoPago.esOperacionDuplicada(opNueva)) {
      opNueva = String(Math.floor(40000000 + Math.random() * 50000000))
    }
    const montoExacto = nuevaOrden.totalCalculado.toFixed(2)
    setOrden(nuevaOrden)
    setNumeroOperacion(opNueva)
    setMontoIngresado(montoExacto)
    setSegundosRestantes(15 * 60)
    ejecutarValidacion({
      ordenObjetivo: nuevaOrden,
      op: opNueva,
      monto: montoExacto,
      ahora: new Date(),
    })
  }

  const ejecutarCaso2OperacionDuplicada = () => {
    const nuevaOrden = crearOrdenPendiente({ emolienteroId, creadaEn: new Date() })
    const opDuplicada = '12345678' // Pre-registrada en numerosOperacionUsados
    const montoExacto = nuevaOrden.totalCalculado.toFixed(2)
    setOrden(nuevaOrden)
    setNumeroOperacion(opDuplicada)
    setMontoIngresado(montoExacto)
    setSegundosRestantes(15 * 60)
    ejecutarValidacion({
      ordenObjetivo: nuevaOrden,
      op: opDuplicada,
      monto: montoExacto,
      ahora: new Date(),
    })
  }

  const ejecutarCaso3MontoDistinto = () => {
    const nuevaOrden = crearOrdenPendiente({ emolienteroId, creadaEn: new Date() })
    const opValida = String(Math.floor(50000000 + Math.random() * 40000000))
    const montoErroneo = '5.00' // Distinto de S/ 11.50
    setOrden(nuevaOrden)
    setNumeroOperacion(opValida)
    setMontoIngresado(montoErroneo)
    setSegundosRestantes(15 * 60)
    ejecutarValidacion({
      ordenObjetivo: nuevaOrden,
      op: opValida,
      monto: montoErroneo,
      ahora: new Date(),
    })
  }

  const ejecutarCaso4OrdenVencida = () => {
    const hace20Min = new Date(Date.now() - 20 * 60 * 1000)
    const ordenExpirada = {
      ...crearOrdenPendiente({ emolienteroId, creadaEn: hace20Min }),
      forzarExpiracion: true,
    }
    const opValida = String(Math.floor(60000000 + Math.random() * 30000000))
    const montoExacto = ordenExpirada.totalCalculado.toFixed(2)
    setOrden(ordenExpirada)
    setNumeroOperacion(opValida)
    setMontoIngresado(montoExacto)
    setSegundosRestantes(0)
    ejecutarValidacion({
      ordenObjetivo: ordenExpirada,
      op: opValida,
      monto: montoExacto,
      ahora: new Date(),
    })
  }

  const copiarCodigoRecojo = () => {
    if (!resultadoValidacion?.codigoRecojo) return
    navigator.clipboard?.writeText(resultadoValidacion.codigoRecojo).catch(() => {})
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#f8f3e8] text-[#2b2118] flex flex-col">
      {/* Header Principal */}
      <Encabezado volver={{ href: '#inicio', texto: 'Volver al mapa' }} />

      {/* T67: Panel Simulador de Casos de Prueba de Caja Negra */}
      {modoDemo() && (
      <section
        aria-label="Simulador de casos de prueba de caja negra"
        className="bg-gradient-to-r from-[#3b0747] via-[#4c105c] to-[#2b2118] text-white px-4 py-3.5 sm:px-6 border-b border-purple-900"
      >
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-[#00cba9] text-[#2b2118] text-xs font-extrabold">
              Simulador de Casos de Prueba
            </span>
            <span className="text-xs text-purple-100 hidden sm:inline">
              Ejecuta con un clic los 4 escenarios de validación de `Yape extends MetodoPago`:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={ejecutarCaso1Exitoso}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              ✓ Caso 1: Pago Exitoso (Genera Código)
            </button>
            <button
              type="button"
              onClick={ejecutarCaso2OperacionDuplicada}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              ✕ Caso 2: Operación Duplicada (12345678)
            </button>
            <button
              type="button"
              onClick={ejecutarCaso3MontoDistinto}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              ✕ Caso 3: Monto Distinto (S/ 5.00 vs S/ {orden.totalCalculado.toFixed(2)})
            </button>
            <button
              type="button"
              onClick={ejecutarCaso4OrdenVencida}
              className="px-3 py-1.5 rounded-xl bg-stone-700 hover:bg-stone-800 text-white font-bold text-xs border border-stone-500 transition-all cursor-pointer"
            >
              ⏱ Caso 4: Orden Vencida (&gt; 15 min)
            </button>
            <button
              type="button"
              onClick={() => generarNuevaOrdenVigente()}
              className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-xs border border-white/25 transition-all cursor-pointer"
            >
              ↻ Nueva Orden Vigente
            </button>
          </div>
        </div>
      </section>
      )}

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna Izquierda (T64): Resumen de la Orden Anticipada, Temporizador 15:00 y QR de Yape */}
          <div className="lg:col-span-6 space-y-5">
            <div className="bg-white rounded-2xl border border-[#e6dcc8] shadow-md p-5 sm:p-6 space-y-4">
              {/* Cabecera de la Orden y Estado */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#e6dcc8]">
                <div>
                  <span className="text-[11px] font-bold text-[#9a8670] block">
                    Orden de Compra Anticipada
                  </span>
                  <h1 className="text-xl font-extrabold text-[#2b2118] font-mono">{orden.id}</h1>
                </div>

                {/* Badge dinámico del estado de la orden */}
                <span
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold ${
                    orden.estado === 'Pagada'
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : orden.estado === 'Rechazada / Reserva Liberada'
                        ? 'bg-red-100 text-red-900 border border-red-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      orden.estado === 'Pagada'
                        ? 'bg-emerald-600'
                        : orden.estado === 'Rechazada / Reserva Liberada'
                          ? 'bg-red-600'
                          : 'bg-amber-600 animate-pulse'
                    }`}
                  />
                  {orden.estado === 'PENDIENTE_PAGO' ? 'Pendiente de pago' : orden.estado}
                </span>
              </div>

              {/* Selector de Emolientero Destino en La Molina */}
              <div>
                <label
                  htmlFor="select-puesto-yape"
                  className="block text-xs font-bold text-[#6b4a2f] mb-1"
                >
                  Puesto de Emoliente en La Molina:
                </label>
                <select
                  id="select-puesto-yape"
                  value={emolienteroId}
                  onChange={handleCambiarEmolientero}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#d6c8ad] bg-[#fbf7ee] text-xs sm:text-sm font-bold text-[#2b2118]"
                >
                  {emolienterosActivos.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre} ({e.zona} · {e.codigoMunicipal})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[#6b4a2f] mt-1">
                  📍 {orden.emolientero.direccionReferencia} · Titular Yape:{' '}
                  <strong>{orden.emolientero.encargado}</strong>
                </p>
              </div>

              {/* Reloj regresivo de vigencia de 15:00 minutos */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                  segundosRestantes === 0
                    ? 'bg-red-50 border-red-300 text-red-900'
                    : 'bg-[#fbf7ee] border-[#e6dcc8] text-[#2b2118]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">⏱</span>
                  <div>
                    <p className="text-xs font-extrabold">
                      Vigencia de la reserva (Máximo 15 minutos)
                    </p>
                    <p className="text-[11px] opacity-80">
                      {segundosRestantes === 0
                        ? 'Plazo expirado: la orden ha vencido y no admite confirmación.'
                        : 'Completa el Yapeo y registra la constancia antes de que expire.'}
                    </p>
                  </div>
                </div>
                <span
                  className={`font-mono text-xl font-extrabold px-3 py-1 rounded-xl ${
                    segundosRestantes === 0
                      ? 'bg-red-600 text-white'
                      : 'bg-[#2b2118] text-amber-300'
                  }`}
                >
                  {formatearReloj(segundosRestantes)}
                </span>
              </div>

              {/* Detalle de Productos Reservados y Total Calculado */}
              <div className="space-y-2">
                <h2 className="text-xs font-bold text-[#6b4a2f]">
                  Productos Reservados:
                </h2>
                <ul className="divide-y divide-[#e6dcc8] border border-[#e6dcc8] rounded-2xl px-4 bg-[#fbf7ee]/60">
                  {orden.items.map((item) => (
                    <li key={item.id} className="py-2.5 flex items-center justify-between text-xs sm:text-sm">
                      <div>
                        <span className="font-extrabold text-[#2f4a2e] mr-1.5">{item.cantidad}x</span>
                        <span className="font-semibold text-[#2b2118]">{item.nombre}</span>
                      </div>
                      <span className="font-bold tabular-nums">S/ {item.subtotal.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex items-center justify-between pt-2 px-1">
                  <span className="text-sm font-extrabold text-[#2b2118]">
                    Monto Total Calculado de la Orden:
                  </span>
                  <span className="text-2xl font-extrabold text-[#742384] tabular-nums">
                    S/ {orden.totalCalculado.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Tarjeta QR de Yape (T64) */}
              <div className="rounded-2xl bg-[#742384] text-white p-5 text-center space-y-3 shadow-md">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00cba9] text-[#2b2118] text-xs font-extrabold">
                  <span>📱</span> Escanea con tu app Yape
                </div>
                <CodigoQRYapeSVG payload={datosQR.payloadQR} size={185} />
                <div className="space-y-0.5">
                  <p className="font-extrabold text-base">{datosQR.titularVerificado}</p>
                  <p className="text-xs text-purple-200">
                    Celular afiliado: <strong>{datosQR.telefonoEnmascarado}</strong> · {datosQR.nombrePuesto}
                  </p>
                  <p className="text-sm font-extrabold text-[#00cba9] pt-1">
                    Importe exacto a yapear: S/ {datosQR.montoTotal.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha (T65, T66): Formulario de Constancia y Resolución Exitoso / Inválido */}
          <div className="lg:col-span-6 space-y-5">
            <div className="bg-white rounded-2xl border border-[#e6dcc8] shadow-md p-5 sm:p-6 space-y-5">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#2b2118]">
                  Registrar Constancia de Operación
                </h2>
                <p className="text-xs sm:text-sm text-[#6b4a2f] mt-1">
                  El sistema verifica la unicidad del número de operación, la coincidencia exacta del monto (
                  <strong>S/ {orden.totalCalculado.toFixed(2)}</strong>) y la vigencia de 15 minutos.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/* Input Número de Operación */}
                <div>
                  <label
                    htmlFor="input-numero-operacion"
                    className="block text-xs font-bold text-[#6b4a2f] mb-1.5"
                  >
                    Número de operación de Yape (6 a 10 dígitos) <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="input-numero-operacion"
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    value={numeroOperacion}
                    onChange={(e) => setNumeroOperacion(e.target.value)}
                    placeholder="Ej. 48291035"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#d6c8ad] bg-[#fbf7ee] font-mono text-base font-bold text-[#2b2118] focus:outline-none focus:ring-2 focus:ring-[#742384]"
                  />
                  <p className="text-[11px] text-[#9a8670] mt-1">
                    Números ya usados en memoria para probar duplicidad:{' '}
                    <code className="font-mono font-bold text-[#742384]">
                      {operacionesUsadas.slice(0, 6).join(', ')}
                    </code>
                  </p>
                </div>

                {/* Input Monto Transferido */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="input-monto-yape"
                      className="block text-xs font-bold text-[#6b4a2f]"
                    >
                      Monto transferido (S/) <span className="text-red-600">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setMontoIngresado(orden.totalCalculado.toFixed(2))}
                      className="text-xs font-bold text-[#742384] hover:underline cursor-pointer"
                    >
                      Autocompletar monto exacto (S/ {orden.totalCalculado.toFixed(2)})
                    </button>
                  </div>
                  <input
                    id="input-monto-yape"
                    type="number"
                    step="0.10"
                    min="0"
                    value={montoIngresado}
                    onChange={(e) => setMontoIngresado(e.target.value)}
                    placeholder="11.50"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#d6c8ad] bg-[#fbf7ee] font-mono text-base font-bold text-[#2b2118] focus:outline-none focus:ring-2 focus:ring-[#742384]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-5 rounded-xl bg-[#742384] hover:bg-[#5c1b69] text-white font-extrabold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>✓</span> Validar Constancia y Confirmar Pago
                </button>
              </form>

              {/* T66: ESCENARIO EXITOSO — Orden Pagada + Código de Recojo de un solo uso */}
              {resultadoValidacion?.valido && (
                <div
                  role="status"
                  className="rounded-2xl bg-emerald-50 border-2 border-emerald-400 p-5 text-emerald-950 space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-extrabold">
                      Estado de la Orden: Pagada
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-800">
                      Op. Yape #{resultadoValidacion.transaccion.numeroOperacion}
                    </span>
                  </div>

                  <h3 className="text-lg font-extrabold text-emerald-950">
                    ¡Constancia de Yape verificada con éxito!
                  </h3>
                  <p className="text-xs text-emerald-900">
                    Tu pago por <strong>S/ {orden.totalCalculado.toFixed(2)}</strong> ha sido validado. Presenta este{' '}
                    <strong>código de recojo de un solo uso</strong> al emolientero para recibir tu pedido:
                  </p>

                  {/* Destacado del Código de Recojo de un solo uso */}
                  <div className="bg-white rounded-2xl border-2 border-dashed border-emerald-500 p-4 text-center space-y-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-800 block">
                      Código de Recojo de un solo uso
                    </span>
                    <div className="text-3xl sm:text-4xl font-mono font-extrabold tracking-wider text-[#2b2118]">
                      {resultadoValidacion.codigoRecojo}
                    </div>
                    <p className="text-[11px] text-[#6b4a2f]">
                      Código alfanumérico equivalente en mostrador:{' '}
                      <strong className="font-mono">{resultadoValidacion.codigoUS15}</strong>
                    </p>
                    <button
                      type="button"
                      onClick={copiarCodigoRecojo}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-xs transition-colors cursor-pointer"
                    >
                      {copiado ? '✓ Código copiado al portapapeles' : 'Copiar código de recojo'}
                    </button>
                  </div>
                </div>
              )}

              {/* T66 / T67: ESCENARIO INVÁLIDO — "Pago no válido" y liberación de reserva */}
              {resultadoValidacion && !resultadoValidacion.valido && (
                <div
                  role="alert"
                  className="rounded-2xl bg-red-50 border-2 border-red-400 p-5 text-red-950 space-y-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-3 py-1 rounded-full bg-red-600 text-white text-xs font-extrabold">
                      {resultadoValidacion.codigoCausa}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-red-200 text-red-900 text-xs font-bold">
                      Reserva Liberada
                    </span>
                  </div>

                  {/* Mensaje exacto obligatorio del criterio de aceptación de US14 */}
                  <h3 className="text-xl font-extrabold text-red-900">Pago no válido</h3>

                  <p className="text-xs sm:text-sm text-red-900 font-medium">
                    {resultadoValidacion.detalleError}
                  </p>

                  <div className="pt-2 border-t border-red-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-red-800">
                      Estado actual: {orden.estado}
                    </span>
                    <button
                      type="button"
                      onClick={() => generarNuevaOrdenVigente()}
                      className="px-3 py-1.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      Generar nueva reserva vigente
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RNF06: Bitácora de Auditoría de Transacciones de Pago en Vivo */}
        {modoDemo() && (
        <section
          aria-labelledby="titulo-bitacora-rnf06"
          className="bg-white rounded-2xl border border-[#e6dcc8] shadow-md p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold text-[#2f4a2e] block">
                RNF06 · Trazabilidad y Auditoría de Operaciones
              </span>
              <h2 id="titulo-bitacora-rnf06" className="text-lg font-extrabold text-[#2b2118]">
                Bitácora de Transacciones de Pago con Yape ({bitacora.length})
              </h2>
            </div>
            <span className="text-xs text-[#6b4a2f]">
              Registra cada intento exitoso o fallido con fecha/hora, orden, operación y causa.
            </span>
          </div>

          {bitacora.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#fbf7ee] border border-dashed border-[#d6c8ad] text-center text-xs text-[#6b4a2f]">
              Aún no se han registrado intentos en esta sesión. Usa el formulario o los botones del{' '}
              <strong>Simulador de Casos de Prueba</strong> para registrar transacciones en la bitácora.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#e6dcc8] text-[#6b4a2f] text-[11px]">
                    <th className="py-2.5 px-3">Fecha / Hora</th>
                    <th className="py-2.5 px-3">ID Orden</th>
                    <th className="py-2.5 px-3">N.° Operación</th>
                    <th className="py-2.5 px-3">Monto (Ingresado / Total)</th>
                    <th className="py-2.5 px-3">Resultado</th>
                    <th className="py-2.5 px-3">Detalle / Regla</th>
                    <th className="py-2.5 px-3">Código Recojo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6dcc8]">
                  {bitacora.map((item) => (
                    <tr key={item.idTransaccion} className="hover:bg-[#fbf7ee]/60">
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                        {new Date(item.fechaHora).toLocaleTimeString('es-PE')}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold">{item.ordenId}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#742384]">
                        {item.numeroOperacion}
                      </td>
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                        S/ {item.montoIngresado.toFixed(2)} / S/ {item.montoEsperado.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-extrabold text-[11px] ${
                            item.resultado === 'ACEPTADO'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-red-100 text-red-900'
                          }`}
                        >
                          {item.resultado}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#6b4a2f] max-w-xs">{item.detalle}</td>
                      <td className="py-2.5 px-3 font-mono font-extrabold text-emerald-800">
                        {item.codigoRecojo ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        )}
      </main>
    </div>
  )
}
