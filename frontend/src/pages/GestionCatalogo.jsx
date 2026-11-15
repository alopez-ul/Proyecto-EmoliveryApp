import { useCallback, useEffect, useState } from 'react'
import {
  CATEGORIAS,
  DESCRIPCION_MAXIMA,
  crearProducto,
  editarProducto,
  listarMiCatalogo,
  validarProducto,
} from '../services/catalogoService.js'

// US11 - T50: el emolientero da de alta y edita los productos de su catálogo (nombre, categoría,
// precio y disponibilidad). El mismo formulario sirve para crear y para editar.

const VACIO = { nombre: '', descripcion: '', categoria: '', precio: '', disponible: true }

const claseCampo = (error) =>
  `w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 ${
    error ? 'border-red-300 focus:ring-red-200' : 'border-[#ebe3d9] focus:ring-orange-200'
  }`

function ErrorCampo({ mensaje }) {
  return mensaje ? <p className="mt-1 text-xs font-medium text-red-600">⚠ {mensaje}</p> : null
}

const soles = (precio) => `S/ ${Number(precio).toFixed(2)}`

export default function GestionCatalogo() {
  const [productos, setProductos] = useState(null)
  const [form, setForm] = useState(VACIO)
  const [editandoId, setEditandoId] = useState(null)
  const [errores, setErrores] = useState({})
  const [intentoEnviar, setIntentoEnviar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  const cargar = useCallback(() => {
    listarMiCatalogo()
      .then(setProductos)
      .catch((err) => setError(err.status === 403 ? 'Esta sección es solo para emolienteros.' : err.message))
  }, [])
  useEffect(cargar, [cargar])

  // Tras el primer intento de envío, los errores se actualizan mientras el usuario corrige.
  useEffect(() => {
    if (intentoEnviar) setErrores(validarProducto(form, productos ?? [], editandoId))
  }, [form, productos, intentoEnviar, editandoId])

  const cambiar = (campo) => (e) => {
    setExito('')
    const valor = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function limpiarFormulario() {
    setForm(VACIO)
    setEditandoId(null)
    setIntentoEnviar(false)
    setErrores({})
  }

  function empezarEdicion(p) {
    setError('')
    setExito('')
    setEditandoId(p.id)
    setForm({ nombre: p.nombre, descripcion: p.descripcion ?? '', categoria: p.categoria, precio: String(p.precio), disponible: p.disponible })
    setIntentoEnviar(false)
    setErrores({})
  }

  async function guardar(e) {
    e.preventDefault()
    setIntentoEnviar(true)
    setError('')
    setExito('')
    const errs = validarProducto(form, productos ?? [], editandoId)
    setErrores(errs)
    if (Object.keys(errs).length) return

    const producto = { nombre: form.nombre, descripcion: form.descripcion, categoria: form.categoria, precio: Number(form.precio), disponible: form.disponible }
    setGuardando(true)
    try {
      const guardado = editandoId ? await editarProducto(editandoId, producto) : await crearProducto(producto)
      setExito(`"${guardado.nombre}" ${editandoId ? 'se actualizó' : 'se agregó a tu catálogo'} a ${soles(guardado.precio)}.`)
      limpiarFormulario()
      cargar()
    } catch (err) {
      if (err.campos) setErrores(err.campos)
      else setError(err.message)
      if (err.status === 409 || err.status === 404) cargar()
    } finally {
      setGuardando(false)
    }
  }

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
            US11 - Gestión de catálogo
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Mi catálogo</h1>
          <p className="text-sm text-[#6b5443] mt-1.5 max-w-xl mx-auto">
            Registra los productos que vendes, con su categoría y precio. Marca como no disponibles los que se te acabaron.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          {/* Formulario de alta y edición (T50) */}
          <form onSubmit={guardar} noValidate className="bg-white rounded-3xl border border-[#ebe3d9] shadow-xl p-5 sm:p-6 space-y-4 self-start">
            <h2 className="text-lg font-bold">{editandoId ? 'Editar producto' : 'Nuevo producto'}</h2>

            <div>
              <label htmlFor="nombre" className="block text-sm font-semibold mb-1.5">Nombre</label>
              <input
                id="nombre"
                type="text"
                maxLength={60}
                placeholder="Ej. Emoliente con maca"
                value={form.nombre}
                onChange={cambiar('nombre')}
                className={claseCampo(errores.nombre)}
              />
              <ErrorCampo mensaje={errores.nombre} />
            </div>

            <div>
              <label htmlFor="descripcion" className="block text-sm font-semibold mb-1.5">
                Descripción <span className="font-normal text-[#9a8676]">(opcional)</span>
              </label>
              <textarea
                id="descripcion"
                rows={2}
                maxLength={DESCRIPCION_MAXIMA}
                placeholder="Ej. Linaza, cola de caballo y alfalfa"
                value={form.descripcion}
                onChange={cambiar('descripcion')}
                className={claseCampo(errores.descripcion)}
              />
              <ErrorCampo mensaje={errores.descripcion} />
            </div>

            <div>
              <label htmlFor="categoria" className="block text-sm font-semibold mb-1.5">Categoría</label>
              <select id="categoria" value={form.categoria} onChange={cambiar('categoria')} className={claseCampo(errores.categoria)}>
                <option value="">Elige una categoría</option>
                {Object.entries(CATEGORIAS).map(([clave, nombre]) => (
                  <option key={clave} value={clave}>{nombre}</option>
                ))}
              </select>
              <ErrorCampo mensaje={errores.categoria} />
            </div>

            <div>
              <label htmlFor="precio" className="block text-sm font-semibold mb-1.5">Precio (S/)</label>
              <input
                id="precio"
                type="number"
                inputMode="decimal"
                min="0.10"
                step="0.10"
                placeholder="Ej. 2.50"
                value={form.precio}
                onChange={cambiar('precio')}
                className={claseCampo(errores.precio)}
              />
              <ErrorCampo mensaje={errores.precio} />
            </div>

            <label className="flex items-center gap-2.5 text-sm font-semibold">
              <input type="checkbox" checked={form.disponible} onChange={cambiar('disponible')} className="w-4 h-4 accent-[#b8581a]" />
              Disponible para la venta
            </label>

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
              disabled={guardando || !productos}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white shadow-md bg-gradient-to-r from-[#b8581a] to-[#e67e22] hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Agregar producto'}
            </button>
            {editandoId && (
              <button type="button" onClick={limpiarFormulario} className="w-full py-2.5 rounded-xl font-semibold text-sm text-[#6b5443] hover:bg-[#fbf6ef]">
                Cancelar edición
              </button>
            )}
          </form>

          {/* Catálogo agrupado por categoría */}
          <section className="bg-white rounded-3xl border border-[#ebe3d9] shadow-xl p-5 sm:p-6">
            <h2 className="text-lg font-bold mb-4">Mis productos</h2>
            {!productos && !error && <p className="text-sm text-[#9a8676]">Cargando…</p>}
            {productos?.length === 0 && <p className="text-sm text-[#9a8676]">Aún no registras productos.</p>}
            <div className="space-y-4">
              {Object.entries(CATEGORIAS).map(([clave, nombreCategoria]) => {
                const deCategoria = (productos ?? []).filter((p) => p.categoria === clave)
                if (!deCategoria.length) return null
                return (
                  <div key={clave}>
                    <h3 className="text-xs font-bold text-[#9a8676] uppercase tracking-wider mb-2">{nombreCategoria}</h3>
                    <ul className="space-y-2">
                      {deCategoria.map((p) => (
                        <li
                          key={p.id}
                          className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
                            editandoId === p.id ? 'bg-orange-50 border-orange-200' : 'bg-[#fbf6ef] border-[#ebe3d9]'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{p.nombre}</p>
                            <p className="text-xs">
                              <span className="font-mono font-bold text-[#b8581a]">{soles(p.precio)}</span>
                              <span className={`ml-2 font-semibold ${p.disponible ? 'text-emerald-700' : 'text-[#9a8676]'}`}>
                                {p.disponible ? 'Disponible' : 'No disponible'}
                              </span>
                            </p>
                          </div>
                          <button type="button" onClick={() => empezarEdicion(p)} className="shrink-0 text-xs font-bold text-[#b8581a] hover:underline">
                            Editar
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
