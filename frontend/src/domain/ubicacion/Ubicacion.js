// US07 - T35: Clase de dominio Ubicacion
// Encapsula las coordenadas geográficas, margen de error, marca temporal y el cálculo
// de distancia geodésica exacta mediante la fórmula de Haversine en metros.

export const RADIO_TIERRA_METROS = 6_371_000

// Límites referenciales del distrito de La Molina (zona piloto del proyecto EMOLIVERY)
export const LIMITES_LA_MOLINA = {
  latMin: -12.135,
  latMax: -12.055,
  lngMin: -76.975,
  lngMax: -76.865,
}

const aRadianes = (grados) => (grados * Math.PI) / 180

export class Ubicacion {
  /**
   * @param {Object} params
   * @param {number} [params.latitud]
   * @param {number} [params.longitud]
   * @param {number} [params.lat] - Alias compatible con servicios del backend
   * @param {number} [params.lng] - Alias compatible con servicios del backend
   * @param {Date|string|number} [params.fechaHora]
   * @param {number} [params.margenErrorMetros]
   * @param {string} [params.zona]
   */
  constructor({
    latitud,
    longitud,
    lat,
    lng,
    fechaHora = new Date(),
    margenErrorMetros = 15,
    zona = 'La Molina',
  } = {}) {
    const latFinal = Number(latitud ?? lat)
    const lngFinal = Number(longitud ?? lng)

    if (!Number.isFinite(latFinal) || !Number.isFinite(lngFinal)) {
      throw new TypeError('Ubicacion requiere latitud y longitud numéricas válidas.')
    }
    if (latFinal < -90 || latFinal > 90 || lngFinal < -180 || lngFinal > 180) {
      throw new RangeError('Las coordenadas están fuera del rango geográfico permitido.')
    }

    this.latitud = latFinal
    this.longitud = lngFinal
    this.fechaHora = fechaHora instanceof Date ? fechaHora : new Date(fechaHora)
    this.margenErrorMetros = Number(margenErrorMetros) || 15
    this.zona = zona
  }

  // Getters de compatibilidad con componentes de mapa que leen .lat / .lng
  get lat() {
    return this.latitud
  }

  get lng() {
    return this.longitud
  }

  /**
   * T35: Calcula la distancia geodésica entre esta ubicación y otra usando la fórmula de Haversine.
   * @param {Ubicacion|{latitud?: number, longitud?: number, lat?: number, lng?: number}} otraUbicacion
   * @returns {number} Distancia en metros redondeada a entero.
   */
  calcularDistanciaGeodesica(otraUbicacion) {
    if (!otraUbicacion) {
      throw new TypeError('Se requiere una segunda ubicación para calcular la distancia geodésica.')
    }

    const lat2 = Number(otraUbicacion.latitud ?? otraUbicacion.lat)
    const lng2 = Number(otraUbicacion.longitud ?? otraUbicacion.lng)

    if (!Number.isFinite(lat2) || !Number.isFinite(lng2)) {
      throw new TypeError('La ubicación destino no contiene coordenadas válidas.')
    }

    const dLat = aRadianes(lat2 - this.latitud)
    const dLng = aRadianes(lng2 - this.longitud)

    const phi1 = aRadianes(this.latitud)
    const phi2 = aRadianes(lat2)

    const sinDLat = Math.sin(dLat / 2)
    const sinDLng = Math.sin(dLng / 2)

    const a =
      sinDLat * sinDLat +
      Math.cos(phi1) * Math.cos(phi2) * sinDLng * sinDLng

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))
    return Math.round(RADIO_TIERRA_METROS * c)
  }

  /**
   * Verifica si la ubicación se encuentra dentro de los límites referenciales de La Molina.
   * @returns {boolean}
   */
  estaEnLaMolina() {
    return (
      this.latitud >= LIMITES_LA_MOLINA.latMin &&
      this.latitud <= LIMITES_LA_MOLINA.latMax &&
      this.longitud >= LIMITES_LA_MOLINA.lngMin &&
      this.longitud <= LIMITES_LA_MOLINA.lngMax
    )
  }
}
