// US02: registro de emolientero. Si el servidor rechaza el formulario, el error trae `campos`
// con el mensaje de cada campo (400 datos inválidos, 409 DNI / código / correo ya registrados).
export async function registrarEmolientero(datos) {
  let res
  try {
    res = await fetch('/api/emolienteros/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor. Inténtalo de nuevo.')
  }
  const respuesta = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw Object.assign(new Error(respuesta.error || 'No se pudo completar el registro.'), { campos: respuesta.campos })
  }
  return respuesta.emolientero
}
