// US01: validación del formulario de registro de cliente. Es la que decide; el frontend
// (RegistroCliente.jsx) repite estas reglas solo para avisar antes de enviar.
// La contraseña se valida aparte con validarPassword (seguridad.js), igual que en US02 y US04.

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TELEFONO = /^9\d{8}$/

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '')

// Devuelve { datos, errores }. errores es un objeto campo → mensaje; vacío si todo es válido.
export function validarRegistroCliente(body) {
  const datos = {
    nombre: texto(body?.nombre).replace(/\s+/g, ' '),
    telefono: texto(body?.telefono).replace(/[\s-]/g, ''),
    correo: texto(body?.correo).toLowerCase(),
  }
  const errores = {}

  if (datos.nombre.length < 3 || datos.nombre.length > 100) {
    errores.nombre = 'El nombre completo debe tener entre 3 y 100 caracteres.'
  }
  if (!TELEFONO.test(datos.telefono)) errores.telefono = 'Debe ser un número válido de 9 dígitos que empiece con 9.'
  if (datos.correo.length > 254 || !CORREO.test(datos.correo)) errores.correo = 'Ingresa un formato de correo electrónico válido.'

  return { datos, errores }
}
