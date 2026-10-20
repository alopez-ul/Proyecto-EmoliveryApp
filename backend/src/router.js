import { Router } from 'express'

// Router de Express 4 que envía al manejador de errores los rechazos de los handlers async
// (por ejemplo, una consulta a Postgres que falla) en vez de dejarlos sin capturar.
export function crearRouter() {
  const router = Router()
  for (const metodo of ['get', 'post', 'patch', 'delete']) {
    const original = router[metodo].bind(router)
    router[metodo] = (ruta, ...handlers) =>
      original(ruta, ...handlers.map((h) => (req, res, next) => Promise.resolve(h(req, res, next)).catch(next)))
  }
  return router
}
