import { useState } from 'react'

const VACIO = { nombre: '', encargado: '', direccion: '', horario: '' }

export default function NuevoPuntoForm({ borrador, onSubmit, onCancel }) {
  const [form, setForm] = useState(VACIO)
  const [error, setError] = useState('')

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!borrador) return setError('Haz clic en el mapa para fijar la ubicación.')
    setError('')
    try {
      await onSubmit({ ...form, lat: borrador.lat, lng: borrador.lng })
      setForm(VACIO)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="panel nuevo-punto">
      <header className="panel-header">
        <h2 className="panel-title">Nuevo punto de venta</h2>
        <button className="icon-btn" onClick={onCancel} aria-label="Cancelar">✕</button>
      </header>
      <p className="muted">
        {borrador
          ? `Ubicación fijada: ${borrador.lat.toFixed(5)}, ${borrador.lng.toFixed(5)}`
          : 'Haz clic en el mapa para fijar la ubicación.'}
      </p>
      <form onSubmit={handleSubmit}>
        <label>Nombre<input required value={form.nombre} onChange={set('nombre')} placeholder="Carretilla Doña Juana" /></label>
        <label>Encargado<input required value={form.encargado} onChange={set('encargado')} placeholder="Juana Pérez" /></label>
        <label>Dirección<input value={form.direccion} onChange={set('direccion')} placeholder="Av. Arequipa 1200" /></label>
        <label>Horario<input value={form.horario} onChange={set('horario')} placeholder="05:00 - 10:00" /></label>
        <button className="btn btn-primary" type="submit">Registrar punto</button>
        {error && <p className="error">{error}</p>}
      </form>
    </section>
  )
}
