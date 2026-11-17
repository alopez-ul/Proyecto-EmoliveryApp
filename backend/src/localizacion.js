// US07 - T35, T36, T37, T39, T40: Dominio de Localización en Backend
// Implementa la clase Ubicacion (fórmula de Haversine en metros), la jerarquía CriterioOrden
// (CriterioPorDistancia y CriterioPorCalificacion - RNF18) y el servicio Localizador / MapaController.

import { dentroDeLaMolina } from './zonaCobertura.js'

export const RADIO_TIERRA_METROS = 6_371_000
export const VIGENCIA_MAXIMA_UBICACION_MIN = 240 // 4 horas (US08)

const aRadianes = (grados) => (grados * Math.PI) / 180

export class Ubicacion {
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

  get lat() {
    return this.latitud
  }

  get lng() {
    return this.longitud
  }

  // T35: Fórmula de Haversine que devuelve la distancia geodésica en metros redondeada a entero.
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
    const a = sinDLat * sinDLat + Math.cos(phi1) * Math.cos(phi2) * sinDLng * sinDLng
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))

    return Math.round(RADIO_TIERRA_METROS * c)
  }

  estaEnLaMolina() {
    return dentroDeLaMolina(this.latitud, this.longitud)
  }
}

// T37 (RNF18): Abstracción CriterioOrden y estrategias concretas
export class CriterioOrden {
  constructor() {
    if (new.target === CriterioOrden) {
      throw new TypeError('CriterioOrden es una abstracción: instancia una estrategia concreta.')
    }
  }

  ordenar(_listaEmolienteros, _ubicacionCliente) {
    throw new Error(`${this.constructor.name} debe implementar ordenar(listaEmolienteros, ubicacionCliente).`)
  }
}

export class CriterioPorDistancia extends CriterioOrden {
  static CODIGO = 'distancia'

  ordenar(listaEmolienteros, ubicacionCliente) {
    if (!Array.isArray(listaEmolienteros)) return []
    const origen =
      ubicacionCliente instanceof Ubicacion
        ? ubicacionCliente
        : ubicacionCliente
          ? new Ubicacion(ubicacionCliente)
          : null

    const enriquecidos = listaEmolienteros.map((emo) => {
      let distanciaMetros = emo.distanciaMetros
      if (origen && typeof distanciaMetros !== 'number') {
        const destino =
          emo.ubicacion instanceof Ubicacion ? emo.ubicacion : new Ubicacion(emo.ubicacion ?? emo)
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
      return (b.calificacionPromedio ?? 0) - (a.calificacionPromedio ?? 0)
    })
  }
}

export class CriterioPorCalificacion extends CriterioOrden {
  static CODIGO = 'calificacion'

  ordenar(listaEmolienteros, ubicacionCliente) {
    if (!Array.isArray(listaEmolienteros)) return []
    const porDistancia = new CriterioPorDistancia().ordenar(listaEmolienteros, ubicacionCliente)
    return porDistancia.sort((a, b) => {
      const calA = a.calificacionPromedio ?? 0
      const calB = b.calificacionPromedio ?? 0
      if (calB !== calA) return calB - calA
      return (a.distanciaMetros ?? Number.MAX_SAFE_INTEGER) - (b.distanciaMetros ?? Number.MAX_SAFE_INTEGER)
    })
  }
}

export const EMOLIENTEROS_SEMILLA_LA_MOLINA = [
  {
    id: 'emo-01',
    nombre: 'Don Lucho - Tradición Molulana',
    encargado: 'Luis Alberto Quispe Mamani',
    codigoMunicipal: 'MLM-2026-00104',
    telefonoYape: '987654321',
    latitud: -12.0731,
    longitud: -76.9502,
    zona: 'La Fontana',
    direccionReferencia: 'Av. La Fontana 550 (Frente a Puerta Principal USIL)',
    calificacionPromedio: 4.9,
    totalResenas: 142,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 4,
    fuente: 'gps_emolientero',
  },
  {
    id: 'emo-02',
    nombre: 'Doña Rosa - El Buen Emoliente',
    encargado: 'Rosa Elena Huamán Cárdenas',
    codigoMunicipal: 'MLM-2026-00118',
    telefonoYape: '984112233',
    latitud: -12.0725,
    longitud: -76.9548,
    zona: 'La Fontana',
    direccionReferencia: 'Óvalo La Fontana con Av. La Molina',
    calificacionPromedio: 4.8,
    totalResenas: 98,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 9,
    fuente: 'gps_emolientero',
  },
  {
    id: 'emo-03',
    nombre: 'Puesto San Martín - La Fontana',
    encargado: 'Martín Condori Vilca',
    codigoMunicipal: 'MLM-2026-00125',
    telefonoYape: '991234567',
    latitud: -12.0742,
    longitud: -76.9475,
    zona: 'La Fontana',
    direccionReferencia: 'Cruce Av. La Fontana con Calle Los Olivos',
    calificacionPromedio: 4.7,
    totalResenas: 76,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 22,
    fuente: 'gps_emolientero',
  },
  {
    id: 'emo-04',
    nombre: 'Emolientes El Sabio - U. de Lima',
    encargado: 'Jorge Chávez Rojas',
    codigoMunicipal: 'MLM-2026-00139',
    telefonoYape: '998877665',
    latitud: -12.0846,
    longitud: -76.9702,
    zona: 'Camacho',
    direccionReferencia: 'Av. Javier Prado Este cdra. 46 (Frente a U. de Lima)',
    calificacionPromedio: 4.9,
    totalResenas: 215,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 6,
    fuente: 'gps_emolientero',
  },
  {
    id: 'emo-05',
    nombre: 'Carretilla Doña Carmen - Camacho',
    encargado: 'Carmen Rosa Mendoza',
    codigoMunicipal: 'MLM-2026-00142',
    telefonoYape: '976543210',
    latitud: -12.0818,
    longitud: -76.9665,
    zona: 'Camacho',
    direccionReferencia: 'Av. Las Palmeras con Av. Javier Prado Este (Plaza Camacho)',
    calificacionPromedio: 4.6,
    totalResenas: 64,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 35,
    fuente: 'avistamiento_verificado',
  },
  {
    id: 'emo-06',
    nombre: 'Hierbas Andinas - Santa Patricia',
    encargado: 'Pedro Pablo Gutiérrez',
    codigoMunicipal: 'MLM-2026-00156',
    telefonoYape: '965432189',
    latitud: -12.0672,
    longitud: -76.9462,
    zona: 'Santa Patricia',
    direccionReferencia: 'Av. Flora Tristán cdra. 5 (Parque Santa Patricia)',
    calificacionPromedio: 4.8,
    totalResenas: 89,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 11,
    fuente: 'gps_emolientero',
  },
  {
    id: 'emo-08',
    nombre: 'El Rincón del Emoliente - Molicentro',
    encargado: 'Roberto Carlos Vargas',
    codigoMunicipal: 'MLM-2026-00171',
    telefonoYape: '943218765',
    latitud: -12.0785,
    longitud: -76.9365,
    zona: 'Rinconada',
    direccionReferencia: 'Av. La Molina cdra. 14 (Frente a C.C. Molicentro)',
    calificacionPromedio: 4.9,
    totalResenas: 131,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 7,
    fuente: 'gps_emolientero',
  },
  {
    id: 'emo-11',
    nombre: 'Emolientes Sol de Oro',
    encargado: 'Héctor Ramos Choque',
    codigoMunicipal: 'MLM-2026-00205',
    telefonoYape: '918273645',
    latitud: -12.0858,
    longitud: -76.9125,
    zona: 'Sol de La Molina',
    direccionReferencia: 'Av. La Molina cdra. 28 (Cruce El Sol de La Molina)',
    calificacionPromedio: 4.7,
    totalResenas: 81,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 12,
    fuente: 'gps_emolientero',
  },
  {
    id: 'emo-13',
    nombre: 'Cooperativa Tradicional Musa',
    encargado: 'Félix Cahuana Lipa',
    codigoMunicipal: 'MLM-2026-00231',
    telefonoYape: '936451827',
    latitud: -12.0928,
    longitud: -76.8975,
    zona: 'Musa',
    direccionReferencia: 'Av. La Molina cdra. 36 (Mercado Cooperativo Musa)',
    calificacionPromedio: 4.8,
    totalResenas: 119,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 5,
    fuente: 'gps_emolientero',
  },
  {
    id: 'emo-15',
    nombre: 'El Mirador de Las Viñas',
    encargado: 'César Augusto Paredes',
    codigoMunicipal: 'MLM-2026-00258',
    telefonoYape: '951827364',
    latitud: -12.0985,
    longitud: -76.9482,
    zona: 'Las Viñas',
    direccionReferencia: 'Av. Los Fresnos cdra. 12 (Parque Las Viñas)',
    calificacionPromedio: 4.8,
    totalResenas: 94,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 10,
    fuente: 'gps_emolientero',
  },
  {
    id: 'emo-inactivo',
    nombre: 'Puesto Cerrado',
    encargado: 'Andrés Salazar',
    codigoMunicipal: 'MLM-2026-00295',
    latitud: -12.0733,
    longitud: -76.9510,
    zona: 'La Fontana',
    calificacionPromedio: 4.2,
    jornadaAbierta: false,
    estadoCuenta: 'activo',
    antiguedadMin: 10,
    fuente: 'gps_emolientero',
  },
  {
    id: 'emo-expirado',
    nombre: 'Puesto con Ubicación Expirada',
    encargado: 'Rubén Gómez',
    codigoMunicipal: 'MLM-2026-00299',
    latitud: -12.0736,
    longitud: -76.9515,
    zona: 'La Fontana',
    calificacionPromedio: 4.1,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 285,
    fuente: 'gps_emolientero',
  },
]

function normalizarEmolientero(raw) {
  const ubicacion =
    raw.ubicacion instanceof Ubicacion
      ? raw.ubicacion
      : new Ubicacion({
          latitud: raw.latitud ?? raw.lat,
          longitud: raw.longitud ?? raw.lng,
          zona: raw.zona ?? 'La Molina',
        })
  return {
    ...raw,
    latitud: ubicacion.latitud,
    longitud: ubicacion.longitud,
    ubicacion,
    antiguedadMin: Number(raw.antiguedadMin ?? 5),
  }
}

export class Localizador {
  constructor(catalogo = EMOLIENTEROS_SEMILLA_LA_MOLINA, criterioOrden = new CriterioPorDistancia()) {
    this.catalogo = catalogo.map(normalizarEmolientero)
    this.criterioOrden = criterioOrden
  }

  obtenerEmolienterosElegibles() {
    return this.catalogo.filter((emo) => {
      const activo = emo.jornadaAbierta === true && (emo.estadoCuenta ?? 'activo') === 'activo'
      const enZona = emo.ubicacion.estaEnLaMolina()
      const confirmada = (emo.antiguedadMin ?? 0) <= VIGENCIA_MAXIMA_UBICACION_MIN
      return activo && enZona && confirmada
    })
  }

  buscarCercanos({ ubicacionCliente, radioMetros = 1000, criterioOrden = this.criterioOrden } = {}) {
    if (!ubicacionCliente) return []
    const origen =
      ubicacionCliente instanceof Ubicacion ? ubicacionCliente : new Ubicacion(ubicacionCliente)
    const radio = Number(radioMetros) || 1000
    const elegibles = this.obtenerEmolienterosElegibles()

    const cercanos = []
    for (const emo of elegibles) {
      const distanciaMetros = origen.calcularDistanciaGeodesica(emo.ubicacion)
      if (distanciaMetros <= radio) {
        cercanos.push({ ...emo, distanciaMetros })
      }
    }

    const estrategia = criterioOrden ?? this.criterioOrden ?? new CriterioPorDistancia()
    return estrategia.ordenar(cercanos, origen)
  }

  buscarPorZona({ zona = 'Todas las zonas', textoBusqueda = '', ubicacionCliente = null } = {}) {
    const elegibles = this.obtenerEmolienterosElegibles()
    const termino = textoBusqueda.trim().toLowerCase()

    const filtrados = elegibles.filter((emo) => {
      const coincideZona = !zona || zona === 'Todas las zonas' || emo.zona.toLowerCase() === zona.toLowerCase()
      const coincideTexto =
        !termino ||
        emo.nombre.toLowerCase().includes(termino) ||
        emo.zona.toLowerCase().includes(termino) ||
        (emo.direccionReferencia ?? '').toLowerCase().includes(termino)
      return coincideZona && coincideTexto
    })

    if (ubicacionCliente) {
      return this.criterioOrden.ordenar(filtrados, ubicacionCliente)
    }
    return new CriterioPorCalificacion().ordenar(filtrados, null)
  }
}

export function generarEmolienterosBenchmark(cantidad = 50) {
  const zonas = ['La Fontana', 'Camacho', 'Santa Patricia', 'Rinconada', 'Sol de La Molina', 'Musa', 'Las Viñas']
  const lista = []
  for (let i = 1; i <= cantidad; i++) {
    const fila = Math.floor((i - 1) / 8)
    const col = (i - 1) % 8
    const latitud = Number((-12.066 - fila * 0.0042 - (i % 3) * 0.0007).toFixed(6))
    const longitud = Number((-76.962 + col * 0.0065 + (i % 4) * 0.0005).toFixed(6))
    lista.push({
      id: `bench-${i}`,
      nombre: `Puesto Emolivery #${i}`,
      codigoMunicipal: `MLM-2026-${10000 + i}`,
      latitud,
      longitud,
      zona: zonas[i % zonas.length],
      calificacionPromedio: Number((4.3 + (i % 7) * 0.1).toFixed(1)),
      jornadaAbierta: true,
      estadoCuenta: 'activo',
      antiguedadMin: (i * 3) % 75,
    })
  }
  return lista
}

export class MapaController {
  constructor(catalogoInicial = EMOLIENTEROS_SEMILLA_LA_MOLINA) {
    this.localizador = new Localizador(catalogoInicial, new CriterioPorDistancia())
  }

  obtenerCercanos({ latitud, longitud, radioMetros = 1000, tipoOrden = 'distancia' } = {}) {
    const criterio =
      tipoOrden === 'calificacion' ? new CriterioPorCalificacion() : new CriterioPorDistancia()
    const ubicacionCliente = new Ubicacion({ latitud, longitud })
    const emolienteros = this.localizador.buscarCercanos({
      ubicacionCliente,
      radioMetros,
      criterioOrden: criterio,
    })

    return {
      ubicacionCliente,
      radioMetros: Number(radioMetros),
      totalEncontrados: emolienteros.length,
      mensajeVacio: emolienteros.length === 0 ? 'No hay emolienteros cercanos disponibles' : null,
      emolienteros,
    }
  }

  obtenerPorZona({ zona = 'Todas las zonas', textoBusqueda = '' } = {}) {
    const emolienteros = this.localizador.buscarPorZona({ zona, textoBusqueda })
    return {
      zona,
      totalEncontrados: emolienteros.length,
      emolienteros,
    }
  }

  ejecutarBenchmarkRNF01(
    cantidad = 50,
    coordenadasCliente = { latitud: -12.0734, longitud: -76.9512 },
    radioMetros = 5000,
  ) {
    const inicio = performance.now()
    const dataset = generarEmolienterosBenchmark(cantidad)
    const loc = new Localizador(dataset, new CriterioPorDistancia())
    const origen = new Ubicacion(coordenadasCliente)
    const ordenados = loc.buscarCercanos({ ubicacionCliente: origen, radioMetros })
    const duracionMs = Math.max(0.05, Number((performance.now() - inicio).toFixed(3)))

    return {
      cantidadGenerada: cantidad,
      totalRenderizados: ordenados.length,
      duracionMs,
      limiteMaximoMs: 3000,
      cumpleRNF01: duracionMs < 3000,
      emolienteros: ordenados,
    }
  }
}
