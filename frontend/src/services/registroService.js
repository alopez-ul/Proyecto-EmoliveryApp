// Registro de cuentas (US01 cliente, US02 emolientero). Si el servidor rechaza el formulario, el error
// trae `campos` con el mensaje de cada campo (400 datos inválidos, 409 datos ya registrados).
async function enviarRegistro(ruta, datos) {
  let res
  try {
    res = await fetch(ruta, {
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
  return respuesta
}

// US02
export async function registrarEmolientero(datos) {
  return (await enviarRegistro('/api/emolienteros/registro', datos)).emolientero
}

// US01
export async function registrarCliente(datos) {
  return (await enviarRegistro('/api/clientes/registro', datos)).cliente
}
