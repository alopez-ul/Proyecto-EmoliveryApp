export default function PuntoList({ puntos, seleccionado, onSelect }) {
  return (
    <section className="panel punto-list">
      <h2 className="panel-title">Puntos de venta</h2>
      {puntos.length === 0 && <p className="muted">Aún no hay puntos de venta registrados.</p>}
      <ul>
        {puntos.map((p) => (
          <li key={p.id}>
            <button
              className={`punto-item ${seleccionado?.id === p.id ? 'is-selected' : ''}`}
              onClick={() => onSelect(p)}
            >
              <span className={`status-led ${p.activo ? 'on' : 'off'}`} />
              <span className="punto-info">
                <strong>{p.nombre}</strong>
                <small>{p.direccion || `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`}</small>
              </span>
              <span className="punto-id">#{String(p.id).padStart(3, '0')}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
