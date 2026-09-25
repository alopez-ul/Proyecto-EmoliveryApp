const soles = (n) => `S/ ${n.toFixed(2)}`

export default function StatsHud({ resumen }) {
  const items = [
    { label: 'Puntos activos', value: resumen ? `${resumen.puntosActivos}/${resumen.puntosTotales}` : '--' },
    { label: 'Vasos hoy', value: resumen ? resumen.ventasHoy : '--' },
    { label: 'Ingresos hoy', value: resumen ? soles(resumen.ingresosHoy) : '--' },
    { label: 'Ingresos totales', value: resumen ? soles(resumen.ingresosTotales) : '--' },
  ]
  return (
    <div className="stats">
      {items.map((it) => (
        <div key={it.label} className="stat panel">
          <span className="stat-label">{it.label}</span>
          <span className="stat-value">{it.value}</span>
        </div>
      ))}
    </div>
  )
}
