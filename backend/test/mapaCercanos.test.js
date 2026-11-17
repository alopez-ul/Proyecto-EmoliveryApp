// US07 (T35, T36, T37, T39, T40) - Pruebas unitarias de Ubicacion, CriterioOrden y Localizador (RNF18 / RNF01)
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CriterioOrden,
  CriterioPorCalificacion,
  CriterioPorDistancia,
  Localizador,
  MapaController,
  Ubicacion,
} from '../src/localizacion.js'

const CLIENTE_LA_FONTANA = new Ubicacion({
  latitud: -12.0734,
  longitud: -76.9512,
  zona: 'La Fontana',
})

describe('T35: Clase Ubicacion y distancia geodésica Haversine', () => {
  test('calcula distancia geodésica 0 m entre la misma coordenada', () => {
    assert.equal(CLIENTE_LA_FONTANA.calcularDistanciaGeodesica(CLIENTE_LA_FONTANA), 0)
  })

  test('calcula la distancia exacta en metros entre Av. La Fontana y Óvalo La Fontana', () => {
    const ovaloLaFontana = new Ubicacion({ latitud: -12.0725, longitud: -76.9548 })
    const distancia = CLIENTE_LA_FONTANA.calcularDistanciaGeodesica(ovaloLaFontana)
    assert.equal(typeof distancia, 'number')
    assert.equal(Number.isInteger(distancia), true)
    assert.ok(distancia > 350 && distancia < 450, `Distancia obtenida: ${distancia} m`)
  })

  test('valida pertenencia al polígono/límites de La Molina', () => {
    assert.equal(CLIENTE_LA_FONTANA.estaEnLaMolina(), true)
    const miraflores = new Ubicacion({ latitud: -12.1219, longitud: -77.0297 })
    assert.equal(miraflores.estaEnLaMolina(), false)
  })

  test('rechaza coordenadas inválidas o fuera de rango', () => {
    assert.throws(() => new Ubicacion({ latitud: 'invalido', longitud: -76.95 }), TypeError)
    assert.throws(() => new Ubicacion({ latitud: -95, longitud: -76.95 }), RangeError)
  })
})

describe('T37 (RNF18): Jerarquía CriterioOrden, CriterioPorDistancia y CriterioPorCalificacion', () => {
  test('CriterioOrden es abstracta y no se puede instanciar directamente', () => {
    assert.throws(() => new CriterioOrden(), TypeError)
  })

  test('CriterioPorDistancia ordena los emolienteros de menor a mayor distancia en metros', () => {
    const lista = [
      { id: 'lejos', nombre: 'Puesto Lejano', latitud: -12.0858, longitud: -76.9125, calificacionPromedio: 4.9 },
      { id: 'cerca', nombre: 'Puesto Cercano', latitud: -12.0731, longitud: -76.9502, calificacionPromedio: 4.5 },
      { id: 'medio', nombre: 'Puesto Medio', latitud: -12.0742, longitud: -76.9475, calificacionPromedio: 4.7 },
    ]
    const criterio = new CriterioPorDistancia()
    const ordenados = criterio.ordenar(lista, CLIENTE_LA_FONTANA)

    assert.deepEqual(ordenados.map((e) => e.id), ['cerca', 'medio', 'lejos'])
    assert.ok(ordenados[0].distanciaMetros < ordenados[1].distanciaMetros)
    assert.ok(ordenados[1].distanciaMetros < ordenados[2].distanciaMetros)
  })

  test('CriterioPorCalificacion ordena de mayor a menor calificación promedio sin modificar Localizador', () => {
    const lista = [
      { id: 'a', latitud: -12.0731, longitud: -76.9502, calificacionPromedio: 4.5 },
      { id: 'b', latitud: -12.0742, longitud: -76.9475, calificacionPromedio: 4.9 },
      { id: 'c', latitud: -12.0725, longitud: -76.9548, calificacionPromedio: 4.7 },
    ]
    const criterio = new CriterioPorCalificacion()
    const ordenados = criterio.ordenar(lista, CLIENTE_LA_FONTANA)

    assert.deepEqual(ordenados.map((e) => e.id), ['b', 'c', 'a'])
  })
})

describe('T36 y T39: Localizador, filtro de jornada abierta, vigencia US08 y caso sin resultados', () => {
  test('excluye emolienteros con jornada cerrada o con ubicación expirada (> 240 min)', () => {
    const loc = new Localizador()
    const elegibles = loc.obtenerEmolienterosElegibles()
    const ids = elegibles.map((e) => e.id)

    assert.equal(ids.includes('emo-inactivo'), false)
    assert.equal(ids.includes('emo-expirado'), false)
    assert.equal(ids.includes('emo-01'), true)
  })

  test('filtra por radio en metros y devuelve mensaje obligatorio cuando no hay cercanos', () => {
    const controller = new MapaController()
    const sinCercanos = controller.obtenerCercanos({
      latitud: -12.1315,
      longitud: -76.8710,
      radioMetros: 300,
    })

    assert.equal(sinCercanos.totalEncontrados, 0)
    assert.equal(sinCercanos.mensajeVacio, 'No hay emolienteros cercanos disponibles')
  })

  test('permite búsqueda manual por zonas de La Molina', () => {
    const controller = new MapaController()
    const enLaFontana = controller.obtenerPorZona({ zona: 'La Fontana' })

    assert.ok(enLaFontana.totalEncontrados >= 3)
    assert.ok(enLaFontana.emolienteros.every((e) => e.zona === 'La Fontana'))
  })
})

describe('T40 (RNF01): Benchmark con 50 emolienteros activos en menos de 3 segundos', () => {
  test('procesa, calcula Haversine y ordena 50 emolienteros activos en < 3000 ms', () => {
    const controller = new MapaController()
    const res = controller.ejecutarBenchmarkRNF01(50)

    assert.equal(res.cantidadGenerada, 50)
    assert.ok(res.totalRenderizados > 0)
    assert.equal(res.cumpleRNF01, true)
    assert.ok(res.duracionMs < 3000, `Duración registrada: ${res.duracionMs} ms`)
  })
})
