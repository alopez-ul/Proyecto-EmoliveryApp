// Error con código HTTP: el manejador de errores de server.js responde con ese código y mensaje.
export class ErrorHttp extends Error {
  constructor(status, mensaje) {
    super(mensaje)
    this.status = status
  }
}
