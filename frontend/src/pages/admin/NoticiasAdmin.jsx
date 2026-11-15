// US22 - T97: el administrador publica noticias con público objetivo y fecha de publicación.
import { useCallback, useEffect, useState } from 'react'
import {
  CONTENIDO_MAX,
  PUBLICOS,
  TITULO_MAX,
  eliminarNoticia,
  formatearFecha,
  hoyEnLima,
  listarTodasLasNoticias,
  publicarNoticia,
  validarNoticia,
} from '../../services/noticiasService.js'

const vacio = () => ({ titulo: '', contenido: '', publico: '', fechaPublicacion: hoyEnLima() })

function ErrorCampo({ mensaje }) {
  return mensaje ? <span className="pa-error-campo">{mensaje}</span> : null
}

export default function NoticiasAdmin({ onAviso, onError }) {
  const [form, setForm] = useState(vacio)
  const [errores, setErrores] = useState({})
  const [intentoEnviar, setIntentoEnviar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [noticias, setNoticias] = useState(null)

  const cargar = useCallback(() => {
    listarTodasLasNoticias()
      .then(setNoticias)
      .catch((err) => onError(err.message))
  }, [onError])
  useEffect(cargar, [cargar])

  useEffect(() => {
    if (intentoEnviar) setErrores(validarNoticia(form))
  }, [form, intentoEnviar])

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  async function publicar(e) {
    e.preventDefault()
    setIntentoEnviar(true)
    const errs = validarNoticia(form)
    setErrores(errs)
    if (Object.keys(errs).length) return
    setGuardando(true)
    try {
      const n = await publicarNoticia(form)
      const programada = n.fechaPublicacion > hoyEnLima()
      onAviso(
        programada
          ? `Noticia programada: "${n.titulo}" se mostrará desde el ${formatearFecha(n.fechaPublicacion)}.`
          : `Noticia publicada: "${n.titulo}" ya aparece en el panel de ${PUBLICOS[n.publico].toLowerCase()}.`,
      )
      setForm(vacio())
      setIntentoEnviar(false)
      setErrores({})
      cargar()
    } catch (err) {
      if (err.campos) setErrores(err.campos)
      else onError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(n) {
    if (!window.confirm(`¿Eliminar la noticia "${n.titulo}"?`)) return
    try {
      await eliminarNoticia(n.id)
      onAviso(`Se eliminó la noticia "${n.titulo}".`)
    } catch (err) {
      onError(err.message)
    } finally {
      cargar()
    }
  }

  return (
    <div className="pa-noticias">
      <form className="pa-noticia-form" onSubmit={publicar} noValidate>
        <h3>Nueva noticia</h3>
        <label className="pa-campo">
          Título
          <input type="text" maxLength={TITULO_MAX} value={form.titulo} onChange={cambiar('titulo')} aria-invalid={Boolean(errores.titulo)} />
          <ErrorCampo mensaje={errores.titulo} />
        </label>
        <label className="pa-campo">
          Contenido
          <textarea rows={5} maxLength={CONTENIDO_MAX} value={form.contenido} onChange={cambiar('contenido')} aria-invalid={Boolean(errores.contenido)} />
          <span className="pa-contador-texto">{form.contenido.length}/{CONTENIDO_MAX}</span>
          <ErrorCampo mensaje={errores.contenido} />
        </label>
        <div className="pa-noticia-fila">
          <label className="pa-campo">
            Público objetivo
            <select value={form.publico} onChange={cambiar('publico')} aria-invalid={Boolean(errores.publico)}>
              <option value="">Elige…</option>
              {Object.entries(PUBLICOS).map(([clave, nombre]) => (
                <option key={clave} value={clave}>{nombre}</option>
              ))}
            </select>
            <ErrorCampo mensaje={errores.publico} />
          </label>
          <label className="pa-campo">
            Fecha de publicación
            <input
              type="date"
              min={hoyEnLima()}
              value={form.fechaPublicacion}
              onChange={cambiar('fechaPublicacion')}
              aria-invalid={Boolean(errores.fechaPublicacion)}
            />
            <ErrorCampo mensaje={errores.fechaPublicacion} />
          </label>
        </div>
        <button type="submit" className="pa-boton pa-boton-aprobar-solido" disabled={guardando}>
          {guardando ? 'Publicando…' : 'Publicar noticia'}
        </button>
      </form>

      <div className="pa-noticia-lista">
        <h3>Noticias publicadas</h3>
        {!noticias && <p className="pa-vacio">Cargando…</p>}
        {noticias?.length === 0 && <p className="pa-vacio">Aún no hay noticias.</p>}
        <ul>
          {noticias?.map((n) => (
            <li key={n.id}>
              <div>
                <span className="pa-secundario">
                  {formatearFecha(n.fechaPublicacion)} · {PUBLICOS[n.publico]}
                  {n.programada && <span className="pa-insignia pa-insignia-programada">Programada</span>}
                </span>
                <strong>{n.titulo}</strong>
              </div>
              <button type="button" className="pa-boton pa-boton-rechazar" onClick={() => eliminar(n)}>
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
