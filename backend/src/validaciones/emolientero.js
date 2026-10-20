// US02 - T06: validación del formulario de registro de emolientero. Es la que decide;
// el frontend repite estas reglas solo para avisar antes de enviar.
// La contraseña se valida aparte con validarPassword (seguridad.js), igual que en US04.

// Autorización municipal de La Molina: MLM-<año de emisión>-<correlativo de 5 dígitos>.
export const FORMATO_CODIGO_MUNICIPAL = /^MLM-(\d{4})-(\d{5})$/
export const AÑO_MINIMO_AUTORIZACION = 2000

const DNI = /^\d{8}$/
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TELEFONO = /^9\d{8}$/

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '')

// Devuelve el mensaje de error del código, o null si es válido.
export function errorCodigoMunicipal(codigo, hoy = new Date()) {
  if (!codigo) return 'El código de autorización municipal es obligatorio.'
  const partes = FORMATO_CODIGO_MUNICIPAL.exec(codigo)
  if (!partes) return 'El código debe tener el formato MLM-AAAA-NNNNN (por ejemplo, MLM-2025-00123).'
  const año = Number(partes[1])
  if (año < AÑO_MINIMO_AUTORIZACION || año > hoy.getFullYear()) {
    return `El año del código debe estar entre ${AÑO_MINIMO_AUTORIZACION} y ${hoy.getFullYear()}.`
  }
  if (partes[2] === '00000') return 'El correlativo del código no puede ser 00000.'
  return null
}

// Devuelve { datos, errores }. errores es un objeto campo → mensaje; vacío si todo es válido.
export function validarRegistroEmolientero(body, hoy = new Date()) {
  const datos = {
    nombreNegocio: texto(body?.nombreNegocio).replace(/\s+/g, ' '),
    dni: texto(body?.dni),
    codigoMunicipal: texto(body?.codigoMunicipal).toUpperCase(),
    telefono: texto(body?.telefono).replace(/[\s-]/g, ''),
    correo: texto(body?.correo).toLowerCase(),
  }
  const errores = {}

  if (datos.nombreNegocio.length < 3 || datos.nombreNegocio.length > 100) {
    errores.nombreNegocio = 'El nombre del titular o puesto debe tener entre 3 y 100 caracteres.'
  }
  if (!DNI.test(datos.dni)) errores.dni = 'El DNI debe contener exactamente 8 dígitos numéricos.'
  const errorCodigo = errorCodigoMunicipal(datos.codigoMunicipal, hoy)
  if (errorCodigo) errores.codigoMunicipal = errorCodigo
  if (!TELEFONO.test(datos.telefono)) errores.telefono = 'Debe ser un número válido de 9 dígitos que comience con 9.'
  if (datos.correo.length > 254 || !CORREO.test(datos.correo)) errores.correo = 'Ingresa un correo con formato válido.'

  return { datos, errores }
}
