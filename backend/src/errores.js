// Error con código HTTP: el manejador de errores de app.js responde con ese código y mensaje.
// `campos` (opcional) lleva el error de cada campo de un formulario: { dni: 'mensaje', ... }.
export class ErrorHttp extends Error {
  constructor(status, mensaje, campos) {
    super(mensaje)
    this.status = status
    this.campos = campos
  }
}
