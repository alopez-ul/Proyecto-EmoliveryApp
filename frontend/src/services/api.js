const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Error ${res.status}`)
  }
  return res.status === 204 ? null : res.json()
}

export const api = {
  getPuntos: () => request('/puntos'),
  crearPunto: (punto) => request('/puntos', { method: 'POST', body: punto }),
  actualizarPunto: (id, cambios) => request(`/puntos/${id}`, { method: 'PATCH', body: cambios }),
  eliminarPunto: (id) => request(`/puntos/${id}`, { method: 'DELETE' }),
  getProductos: () => request('/productos'),
  getVentas: (puntoId) => request(puntoId ? `/ventas?puntoId=${puntoId}` : '/ventas'),
  registrarVenta: (venta) => request('/ventas', { method: 'POST', body: venta }),
  getResumen: () => request('/ventas/resumen'),
}
