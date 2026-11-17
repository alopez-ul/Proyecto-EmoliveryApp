// US21 - T93, T95, T96: Servicio FavoritoService
// Administra el marcado/desmarcado de emolienteros favoritos por cliente, las preferencias
// de notificación por zona de interés en La Molina y la regla de negocio de emisión o supresión
// de avisos al abrir jornada (registrando siempre la actividad en bitácora según T96).

import { EMOLIENTEROS_SEMILLA_LA_MOLINA, ZONAS_LA_MOLINA } from '../ubicacion/Localizador.js'
import {
  NotificacionAperturaJornada,
  NotificacionEnApp,
  NotificacionPushSimulada,
} from './Notificacion.js'

export const CLIENTE_DEMO_ID = 'cli-rodrigo-ulima'
export const FAVORITOS_INICIALES_IDS = ['emo-01', 'emo-04', 'emo-08']
export const ZONAS_INTERES_INICIALES = ['La Fontana', 'Camacho']

const STORAGE_KEY_FAVORITOS = 'emolivery_us21_favoritos_v1'
const STORAGE_KEY_PREFS = 'emolivery_us21_preferencias_v1'

export const ZONAS_FAVORITOS_LA_MOLINA = ZONAS_LA_MOLINA.filter((z) => z !== 'Todas las zonas')

export class FavoritoService {
  /**
   * @param {Object} [opciones]
   * @param {Array} [opciones.catalogoEmolienteros]
   * @param {Array<string>} [opciones.favoritosIniciales]
   * @param {boolean} [opciones.usarStorage]
   */
  constructor({
    catalogoEmolienteros = EMOLIENTEROS_SEMILLA_LA_MOLINA.filter((e) => !String(e.id).includes('inactivo') && !String(e.id).includes('expirado')),
    favoritosIniciales = FAVORITOS_INICIALES_IDS,
    usarStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined',
  } = {}) {
    this.catalogo = catalogoEmolienteros
    this.usarStorage = usarStorage
    // Map<clienteId, Set<emolienteroId>>
    this.favoritosPorCliente = new Map()
    // Map<clienteId, { notificacionesHabilitadas: boolean, zonasInteres: string[], canalPreferido: string }>
    this.preferenciasPorCliente = new Map()

    // Bandeja de avisos efectivamente enviados al cliente (T95)
    this.bandejaAvisosEnviados = []
    // Registro interno de toda actividad de apertura (incluyendo avisos suprimidos - T96)
    this.historialActividad = []

    this._inicializarCliente(CLIENTE_DEMO_ID, favoritosIniciales)
  }

  _inicializarCliente(clienteId, favoritosIniciales = FAVORITOS_INICIALES_IDS) {
    let idsGuardados = favoritosIniciales
    let prefsGuardadas = {
      notificacionesHabilitadas: true,
      zonasInteres: [...ZONAS_INTERES_INICIALES],
      canalPreferido: 'IN_APP',
    }

    if (this.usarStorage) {
      try {
        const rawFavs = window.localStorage.getItem(`${STORAGE_KEY_FAVORITOS}_${clienteId}`)
        if (rawFavs) {
          const parsed = JSON.parse(rawFavs)
          if (Array.isArray(parsed)) idsGuardados = parsed
        }
        const rawPrefs = window.localStorage.getItem(`${STORAGE_KEY_PREFS}_${clienteId}`)
        if (rawPrefs) {
          const parsedPrefs = JSON.parse(rawPrefs)
          if (parsedPrefs && typeof parsedPrefs === 'object') {
            prefsGuardadas = { ...prefsGuardadas, ...parsedPrefs }
          }
        }
      } catch {
        // Ignorar errores de acceso a localStorage en modo privado
      }
    }

    this.favoritosPorCliente.set(clienteId, new Set(idsGuardados))
    this.preferenciasPorCliente.set(clienteId, prefsGuardadas)
  }

  _asegurarCliente(clienteId = CLIENTE_DEMO_ID) {
    if (!this.favoritosPorCliente.has(clienteId)) {
      this._inicializarCliente(clienteId, [])
    }
    return {
      setFavoritos: this.favoritosPorCliente.get(clienteId),
      preferencias: this.preferenciasPorCliente.get(clienteId),
    }
  }

  _persistirCliente(clienteId = CLIENTE_DEMO_ID) {
    if (!this.usarStorage) return
    try {
      const { setFavoritos, preferencias } = this._asegurarCliente(clienteId)
      window.localStorage.setItem(
        `${STORAGE_KEY_FAVORITOS}_${clienteId}`,
        JSON.stringify(Array.from(setFavoritos)),
      )
      window.localStorage.setItem(
        `${STORAGE_KEY_PREFS}_${clienteId}`,
        JSON.stringify(preferencias),
      )
    } catch {
      // Sin persistencia externa
    }
  }

  // =========================================================================
  // T93: Marcado, desmarcado y consulta de emolienteros favoritos
  // =========================================================================

  marcarFavorito(clienteId = CLIENTE_DEMO_ID, emolienteroId) {
    if (!emolienteroId) throw new TypeError('Se requiere el identificador del emolientero.')
    const { setFavoritos } = this._asegurarCliente(clienteId)
    setFavoritos.add(String(emolienteroId))
    this._persistirCliente(clienteId)
    return Array.from(setFavoritos)
  }

  desmarcarFavorito(clienteId = CLIENTE_DEMO_ID, emolienteroId) {
    if (!emolienteroId) throw new TypeError('Se requiere el identificador del emolientero.')
    const { setFavoritos } = this._asegurarCliente(clienteId)
    setFavoritos.delete(String(emolienteroId))
    this._persistirCliente(clienteId)
    return Array.from(setFavoritos)
  }

  alternarFavorito(clienteId = CLIENTE_DEMO_ID, emolienteroId) {
    if (this.esFavorito(clienteId, emolienteroId)) {
      const ids = this.desmarcarFavorito(clienteId, emolienteroId)
      return { esFavorito: false, favoritosIds: ids }
    }
    const ids = this.marcarFavorito(clienteId, emolienteroId)
    return { esFavorito: true, favoritosIds: ids }
  }

  esFavorito(clienteId = CLIENTE_DEMO_ID, emolienteroId) {
    const { setFavoritos } = this._asegurarCliente(clienteId)
    return setFavoritos.has(String(emolienteroId))
  }

  listarFavoritosIds(clienteId = CLIENTE_DEMO_ID) {
    const { setFavoritos } = this._asegurarCliente(clienteId)
    return Array.from(setFavoritos)
  }

  listarFavoritos(clienteId = CLIENTE_DEMO_ID) {
    const { setFavoritos } = this._asegurarCliente(clienteId)
    return this.catalogo.filter((emo) => setFavoritos.has(String(emo.id)))
  }

  obtenerDirectorioConEstado(clienteId = CLIENTE_DEMO_ID) {
    const { setFavoritos } = this._asegurarCliente(clienteId)
    return this.catalogo.map((emo) => ({
      ...emo,
      esFavorito: setFavoritos.has(String(emo.id)),
    }))
  }

  // =========================================================================
  // Configuración de Notificaciones y Zona de Interés del Cliente
  // =========================================================================

  obtenerPreferencias(clienteId = CLIENTE_DEMO_ID) {
    const { preferencias } = this._asegurarCliente(clienteId)
    return {
      ...preferencias,
      zonasInteres: [...(preferencias.zonasInteres ?? [])],
    }
  }

  actualizarPreferencias(clienteId = CLIENTE_DEMO_ID, cambios = {}) {
    const { preferencias } = this._asegurarCliente(clienteId)
    const nuevas = {
      ...preferencias,
      ...(typeof cambios.notificacionesHabilitadas === 'boolean'
        ? { notificacionesHabilitadas: cambios.notificacionesHabilitadas }
        : {}),
      ...(Array.isArray(cambios.zonasInteres)
        ? { zonasInteres: [...new Set(cambios.zonasInteres)] }
        : {}),
      ...(cambios.canalPreferido ? { canalPreferido: cambios.canalPreferido } : {}),
    }
    this.preferenciasPorCliente.set(clienteId, nuevas)
    this._persistirCliente(clienteId)
    return this.obtenerPreferencias(clienteId)
  }

  // =========================================================================
  // T95 y T96: Procesamiento de Apertura de Jornada y Emisión Condicional
  // =========================================================================

  /**
   * Evalúa la apertura de jornada de un emolientero y decide si debe emitirse el aviso al cliente
   * o si solo se registra la actividad sin enviar notificación (T95 y T96).
   *
   * @param {Object} params
   * @param {Object} [params.cliente] - Objeto opcional con { id, notificacionesHabilitadas, zonasInteres, canalPreferido }
   * @param {string} [params.clienteId]
   * @param {Object} [params.emolientero]
   * @param {string} [params.emolienteroId]
   * @param {string} [params.zonaApertura]
   * @param {string} [params.direccionEspecifica]
   * @param {Date|string} [params.ahora]
   */
  procesarAperturaJornada({
    cliente = null,
    clienteId = CLIENTE_DEMO_ID,
    emolientero = null,
    emolienteroId = null,
    zonaApertura = null,
    direccionEspecifica = null,
    ahora = new Date(),
  } = {}) {
    const idCliente = cliente?.id ?? clienteId ?? CLIENTE_DEMO_ID
    const prefsBase = this.obtenerPreferencias(idCliente)

    const notificacionesHabilitadas =
      typeof cliente?.notificacionesHabilitadas === 'boolean'
        ? cliente.notificacionesHabilitadas
        : prefsBase.notificacionesHabilitadas

    const zonasInteres = Array.isArray(cliente?.zonasInteres)
      ? cliente.zonasInteres
      : typeof cliente?.zonaInteres === 'string'
        ? [cliente.zonaInteres]
        : prefsBase.zonasInteres

    const canalPreferido = cliente?.canalPreferido ?? prefsBase.canalPreferido ?? 'IN_APP'

    const emoObj =
      emolientero ??
      this.catalogo.find((e) => e.id === (emolienteroId ?? 'emo-01')) ??
      this.catalogo[0]

    const zonaReal = zonaApertura ?? emoObj?.zona ?? 'La Fontana'
    const ubicacionReal =
      direccionEspecifica ?? emoObj?.direccionReferencia ?? `Sector ${zonaReal}, La Molina`
    const fechaIso = ahora instanceof Date ? ahora.toISOString() : new Date(ahora).toISOString()

    // Verificar si el emolientero está marcado como favorito del cliente
    const marcadoFavorito =
      typeof cliente?.esFavorito === 'boolean'
        ? cliente.esFavorito
        : this.esFavorito(idCliente, emoObj.id)

    const registrarEventoInterno = ({ avisoEnviado, estado, motivo, notificacionId = null }) => {
      const evento = {
        idEvento: `ACT-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
        fechaHora: fechaIso,
        clienteId: idCliente,
        emolienteroId: emoObj.id,
        emolienteroNombre: emoObj.nombre,
        codigoMunicipal: emoObj.codigoMunicipal ?? 'MLM-2026-00104',
        zonaApertura: zonaReal,
        ubicacion: ubicacionReal,
        zonasInteresCliente: [...zonasInteres],
        notificacionesHabilitadas,
        esFavorito: marcadoFavorito,
        actividadRegistrada: true,
        avisoEnviado,
        estado,
        motivo,
        notificacionId,
      }
      this.historialActividad.unshift(evento)
      return evento
    }

    // Regla 0: Si no es favorito del cliente, se registra la apertura pero no se notifica
    if (!marcadoFavorito) {
      const motivo = 'El emolientero no está marcado como favorito por el cliente'
      const registroActividad = registrarEventoInterno({
        avisoEnviado: false,
        estado: 'NO_ES_FAVORITO',
        motivo,
      })
      return {
        avisoEnviado: false,
        actividadRegistrada: true,
        estado: 'NO_ES_FAVORITO',
        motivo,
        notificacion: null,
        registroActividad,
      }
    }

    // Regla T96 (Caso Inválido 1): El cliente desactivó las notificaciones
    if (!notificacionesHabilitadas) {
      const motivo = 'Notificaciones desactivadas por el cliente'
      const registroActividad = registrarEventoInterno({
        avisoEnviado: false,
        estado: 'AVISO_SUPRIMIDO_CONFIGURACION',
        motivo,
      })
      return {
        avisoEnviado: false,
        actividadRegistrada: true,
        estado: 'AVISO_SUPRIMIDO_CONFIGURACION',
        motivo,
        notificacion: null,
        registroActividad,
      }
    }

    // Regla T96 (Caso Inválido 2): El favorito abrió jornada fuera de la zona de interés del cliente
    const coincideZona = zonasInteres.some(
      (z) => z.trim().toLowerCase() === zonaReal.trim().toLowerCase(),
    )
    if (!coincideZona) {
      const motivo = `Apertura fuera de la zona de interés del cliente (abrió en ${zonaReal}; zonas de interés: ${zonasInteres.join(', ') || 'ninguna'})`
      const registroActividad = registrarEventoInterno({
        avisoEnviado: false,
        estado: 'AVISO_SUPRIMIDO_ZONA',
        motivo,
      })
      return {
        avisoEnviado: false,
        actividadRegistrada: true,
        estado: 'AVISO_SUPRIMIDO_ZONA',
        motivo,
        notificacion: null,
        registroActividad,
      }
    }

    // Regla T95 (Escenario Exitoso): Favorito + Notificaciones ON + Dentro de zona de interés
    const SubclaseNotificacion =
      canalPreferido === 'PUSH_MOVIL'
        ? NotificacionPushSimulada
        : canalPreferido === 'APERTURA_JORNADA'
          ? NotificacionAperturaJornada
          : NotificacionEnApp

    const instanciaNotificacion = new SubclaseNotificacion({
      destinatarioId: idCliente,
      emolientero: emoObj,
      ubicacion: ubicacionReal,
      zona: zonaReal,
      fechaHora: fechaIso,
    })

    const notificacionEmitida = instanciaNotificacion.procesarEnvio()
    this.bandejaAvisosEnviados.unshift(notificacionEmitida)

    const motivoExito = `Aviso enviado: ${emoObj.nombre} abrió jornada en tu zona de interés (${zonaReal}).`
    const registroActividad = registrarEventoInterno({
      avisoEnviado: true,
      estado: 'NOTIFICACION_ENVIADA',
      motivo: motivoExito,
      notificacionId: notificacionEmitida.id,
    })

    return {
      avisoEnviado: true,
      actividadRegistrada: true,
      estado: 'NOTIFICACION_ENVIADA',
      motivo: motivoExito,
      notificacion: notificacionEmitida,
      registroActividad,
    }
  }

  obtenerAvisosEnviados() {
    return this.bandejaAvisosEnviados
  }

  obtenerHistorialActividad() {
    return this.historialActividad
  }
}
