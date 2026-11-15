// US12: catálogo público de un emolientero (no requiere sesión).
export async function obtenerCatalogo(emolienteroId) {
  let res
  try {
    res = await fetch(`/api/catalogo/${encodeURIComponent(emolienteroId)}`)
  } catch {
    throw new Error('No se pudo conectar con el servidor. Inténtalo de nuevo.')
  }
  const datos = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(datos.error || 'No se pudo cargar el catálogo.'), { status: res.status })
  return datos
}
