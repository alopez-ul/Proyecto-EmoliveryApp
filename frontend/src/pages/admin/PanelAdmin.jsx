// US23 - Verificación de emolienteros: panel del administrador.
// T28 bandeja de pendientes · T29 aprobar / rechazar con motivo · historial de decisiones.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MOTIVO_MAX,
  MOTIVO_MIN,
  aprobarEmolientero,
  listarHistorial,
  listarPendientes,
  rechazarEmolientero,
} from '../../services/adminService.js'
import './PanelAdmin.css'

const formatoFecha = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' })
const fecha = (iso) => formatoFecha.format(new Date(iso))

export default function PanelAdmin({ usuario, onCerrarSesion }) {
  const [pestana, setPestana] = useState('pendientes')
  const [pendientes, setPendientes] = useState(null)
  const [historial, setHistorial] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [decision, setDecision] = useState(null) // { tipo: 'aprobar' | 'rechazar', emolientero }

  const cargarPendientes = useCallback(() => {
    listarPendientes()
      .then(setPendientes)
      .catch((err) => setError(err.message))
  }, [])

  const cargarHistorial = useCallback(() => {
    listarHistorial()
      .then(setHistorial)
      .catch((err) => setError(err.message))
  }, [])

  useEffect(cargarPendientes, [cargarPendientes])
  useEffect(() => {
    if (pestana === 'historial') cargarHistorial()
  }, [pestana, cargarHistorial])

  async function confirmarDecision(motivo) {
    const { tipo, emolientero } = decision
    if (tipo === 'aprobar') await aprobarEmolientero(emolientero.id)
    else await rechazarEmolientero(emolientero.id, motivo)
    setDecision(null)
    setError('')
    setAviso(
      tipo === 'aprobar'
        ? `Se aprobó a ${emolientero.nombre}. Su cuenta ya está activa y se le notificó.`
        : `Se rechazó la solicitud de ${emolientero.nombre} y se le notificó el motivo.`,
    )
    setPendientes((lista) => lista.filter((e) => e.id !== emolientero.id))
    setHistorial(null)
  }

  return (
    <div className="panel-admin">
      <header className="barra-superior panel-admin-barra">
        <a href="#inicio" className="panel-admin-marca">
          <h1 className="titulo">Emolivery</h1>
        </a>
        <div className="panel-admin-usuario">
          <span>{usuario.nombre}</span>
          <button type="button" className="pa-boton pa-boton-secundario" onClick={onCerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="panel-admin-contenido">
        <div className="panel-admin-encabezado">
          <p className="pa-etiqueta">Panel del administrador</p>
          <h2>Verificación de emolienteros</h2>
          <p className="pa-ayuda">Revisa los registros nuevos y apruébalos o recházalos indicando el motivo.</p>
        </div>

        {aviso && (
          <div className="pa-alerta pa-alerta-exito" role="status">
            <span>{aviso}</span>
            <button type="button" className="pa-cerrar-alerta" onClick={() => setAviso('')} aria-label="Cerrar aviso">
              ×
            </button>
          </div>
        )}
        {error && (
          <div className="pa-alerta pa-alerta-error" role="alert">
            <span>{error}</span>
            <button type="button" className="pa-cerrar-alerta" onClick={() => setError('')} aria-label="Cerrar error">
              ×
            </button>
          </div>
        )}

        <section className="pa-tarjeta">
          <div className="pa-pestanas" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={pestana === 'pendientes'}
              className={pestana === 'pendientes' ? 'is-activa' : ''}
              onClick={() => setPestana('pendientes')}
            >
              Pendientes
              {pendientes && <span className="pa-contador">{pendientes.length}</span>}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pestana === 'historial'}
              className={pestana === 'historial' ? 'is-activa' : ''}
              onClick={() => setPestana('historial')}
            >
              Historial
            </button>
          </div>

          {pestana === 'pendientes' ? (
            <BandejaPendientes
              pendientes={pendientes}
              onDecidir={(tipo, emolientero) => {
                setAviso('')
                setDecision({ tipo, emolientero })
              }}
            />
          ) : (
            <Historial historial={historial} />
          )}
        </section>
      </main>

      <DialogoDecision
        decision={decision}
        onCancelar={() => setDecision(null)}
        onConfirmar={confirmarDecision}
        onSolicitudObsoleta={(mensaje) => {
          // Otro administrador ya la procesó: se cierra el diálogo y se recarga la bandeja.
          setDecision(null)
          setError(mensaje)
          cargarPendientes()
        }}
      />
    </div>
  )
}

function BandejaPendientes({ pendientes, onDecidir }) {
  if (!pendientes) return <p className="pa-vacio">Cargando registros…</p>
  if (!pendientes.length) return <p className="pa-vacio">No hay registros pendientes de verificación.</p>

  return (
    <table className="pa-tabla">
      <thead>
        <tr>
          <th>Emolientero</th>
          <th>DNI</th>
          <th>Autorización municipal</th>
          <th>Registrado</th>
          <th aria-label="Acciones" />
        </tr>
      </thead>
      <tbody>
        {pendientes.map((e) => (
          <tr key={e.id}>
            <td data-titulo="Emolientero">
              <strong>{e.nombre}</strong>
              <span className="pa-secundario">{e.correo}</span>
            </td>
            <td data-titulo="DNI" className="pa-mono">{e.dni ?? '—'}</td>
            <td data-titulo="Autorización municipal" className="pa-mono">{e.codigoMunicipal ?? '—'}</td>
            <td data-titulo="Registrado">{fecha(e.creadoEn)}</td>
            <td className="pa-acciones">
              <button type="button" className="pa-boton pa-boton-aprobar" onClick={() => onDecidir('aprobar', e)}>
                Aprobar
              </button>
              <button type="button" className="pa-boton pa-boton-rechazar" onClick={() => onDecidir('rechazar', e)}>
                Rechazar
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Historial({ historial }) {
  if (!historial) return <p className="pa-vacio">Cargando historial…</p>
  if (!historial.length) return <p className="pa-vacio">Todavía no se ha verificado ningún emolientero.</p>

  return (
    <table className="pa-tabla">
      <thead>
        <tr>
          <th>Emolientero</th>
          <th>Decisión</th>
          <th>Motivo</th>
          <th>Decidido por</th>
        </tr>
      </thead>
      <tbody>
        {historial.map((d) => (
          <tr key={d.id}>
            <td data-titulo="Emolientero">
              <strong>{d.nombre}</strong>
              <span className="pa-secundario">DNI {d.dni ?? '—'}</span>
            </td>
            <td data-titulo="Decisión">
              <span className={`pa-insignia ${d.decision === 'aprobado' ? 'is-aprobado' : 'is-rechazado'}`}>
                {d.decision === 'aprobado' ? 'Aprobado' : 'Rechazado'}
              </span>
            </td>
            <td data-titulo="Motivo" className="pa-motivo">{d.motivo ?? '—'}</td>
            <td data-titulo="Decidido por">
              {d.decididoPor ?? '—'}
              <span className="pa-secundario">{fecha(d.decididoEn)}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DialogoDecision({ decision, onCancelar, onConfirmar, onSolicitudObsoleta }) {
  const dialogo = useRef(null)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const rechazo = decision?.tipo === 'rechazar'

  useEffect(() => {
    if (decision) {
      setMotivo('')
      setError('')
      setEnviando(false)
      dialogo.current.showModal()
    } else if (dialogo.current.open) {
      dialogo.current.close()
    }
  }, [decision])

  async function enviar(ev) {
    ev.preventDefault()
    const limpio = motivo.trim()
    if (rechazo && limpio.length < MOTIVO_MIN) return setError(`Escribe un motivo de al menos ${MOTIVO_MIN} caracteres.`)
    setError('')
    setEnviando(true)
    try {
      await onConfirmar(limpio)
    } catch (err) {
      if (err.status === 409 || err.status === 404) return onSolicitudObsoleta(err.message)
      setError(err.message)
      setEnviando(false)
    }
  }

  return (
    <dialog
      ref={dialogo}
      className="pa-dialogo"
      onCancel={(ev) => {
        ev.preventDefault()
        if (!enviando) onCancelar()
      }}
      aria-labelledby="pa-dialogo-titulo"
    >
      {decision && (
        <form onSubmit={enviar} noValidate>
          <h3 id="pa-dialogo-titulo">{rechazo ? 'Rechazar solicitud' : 'Aprobar emolientero'}</h3>
          <p className="pa-ayuda">
            {rechazo ? (
              <>
                Se rechazará el registro de <strong>{decision.emolientero.nombre}</strong> (DNI {decision.emolientero.dni}). El
                motivo se le enviará en la notificación.
              </>
            ) : (
              <>
                La cuenta de <strong>{decision.emolientero.nombre}</strong> (DNI {decision.emolientero.dni}) quedará activa y
                podrá vender en Emolivery. Se le notificará la aprobación.
              </>
            )}
          </p>

          {rechazo && (
            <label className="pa-campo">
              <span>Motivo del rechazo</span>
              <textarea
                value={motivo}
                onChange={(ev) => {
                  setMotivo(ev.target.value)
                  setError('')
                }}
                maxLength={MOTIVO_MAX}
                rows={4}
                placeholder="Ej.: El DNI no coincide con el nombre registrado."
                autoFocus
              />
              <span className="pa-secundario pa-contador-texto">
                {motivo.trim().length}/{MOTIVO_MAX}
              </span>
            </label>
          )}

          {error && <div className="pa-alerta pa-alerta-error">{error}</div>}

          <div className="pa-dialogo-acciones">
            <button type="button" className="pa-boton pa-boton-secundario" onClick={onCancelar} disabled={enviando}>
              Cancelar
            </button>
            <button type="submit" className={`pa-boton ${rechazo ? 'pa-boton-rechazar-solido' : 'pa-boton-aprobar-solido'}`} disabled={enviando}>
              {enviando ? 'Guardando…' : rechazo ? 'Rechazar solicitud' : 'Aprobar'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
