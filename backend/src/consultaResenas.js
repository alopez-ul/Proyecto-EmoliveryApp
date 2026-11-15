// US18 - Consultar reseñas y calificación: reglas de la vista (no usa la base de datos).

// T87: promedio (con un decimal) y total de las reseñas publicadas.
// T88: un emolientero sin reseñas tiene total 0 y promedio null (no 0, que parecería una mala nota).
export function resumenResenas(resenas) {
  const total = resenas.length
  if (!total) return { total: 0, promedio: null }
  const suma = resenas.reduce((s, r) => s + r.calificacion, 0)
  return { total, promedio: Math.round((suma / total) * 10) / 10 }
}

// T87: de la más reciente a la más antigua. Si dos tienen la misma fecha, primero la de mayor id.
export function ordenarPorFecha(resenas) {
  return [...resenas].sort((a, b) => new Date(b.publicadaEn) - new Date(a.publicadaEn) || b.id - a.id)
}

// Privacidad: en la vista pública el autor se muestra con su nombre y la inicial del apellido ("Carla C.").
export function nombrePublico(nombre) {
  const [primero = 'Cliente', segundo] = String(nombre ?? '').trim().split(/\s+/).filter(Boolean)
  return segundo ? `${primero} ${segundo[0].toUpperCase()}.` : primero
}
