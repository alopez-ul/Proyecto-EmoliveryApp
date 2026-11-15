// US07 - T37: Interfaz/Estrategia CriterioOrden y clases concretas (RNF18 - Principio Abierto/Cerrado)
// Permite extender nuevos criterios de ordenamiento sin modificar Localizador ni MapaController.

import { Ubicacion } from './Ubicacion.js'

function asegurarUbicacion(u) {
  if (u instanceof Ubicacion) return u
  return new Ubicacion({
    latitud: u.latitud ?? u.lat,
    longitud: u.longitud ?? u.lng,
    fechaHora: u.fechaHora ?? u.registradaEn ?? new Date(),
    margenErrorMetros: u.margenErrorMetros ?? u.precisionM ?? 15,
    zona: u.zona ?? 'La Molina',
  })
}

export class CriterioOrden {
  constructor() {
    if (new.target === CriterioOrden) {
      throw new TypeError('CriterioOrden es una abstracción: instancia una estrategia concreta.')
    }
  }

  /**
   * Ordena una lista de emolienteros respecto a la ubicación del cliente.
   * @param {Array<Object>} _listaEmolienteros
   * @param {Ubicacion|Object} _ubicacionCliente
   * @returns {Array<Object>}
   */
  ordenar(_listaEmolienteros, _ubicacionCliente) {
    throw new Error(`${this.constructor.name} debe implementar el método ordenar(listaEmolienteros, ubicacionCliente).`)
  }
}

/**
 * Estrategia principal de US07 (T37): Ordena emolienteros activos de menor a mayor distancia en metros.
 */
export class CriterioPorDistancia extends CriterioOrden {
  static CODIGO = 'distancia'

  ordenar(listaEmolienteros, ubicacionCliente) {
    if (!Array.isArray(listaEmolienteros)) return []
    const origen = ubicacionCliente ? asegurarUbicacion(ubicacionCliente) : null

    const enriquecidos = listaEmolienteros.map((emo) => {
      let distanciaMetros = emo.distanciaMetros
      if (origen && typeof distanciaMetros !== 'number') {
        const destino = asegurarUbicacion(emo.ubicacion ?? emo)
        distanciaMetros = origen.calcularDistanciaGeodesica(destino)
      }
      return {
        ...emo,
        distanciaMetros: typeof distanciaMetros === 'number' ? distanciaMetros : null,
      }
    })

    return enriquecidos.sort((a, b) => {
      const distA = a.distanciaMetros ?? Number.MAX_SAFE_INTEGER
      const distB = b.distanciaMetros ?? Number.MAX_SAFE_INTEGER
      if (distA !== distB) return distA - distB
      // A igual distancia, prioriza mayor calificación promedio
      return (b.calificacionPromedio ?? 0) - (a.calificacionPromedio ?? 0)
    })
  }
}

/**
 * Estrategia adicional para demostrar el cumplimiento del Principio Abierto/Cerrado (RNF18):
 * Ordena de mayor a menor calificación promedio, desempatando por menor distancia.
 */
export class CriterioPorCalificacion extends CriterioOrden {
  static CODIGO = 'calificacion'

  ordenar(listaEmolienteros, ubicacionCliente) {
    if (!Array.isArray(listaEmolienteros)) return []
    const porDistancia = new CriterioPorDistancia().ordenar(listaEmolienteros, ubicacionCliente)

    return porDistancia.sort((a, b) => {
      const calA = a.calificacionPromedio ?? 0
      const calB = b.calificacionPromedio ?? 0
      if (calB !== calA) return calB - calA
      const distA = a.distanciaMetros ?? Number.MAX_SAFE_INTEGER
      const distB = b.distanciaMetros ?? Number.MAX_SAFE_INTEGER
      return distA - distB
    })
  }
}
