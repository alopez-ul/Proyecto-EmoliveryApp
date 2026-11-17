// US24 - Gestión de usuarios registrados (Renzo - Release 2 / Sprint 2).
// T100 listado con filtros · T101 totales por categoría · T102 suspender / reactivar con motivo ·
// T103 si un emolientero tiene pedidos pagados por entregar, se muestran los que debe resolver primero.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ESTADOS, MOTIVO_MAX, MOTIVO_MIN, ROLES, listarUsuarios, reactivarUsuario, suspenderUsuario } from '../../services/adminService.js'

const formatoFecha = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' })
const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })
const ROL_SINGULAR = { cliente: 'Cliente', emolientero: 'Emolientero', admin: 'Administrador' }
const SIN_FILTROS = { rol: '', estado: '', desde: '', hasta: '' }

export default function GestionUsuarios({ usuarioActual }) {
  const [filtros, setFiltros] = useState(SIN_FILTROS)
  const [datos, setDatos] = useState(null) // { totales, usuarios }
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [accion, setAccion] = useState(null) // { tipo: 'suspender' | 'reactivar', usuario }

  const cargar = useCallback((f) => {
    setError('')
    listarUsuarios(f)
      .then(setDatos)
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => cargar(SIN_FILTROS), [cargar])

  const cambiarFiltro = (campo) => (ev) => {
    const nuevos = { ...filtros, [campo]: ev.target.value }
    setFiltros(nuevos)
    cargar(nuevos)
  }

  async function confirmar(motivo) {
    const { tipo, usuario } = accion
    if (tipo === 'suspender') await suspenderUsuario(usuario.id, motivo)
    else await reactivarUsuario(usuario.id, motivo)
    setAccion(null)
    setAviso(tipo === 'suspender' ? `Se suspendió la cuenta de ${usuario.nombre}.` : `Se reactivó la cuenta de ${usuario.nombre} y se le avisó.`)
    cargar(filtros)
  }

  return (
    <div>
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
        </div>
      )}

      {/* T100: filtros por rol, estado y fecha de registro */}
      <fieldset className="pa-filtros">
        <legend className="pa-sr">Filtros</legend>
        <label>
          <span>Rol</span>
          <select value={filtros.rol} onChange={cambiarFiltro('rol')}>
            <option value="">Todos</option>
            {Object.entries(ROLES).map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Estado</span>
          <select value={filtros.estado} onChange={cambiarFiltro('estado')}>
            <option value="">Todos</option>
            {Object.entries(ESTADOS).map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Registrado desde</span>
          <input type="date" value={filtros.desde} max={filtros.hasta || undefined} onChange={cambiarFiltro('desde')} />
        </label>
        <label>
          <span>Hasta</span>
          <input type="date" value={filtros.hasta} min={filtros.desde || undefined} onChange={cambiarFiltro('hasta')} />
        </label>
        <button
          type="button"
          className="pa-boton pa-boton-secundario"
          onClick={() => {
            setFiltros(SIN_FILTROS)
            cargar(SIN_FILTROS)
          }}
        >
          Limpiar
        </button>
      </fieldset>

      {/* T101: totales por categoría */}
      {datos && (
        <dl className="pa-totales" aria-label="Totales de los usuarios listados">
          <div>
            <dt>Total</dt>
            <dd>{datos.totales.total}</dd>
          </div>
          {Object.entries(ROLES).map(([id, nombre]) => (
            <div key={id}>
              <dt>{nombre}</dt>
              <dd>{datos.totales.porRol[id]}</dd>
            </div>
          ))}
          {Object.entries(ESTADOS).map(([id, nombre]) => (
            <div key={id}>
              <dt>{nombre}</dt>
              <dd>{datos.totales.porEstado[id]}</dd>
            </div>
          ))}
        </dl>
      )}

      {!datos ? (
        <p className="pa-vacio">Cargando usuarios…</p>
      ) : !datos.usuarios.length ? (
        <p className="pa-vacio">No hay usuarios con esos filtros.</p>
      ) : (
        <table className="pa-tabla">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Registrado</th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {datos.usuarios.map((u) => (
              <tr key={u.id}>
                <td data-titulo="Usuario">
                  <strong>{u.nombre}</strong>
                  <span className="pa-secundario">{u.correo}</span>
                  {u.ultimoMotivo && (
                    <span className="pa-secundario">
                      Último cambio ({u.ultimaAccion === 'suspender' ? 'suspensión' : 'reactivación'}): {u.ultimoMotivo}
                    </span>
                  )}
                </td>
                <td data-titulo="Rol">{ROL_SINGULAR[u.rol] ?? u.rol}</td>
                <td data-titulo="Estado">
                  <span className={`pa-insignia pa-estado-${u.estado}`}>{ESTADOS[u.estado] ?? u.estado}</span>
                  {u.ordenesPorEntregar > 0 && <span className="pa-secundario">{u.ordenesPorEntregar} pedido(s) por entregar</span>}
                </td>
                <td data-titulo="Registrado">{formatoFecha.format(new Date(u.creadoEn))}</td>
                <td className="pa-acciones">
                  {u.estado === 'activo' && u.rol !== 'admin' && u.id !== usuarioActual.id && (
                    <button type="button" className="pa-boton pa-boton-rechazar" onClick={() => setAccion({ tipo: 'suspender', usuario: u })}>
                      Suspender
                    </button>
                  )}
                  {u.estado === 'suspendido' && (
                    <button type="button" className="pa-boton pa-boton-aprobar" onClick={() => setAccion({ tipo: 'reactivar', usuario: u })}>
                      Reactivar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <DialogoCuenta accion={accion} onCancelar={() => setAccion(null)} onConfirmar={confirmar} />
    </div>
  )
}

function DialogoCuenta({ accion, onCancelar, onConfirmar }) {
  const dialogo = useRef(null)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [ordenes, setOrdenes] = useState(null) // T103: pedidos que bloquean la suspensión
  const [enviando, setEnviando] = useState(false)
  const suspension = accion?.tipo === 'suspender'

  useEffect(() => {
    if (accion) {
      setMotivo('')
      setError('')
      setOrdenes(null)
      setEnviando(false)
      dialogo.current.showModal()
    } else if (dialogo.current.open) {
      dialogo.current.close()
    }
  }, [accion])

  async function enviar(ev) {
    ev.preventDefault()
    const limpio = motivo.trim()
    if (limpio.length < MOTIVO_MIN) return setError(`Escribe un motivo de al menos ${MOTIVO_MIN} caracteres.`)
    setError('')
    setOrdenes(null)
    setEnviando(true)
    try {
      await onConfirmar(limpio)
    } catch (err) {
      setError(err.message)
      if (err.datos?.ordenes) setOrdenes(err.datos.ordenes)
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
      aria-labelledby="pa-cuenta-titulo"
    >
      {accion && (
        <form onSubmit={enviar} noValidate>
          <h3 id="pa-cuenta-titulo">{suspension ? 'Suspender cuenta' : 'Reactivar cuenta'}</h3>
          <p className="pa-ayuda">
            {suspension ? (
              <>
                <strong>{accion.usuario.nombre}</strong> no podrá iniciar sesión mientras su cuenta esté suspendida.
                {accion.usuario.rol === 'emolientero' && ' Si tiene la jornada abierta, se cerrará.'}
              </>
            ) : (
              <>
                <strong>{accion.usuario.nombre}</strong> podrá volver a iniciar sesión. Se le avisará con el motivo.
              </>
            )}
          </p>

          <label className="pa-campo">
            <span>Motivo</span>
            <textarea
              value={motivo}
              onChange={(ev) => {
                setMotivo(ev.target.value)
                setError('')
              }}
              maxLength={MOTIVO_MAX}
              rows={3}
              placeholder={suspension ? 'Ej.: Varios reportes de ubicación falsa.' : 'Ej.: Se aclaró el reclamo con el usuario.'}
              autoFocus
            />
            <span className="pa-secundario pa-contador-texto">
              {motivo.trim().length}/{MOTIVO_MAX}
            </span>
          </label>

          {error && <div className="pa-alerta pa-alerta-error" role="alert">{error}</div>}
          {ordenes && (
            <ul className="pa-lista-ordenes" aria-label="Pedidos por resolver">
              {ordenes.map((o) => (
                <li key={o.id}>
                  Pedido #{o.id} de {o.cliente}
                  {o.total != null && ` · ${soles.format(o.total)}`} · {o.estado === 'en_camino' ? 'en camino' : 'pagado, por entregar'}
                </li>
              ))}
            </ul>
          )}

          <div className="pa-dialogo-acciones">
            <button type="button" className="pa-boton pa-boton-secundario" onClick={onCancelar} disabled={enviando}>
              Cancelar
            </button>
            <button
              type="submit"
              className={`pa-boton ${suspension ? 'pa-boton-rechazar-solido' : 'pa-boton-aprobar-solido'}`}
              disabled={enviando || Boolean(ordenes)}
            >
              {enviando ? 'Guardando…' : suspension ? 'Suspender' : 'Reactivar'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
