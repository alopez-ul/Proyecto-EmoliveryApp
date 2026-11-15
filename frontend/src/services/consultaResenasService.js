// US18: reseñas y calificación de un emolientero (pública, no requiere sesión).
export async function obtenerResenas(emolienteroId) {
  let res
  try {
    res = await fetch(`/api/resenas/emolientero/${encodeURIComponent(emolienteroId)}`)
  } catch {
    throw new Error('No se pudo conectar con el servidor. Inténtalo de nuevo.')
  }
  const datos = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(datos.error || 'No se pudieron cargar las reseñas.'), { status: res.status })
  return datos
}
