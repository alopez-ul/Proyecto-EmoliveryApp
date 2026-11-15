// US07 - T36, T38, T39, T40: Servicio Localizador y MapaController
// Filtra emolienteros activos con jornada abierta dentro del radio seleccionado,
// excluye ubicaciones no confirmadas (> 240 min según US08), aplica la estrategia CriterioOrden
// y provee búsqueda manual por zonas de La Molina y benchmark RNF01 con 50 emolienteros.

import { Ubicacion } from './Ubicacion.js'
import { CriterioPorCalificacion, CriterioPorDistancia } from './CriterioOrden.js'

export const VIGENCIA_MAXIMA_UBICACION_MIN = 240 // 4 horas (US08)

// Coordenadas por defecto en La Molina (Av. La Fontana - frente a USIL / cerca a U. de Lima)
export const UBICACION_DEFAULT_LA_MOLINA = {
  latitud: -12.0734,
  longitud: -76.9512,
  zona: 'La Fontana',
  referencia: 'Av. La Fontana cdra. 5 (Altura USIL / Cerca a Óvalo La Fontana)',
}

// Punto extremo para simular "Radio sin emolienteros cercanos" (Límite alto de La Molina)
export const UBICACION_SIN_CERCANOS = {
  latitud: -12.1315,
  longitud: -76.8710,
  zona: 'Cieneguilla / Límite',
  referencia: 'Sector Quebrada Alta - Límite Este de La Molina',
}

export const ZONAS_LA_MOLINA = [
  'Todas las zonas',
  'La Fontana',
  'Camacho',
  'Santa Patricia',
  'Rinconada',
  'Sol de La Molina',
  'Musa',
  'Las Viñas',
  'Cieneguilla / Límite',
]

export const RADIOS_DISPONIBLES_METROS = [
  { valor: 500, etiqueta: '500 m' },
  { valor: 1000, etiqueta: '1 km (1000 m)' },
  { valor: 2000, etiqueta: '2 km (2000 m)' },
  { valor: 5000, etiqueta: '5 km (5000 m)' },
]

/**
 * Clasifica el nivel de confiabilidad según US08 y RNF15 (WCAG 2.1 AA: ícono + etiqueta explícita).
 */
export function clasificarConfiabilidad(antiguedadMin, fuente = 'gps_emolientero') {
  if (fuente === 'horario_habitual') {
    return {
      nivel: 'bajo',
      icono: '◆',
      etiqueta: 'Confiabilidad BAJA (Horario habitual)',
      descripcionAntiguedad: `Patrón horario habitual (±300 m)`,
    }
  }
  if (antiguedadMin < 15) {
    return {
      nivel: 'alto',
      icono: '●',
      etiqueta: 'Confiabilidad ALTA (< 15 min)',
      descripcionAntiguedad: `Actualizado hace ${Math.max(1, Math.round(antiguedadMin))} min`,
    }
  }
  if (antiguedadMin <= 60) {
    return {
      nivel: 'medio',
      icono: '▲',
      etiqueta: 'Confiabilidad MEDIA (15-60 min)',
      descripcionAntiguedad: `Actualizado hace ${Math.round(antiguedadMin)} min`,
    }
  }
  return {
    nivel: 'bajo',
    icono: '◆',
    etiqueta: 'Confiabilidad BAJA (Horario habitual)',
    descripcionAntiguedad: `Reporte de hace ${Math.round(antiguedadMin)} min`,
  }
}

// Riesgo R07: Carga semilla realista de emolienteros formales en puntos reales de La Molina
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
    horario: '06:00 - 11:30 / 17:00 - 22:00',
    calificacionPromedio: 4.9,
    totalResenas: 142,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 4,
    fuente: 'gps_emolientero',
    margenErrorMetros: 8,
    especialidad: 'Emoliente especial con maca negra, linaza y boldo',
    precioDesde: 3.5,
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
    horario: '06:30 - 12:00 / 16:30 - 21:30',
    calificacionPromedio: 4.8,
    totalResenas: 98,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 9,
    fuente: 'gps_emolientero',
    margenErrorMetros: 10,
    especialidad: 'Quinua carretillera con manzana y emoliente frutado',
    precioDesde: 3.0,
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
    horario: '06:00 - 11:00 / 17:30 - 22:00',
    calificacionPromedio: 4.7,
    totalResenas: 76,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 22,
    fuente: 'gps_emolientero',
    margenErrorMetros: 12,
    especialidad: 'Maca con leche, kiwicha y pan con palta fuerte',
    precioDesde: 3.5,
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
    horario: '06:30 - 13:00 / 16:00 - 22:00',
    calificacionPromedio: 4.9,
    totalResenas: 215,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 6,
    fuente: 'gps_emolientero',
    margenErrorMetros: 7,
    especialidad: 'Emoliente universitario con polen, miel y algarrobina',
    precioDesde: 4.0,
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
    horario: '06:00 - 11:30 / 17:00 - 21:30',
    calificacionPromedio: 4.6,
    totalResenas: 64,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 35,
    fuente: 'avistamiento_verificado',
    margenErrorMetros: 15,
    especialidad: 'Avena con tres leches y pan con tortilla de verduras',
    precioDesde: 3.5,
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
    horario: '06:00 - 11:00 / 17:00 - 22:00',
    calificacionPromedio: 4.8,
    totalResenas: 89,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 11,
    fuente: 'gps_emolientero',
    margenErrorMetros: 9,
    especialidad: 'Emoliente medicinal con uña de gato y chancapiedra',
    precioDesde: 3.5,
  },
  {
    id: 'emo-07',
    nombre: 'Sabor de Antaño - Melgarejo',
    encargado: 'Juana Torres Apaza',
    codigoMunicipal: 'MLM-2026-00163',
    telefonoYape: '954321876',
    latitud: -12.0695,
    longitud: -76.9428,
    zona: 'Santa Patricia',
    direccionReferencia: 'Cruce Av. Melgarejo con Av. Constructores',
    horario: '06:30 - 11:30 / 17:30 - 21:30',
    calificacionPromedio: 4.5,
    totalResenas: 53,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 48,
    fuente: 'avistamiento_cliente',
    margenErrorMetros: 18,
    especialidad: 'Quinua con piña, membrillo y pan con queso andino',
    precioDesde: 3.0,
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
    horario: '06:00 - 12:00 / 16:30 - 22:00',
    calificacionPromedio: 4.9,
    totalResenas: 131,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 7,
    fuente: 'gps_emolientero',
    margenErrorMetros: 10,
    especialidad: 'Emoliente real con siete semillas y pan con chicharrón',
    precioDesde: 4.0,
  },
  {
    id: 'emo-09',
    nombre: 'Doña Margarita - Raúl Ferrero',
    encargado: 'Margarita Soto Pineda',
    codigoMunicipal: 'MLM-2026-00184',
    telefonoYape: '932187654',
    latitud: -12.0862,
    longitud: -76.9455,
    zona: 'Rinconada',
    direccionReferencia: 'Av. Raúl Ferrero con Alameda del Corregidor (Molina Plaza)',
    horario: '06:30 - 11:30 / 17:00 - 21:30',
    calificacionPromedio: 4.8,
    totalResenas: 112,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 14,
    fuente: 'gps_emolientero',
    margenErrorMetros: 11,
    especialidad: 'Emoliente con maracuyá, muña y sándwich de pollo',
    precioDesde: 3.5,
  },
  {
    id: 'emo-10',
    nombre: 'Puesto Don Teófilo - Rinconada del Lago',
    encargado: 'Teófilo Yucra Hancco',
    codigoMunicipal: 'MLM-2026-00192',
    telefonoYape: '921876543',
    latitud: -12.0825,
    longitud: -76.9295,
    zona: 'Rinconada',
    direccionReferencia: 'Av. Laguna Grande cdra. 4 (Rinconada del Lago)',
    horario: '06:00 - 10:30 / 17:30 - 21:00',
    calificacionPromedio: 4.6,
    totalResenas: 47,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 85,
    fuente: 'horario_habitual',
    margenErrorMetros: 40,
    especialidad: 'Bebida caliente de cebada tostada y cola de caballo',
    precioDesde: 3.5,
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
    horario: '06:00 - 11:30 / 17:00 - 22:00',
    calificacionPromedio: 4.7,
    totalResenas: 81,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 12,
    fuente: 'gps_emolientero',
    margenErrorMetros: 9,
    especialidad: 'Maca negra con habas, soya y pan con huevo criollo',
    precioDesde: 3.5,
  },
  {
    id: 'emo-12',
    nombre: 'Aromas del Valle - Sol de La Molina',
    encargado: 'Gladys Pacheco Quispe',
    codigoMunicipal: 'MLM-2026-00219',
    telefonoYape: '927364518',
    latitud: -12.0892,
    longitud: -76.9062,
    zona: 'Sol de La Molina',
    direccionReferencia: 'Av. El Sol con Calle Tahuantinsuyo',
    horario: '06:30 - 11:00 / 17:30 - 21:30',
    calificacionPromedio: 4.5,
    totalResenas: 39,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 42,
    fuente: 'gps_emolientero',
    margenErrorMetros: 16,
    especialidad: 'Emoliente tradicional de hierba luisa y manzanilla',
    precioDesde: 3.0,
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
    horario: '05:30 - 11:30 / 17:00 - 22:30',
    calificacionPromedio: 4.8,
    totalResenas: 119,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 5,
    fuente: 'gps_emolientero',
    margenErrorMetros: 8,
    especialidad: 'Quinua con leche, ponche de habas y pan con lomito',
    precioDesde: 3.0,
  },
  {
    id: 'emo-14',
    nombre: 'Doña Paulina - Óvalo Huarochirí',
    encargado: 'Paulina Mamani Ticona',
    codigoMunicipal: 'MLM-2026-00244',
    telefonoYape: '945182736',
    latitud: -12.0638,
    longitud: -76.9388,
    zona: 'Santa Patricia',
    direccionReferencia: 'Av. Huarochirí con Av. Separadora Industrial',
    horario: '06:00 - 11:00 / 17:00 - 21:30',
    calificacionPromedio: 4.7,
    totalResenas: 68,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 27,
    fuente: 'gps_emolientero',
    margenErrorMetros: 14,
    especialidad: 'Emoliente digestivo con sábila, sangre de grado y miel',
    precioDesde: 3.5,
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
    horario: '06:00 - 11:00 / 17:00 - 21:30',
    calificacionPromedio: 4.8,
    totalResenas: 94,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 10,
    fuente: 'gps_emolientero',
    margenErrorMetros: 11,
    especialidad: 'Emoliente caliente con canela, clavo y membrillo',
    precioDesde: 3.5,
  },
  {
    id: 'emo-16',
    nombre: 'Puesto Los Cipreses - Las Viñas',
    encargado: 'Nelly Esperanza Flores',
    codigoMunicipal: 'MLM-2026-00267',
    telefonoYape: '962738491',
    latitud: -12.0945,
    longitud: -76.9532,
    zona: 'Las Viñas',
    direccionReferencia: 'Av. El Corregidor cdra. 25 (Las Viñas de La Molina)',
    horario: '06:30 - 11:30 / 17:30 - 22:00',
    calificacionPromedio: 4.6,
    totalResenas: 58,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 55,
    fuente: 'avistamiento_verificado',
    margenErrorMetros: 19,
    especialidad: 'Kiwicha con manzana, emoliente especial y cachangas',
    precioDesde: 3.0,
  },
  {
    id: 'emo-17',
    nombre: 'Puesto La Portada del Valle',
    encargado: 'Wilfredo Huanca Quispe',
    codigoMunicipal: 'MLM-2026-00279',
    telefonoYape: '973849162',
    latitud: -12.0972,
    longitud: -76.8865,
    zona: 'Cieneguilla / Límite',
    direccionReferencia: 'Av. La Molina Este km 11.5 (Entrada hacia Cieneguilla)',
    horario: '05:30 - 11:00 / 16:30 - 21:00',
    calificacionPromedio: 4.7,
    totalResenas: 72,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 18,
    fuente: 'gps_emolientero',
    margenErrorMetros: 12,
    especialidad: 'Emoliente serrano con muña, alfalfa y pan campesino',
    precioDesde: 3.5,
  },
  {
    id: 'emo-18',
    nombre: 'Don Severino - La Fontana Este',
    encargado: 'Severino Alarcón Meza',
    codigoMunicipal: 'MLM-2026-00288',
    telefonoYape: '984916273',
    latitud: -12.0751,
    longitud: -76.9432,
    zona: 'La Fontana',
    direccionReferencia: 'Av. La Fontana cdra. 11 (Cerca a Facultad de Medicina)',
    horario: '06:00 - 12:00 / 17:00 - 22:00',
    calificacionPromedio: 4.8,
    totalResenas: 105,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 8,
    fuente: 'gps_emolientero',
    margenErrorMetros: 9,
    especialidad: 'Emoliente triple energía con maca, polen y miel de abeja',
    precioDesde: 3.5,
  },
  // Registro inactivo de control (Jornada Cerrada) -> Localizador debe filtrarlo siempre
  {
    id: 'emo-inactivo-19',
    nombre: 'Puesto Fuera de Servicio (Jornada Cerrada)',
    encargado: 'Andrés Salazar',
    codigoMunicipal: 'MLM-2026-00295',
    telefonoYape: '911223344',
    latitud: -12.0733,
    longitud: -76.9510,
    zona: 'La Fontana',
    direccionReferencia: 'Av. La Fontana cdra. 5',
    horario: 'Cerrado temporalmente',
    calificacionPromedio: 4.2,
    totalResenas: 19,
    jornadaAbierta: false,
    estadoCuenta: 'activo',
    antiguedadMin: 10,
    fuente: 'gps_emolientero',
    margenErrorMetros: 10,
    especialidad: 'Emoliente clásico',
    precioDesde: 3.0,
  },
  // Registro con ubicación no confirmada (> 4 horas = 280 min) -> Localizador debe excluirlo (US08)
  {
    id: 'emo-expirado-20',
    nombre: 'Puesto con Ubicación Expirada (> 4h)',
    encargado: 'Rubén Darío Gómez',
    codigoMunicipal: 'MLM-2026-00299',
    telefonoYape: '922334455',
    latitud: -12.0736,
    longitud: -76.9515,
    zona: 'La Fontana',
    direccionReferencia: 'Av. La Fontana cdra. 6',
    horario: '06:00 - 11:00',
    calificacionPromedio: 4.1,
    totalResenas: 15,
    jornadaAbierta: true,
    estadoCuenta: 'activo',
    antiguedadMin: 285,
    fuente: 'gps_emolientero',
    margenErrorMetros: 15,
    especialidad: 'Emoliente clásico',
    precioDesde: 3.0,
  },
]

function normalizarEmolientero(raw) {
  const ubicacion =
    raw.ubicacion instanceof Ubicacion
      ? raw.ubicacion
      : new Ubicacion({
          latitud: raw.latitud ?? raw.lat,
          longitud: raw.longitud ?? raw.lng,
          fechaHora: raw.fechaHora ?? raw.registradaEn ?? new Date(Date.now() - (raw.antiguedadMin ?? 5) * 60_000),
          margenErrorMetros: raw.margenErrorMetros ?? raw.precisionM ?? 12,
          zona: raw.zona ?? 'La Molina',
        })

  const antiguedadMin = Number(raw.antiguedadMin ?? 5)
  const fuente = raw.fuente ?? 'gps_emolientero'
  const infoConfiabilidad = clasificarConfiabilidad(antiguedadMin, fuente)

  return {
    ...raw,
    latitud: ubicacion.latitud,
    longitud: ubicacion.longitud,
    lat: ubicacion.latitud,
    lng: ubicacion.longitud,
    ubicacion,
    antiguedadMin,
    fuente,
    confiabilidad: raw.confiabilidad ?? infoConfiabilidad.nivel,
    infoConfiabilidad,
  }
}

export class Localizador {
  constructor(catalogoEmolienteros = EMOLIENTEROS_SEMILLA_LA_MOLINA, criterioOrden = new CriterioPorDistancia()) {
    this.catalogo = catalogoEmolienteros.map(normalizarEmolientero)
    this.criterioOrden = criterioOrden
  }

  cambiarCriterioOrden(nuevoCriterio) {
    this.criterioOrden = nuevoCriterio
  }

  /**
   * Devuelve todos los emolienteros que cumplen las condiciones de visibilidad en el mapa:
   * 1. Cuenta activa y Jornada Abierta (US06)
   * 2. Ubicación dentro de La Molina (US05)
   * 3. Ubicación confirmada con antigüedad <= 240 minutos (4 horas, US08)
   */
  obtenerEmolienterosElegibles() {
    return this.catalogo.filter((emo) => {
      const activo = emo.jornadaAbierta === true && (emo.estadoCuenta ?? 'activo') === 'activo'
      const enZona = emo.ubicacion.estaEnLaMolina()
      const confirmada = (emo.antiguedadMin ?? 0) <= VIGENCIA_MAXIMA_UBICACION_MIN
      return activo && enZona && confirmada
    })
  }

  /**
   * T36 + T37: Filtra emolienteros activos dentro del radio en metros y los ordena con CriterioOrden.
   */
  buscarCercanos({ ubicacionCliente, radioMetros = 1000, criterioOrden = this.criterioOrden } = {}) {
    if (!ubicacionCliente) {
      return []
    }

    const origen =
      ubicacionCliente instanceof Ubicacion
        ? ubicacionCliente
        : new Ubicacion({
            latitud: ubicacionCliente.latitud ?? ubicacionCliente.lat,
            longitud: ubicacionCliente.longitud ?? ubicacionCliente.lng,
          })

    const radio = Number(radioMetros) || 1000
    const elegibles = this.obtenerEmolienterosElegibles()

    const dentroDelRadio = []
    for (const emo of elegibles) {
      const distanciaMetros = origen.calcularDistanciaGeodesica(emo.ubicacion)
      if (distanciaMetros <= radio) {
        dentroDelRadio.push({
          ...emo,
          distanciaMetros,
        })
      }
    }

    const estrategia = criterioOrden ?? this.criterioOrden ?? new CriterioPorDistancia()
    return estrategia.ordenar(dentroDelRadio, origen)
  }

  /**
   * T39: Búsqueda manual por zona o referencia en La Molina cuando no hay GPS o no hay resultados en el radio.
   */
  buscarPorZona({ zona = 'Todas las zonas', textoBusqueda = '', ubicacionCliente = null } = {}) {
    const elegibles = this.obtenerEmolienterosElegibles()
    const termino = textoBusqueda.trim().toLowerCase()

    const filtrados = elegibles.filter((emo) => {
      const coincideZona = !zona || zona === 'Todas las zonas' || emo.zona.toLowerCase() === zona.toLowerCase()
      const coincideTexto =
        !termino ||
        emo.nombre.toLowerCase().includes(termino) ||
        emo.zona.toLowerCase().includes(termino) ||
        (emo.direccionReferencia ?? '').toLowerCase().includes(termino) ||
        (emo.especialidad ?? '').toLowerCase().includes(termino) ||
        (emo.codigoMunicipal ?? '').toLowerCase().includes(termino)

      return coincideZona && coincideTexto
    })

    if (ubicacionCliente) {
      return this.criterioOrden.ordenar(filtrados, ubicacionCliente)
    }

    return new CriterioPorCalificacion().ordenar(filtrados, null)
  }
}

/**
 * T40: Genera N emolienteros activos distribuidos dentro de La Molina para la prueba de rendimiento RNF01.
 */
export function generarEmolienterosBenchmark(cantidad = 50) {
  const zonas = ZONAS_LA_MOLINA.filter((z) => z !== 'Todas las zonas')
  const resultado = []

  for (let i = 1; i <= cantidad; i++) {
    // Distribución determinista dentro de un radio cercano y medio en La Molina
    const fila = Math.floor((i - 1) / 8)
    const col = (i - 1) % 8
    const latitud = Number((-12.066 - fila * 0.0042 - (i % 3) * 0.0007).toFixed(6))
    const longitud = Number((-76.962 + col * 0.0065 + (i % 4) * 0.0005).toFixed(6))
    const zona = zonas[i % zonas.length]
    const antiguedadMin = (i * 3) % 75
    const fuente = antiguedadMin > 60 ? 'horario_habitual' : 'gps_emolientero'

    resultado.push({
      id: `bench-${String(i).padStart(2, '0')}`,
      nombre: `Puesto Emolivery #${String(i).padStart(2, '0')} - ${zona}`,
      encargado: `Emolientero Verificado ${i}`,
      codigoMunicipal: `MLM-2026-${String(10000 + i)}`,
      telefonoYape: `98765${String(1000 + i).slice(-4)}`,
      latitud,
      longitud,
      zona,
      direccionReferencia: `Sector ${zona} - Punto Autorizado N.° ${i} (La Molina)`,
      horario: '06:00 - 22:00',
      calificacionPromedio: Number((4.3 + (i % 8) * 0.1).toFixed(1)),
      totalResenas: 25 + i * 3,
      jornadaAbierta: true,
      estadoCuenta: 'activo',
      antiguedadMin,
      fuente,
      margenErrorMetros: 10,
      especialidad: 'Emoliente tradicional, quinua y maca',
      precioDesde: 3.5,
    })
  }

  return resultado
}

/**
 * Controlador de alto nivel (MapaController) que coordina Localizador, CriterioOrden y el benchmark RNF01.
 */
export class MapaController {
  constructor(catalogoInicial = EMOLIENTEROS_SEMILLA_LA_MOLINA) {
    this.localizador = new Localizador(catalogoInicial, new CriterioPorDistancia())
  }

  obtenerCercanos({ latitud, longitud, radioMetros = 1000, tipoOrden = 'distancia' } = {}) {
    const criterio =
      tipoOrden === 'calificacion' ? new CriterioPorCalificacion() : new CriterioPorDistancia()
    const ubicacionCliente = new Ubicacion({ latitud, longitud })
    const resultados = this.localizador.buscarCercanos({
      ubicacionCliente,
      radioMetros,
      criterioOrden: criterio,
    })

    return {
      ubicacionCliente,
      radioMetros: Number(radioMetros),
      totalEncontrados: resultados.length,
      mensajeVacio: resultados.length === 0 ? 'No hay emolienteros cercanos disponibles' : null,
      emolienteros: resultados,
    }
  }

  obtenerPorZona({ zona = 'Todas las zonas', textoBusqueda = '', ubicacionCliente = null } = {}) {
    const resultados = this.localizador.buscarPorZona({ zona, textoBusqueda, ubicacionCliente })
    return {
      zona,
      totalEncontrados: resultados.length,
      emolienteros: resultados,
    }
  }

  /**
   * T40: Ejecuta el benchmark de RNF01 con 50 emolienteros activos y mide el tiempo en milisegundos.
   */
  ejecutarBenchmarkRNF01(
    cantidad = 50,
    coordenadasCliente = UBICACION_DEFAULT_LA_MOLINA,
    radioMetros = 5000,
  ) {
    const inicio = typeof performance !== 'undefined' ? performance.now() : Date.now()

    const dataset50 = generarEmolienterosBenchmark(cantidad)
    const localizadorBench = new Localizador(dataset50, new CriterioPorDistancia())
    const ubicacionCliente = new Ubicacion(coordenadasCliente)
    const ordenados = localizadorBench.buscarCercanos({
      ubicacionCliente,
      radioMetros,
      criterioOrden: new CriterioPorDistancia(),
    })

    const fin = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const duracionMs = Math.max(0.1, Number((fin - inicio).toFixed(2)))

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
