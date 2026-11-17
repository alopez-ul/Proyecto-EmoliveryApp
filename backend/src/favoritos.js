// US21 (T93, T94, T95, T96): Dominio de Emolienteros Favoritos y Jerarquía Notificacion en Backend
// Implementa la clase abstracta Notificacion y sus subclases (RNF18 - Principio Abierto/Cerrado),
// y el servicio FavoritoService para marcar/desmarcar favoritos y emitir o suprimir avisos
// al abrir jornada según la configuración y zona de interés del cliente.

import { EMOLIENTEROS_SEMILLA_LA_MOLINA } from './localizacion.js'

export const CLIENTE_DEMO_ID = 'cli-rodrigo-ulima'
export const FAVORITOS_INICIALES_IDS = ['emo-01', 'emo-04', 'emo-08']
export const ZONAS_INTERES_INICIALES = ['La Fontana', 'Camacho']

export class Notificacion {
  constructor({
    id,
    destinatarioId,
    emolientero,
    ubicacion,
    zona,
    fechaHora = new Date(),
    canal = 'GENERAL',
  } = {}) {
    if (new.target === Notificacion) {
      throw new TypeError('Notificacion es una clase abstracta: instancia una subclase concreta.')
    }
    if (!destinatarioId) {
      throw new TypeError('Notificacion requiere un destinatarioId válido.')
    }
    if (!emolientero || !emolientero.nombre) {
      throw new TypeError('Notificacion requiere los datos del emolientero.')
    }

    this.id = id ?? `NOTIF-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`
    this.destinatarioId = destinatarioId
    this.emolientero = emolientero
    this.ubicacion = ubicacion ?? emolientero.direccionReferencia ?? 'La Molina'
    this.zona = zona ?? emolientero.zona ?? 'La Molina'
    this.fechaHora = fechaHora instanceof Date ? fechaHora.toISOString() : new Date(fechaHora).toISOString()
    this.canal = canal
    this.estado = 'PENDIENTE'
    this.mensaje = ''
    this.titulo = ''
  }

  formatearMensaje() {
    throw new Error(`${this.constructor.name} debe implementar el método formatearMensaje().`)
  }

  procesarEnvio() {
    const { titulo, mensaje } = this.formatearMensaje()
    this.titulo = titulo
    this.mensaje = mensaje
    this.estado = 'ENVIADA'

    return {
      id: this.id,
      tipo: this.constructor.name,
      canal: this.canal,
      destinatarioId: this.destinatarioId,
      emolienteroId: this.emolientero.id,
      emolienteroNombre: this.emolientero.nombre,
      codigoMunicipal: this.emolientero.codigoMunicipal ?? 'MLM-2026-00104',
      zona: this.zona,
      ubicacion: this.ubicacion,
      titulo: this.titulo,
      mensaje: this.mensaje,
      fechaHora: this.fechaHora,
      estado: this.estado,
    }
  }
}

export class NotificacionAperturaJornada extends Notificacion {
  static TIPO = 'APERTURA_JORNADA'

  constructor(params = {}) {
    super({ ...params, canal: params.canal ?? 'APERTURA_JORNADA' })
  }

  formatearMensaje() {
    const titulo = `🍵 ¡${this.emolientero.nombre} abrió su jornada en ${this.zona}!`
    const mensaje = `Tu emolientero favorito ${this.emolientero.nombre} (${this.emolientero.codigoMunicipal ?? 'Verificado'}) acaba de iniciar atención en ${this.ubicacion}, zona ${this.zona} (La Molina).`
    return { titulo, mensaje }
  }
}

export class NotificacionEnApp extends NotificacionAperturaJornada {
  static TIPO = 'NOTIFICACION_EN_APP'

  constructor(params = {}) {
    super({ ...params, canal: 'IN_APP' })
  }

  formatearMensaje() {
    const base = super.formatearMensaje()
    return {
      titulo: base.titulo,
      mensaje: `${base.mensaje} Puedes ver su catálogo o hacer tu compra anticipada con QR de Yape ahora.`,
    }
  }
}

export class NotificacionPushSimulada extends NotificacionAperturaJornada {
  static TIPO = 'NOTIFICACION_PUSH'

  constructor(params = {}) {
    super({ ...params, canal: 'PUSH_MOVIL' })
  }

  formatearMensaje() {
    return {
      titulo: `[PUSH EMOLIVERY] ${this.emolientero.nombre} activo en ${this.zona}`,
      mensaje: `Ubicación confirmada: ${this.ubicacion} (${this.zona}). ¡Pide por adelantado sin hacer cola!`,
    }
  }
}

export class FavoritoService {
  constructor({
    catalogoEmolienteros = EMOLIENTEROS_SEMILLA_LA_MOLINA.filter(
      (e) => !String(e.id).includes('inactivo') && !String(e.id).includes('expirado'),
    ),
    favoritosIniciales = FAVORITOS_INICIALES_IDS,
  } = {}) {
    this.catalogo = catalogoEmolienteros
    this.favoritosPorCliente = new Map()
    this.preferenciasPorCliente = new Map()
    this.bandejaAvisosEnviados = []
    this.historialActividad = []

    this.favoritosPorCliente.set(CLIENTE_DEMO_ID, new Set(favoritosIniciales))
    this.preferenciasPorCliente.set(CLIENTE_DEMO_ID, {
      notificacionesHabilitadas: true,
      zonasInteres: [...ZONAS_INTERES_INICIALES],
      canalPreferido: 'IN_APP',
    })
  }

  _asegurarCliente(clienteId = CLIENTE_DEMO_ID) {
    if (!this.favoritosPorCliente.has(clienteId)) {
      this.favoritosPorCliente.set(clienteId, new Set())
      this.preferenciasPorCliente.set(clienteId, {
        notificacionesHabilitadas: true,
        zonasInteres: [...ZONAS_INTERES_INICIALES],
        canalPreferido: 'IN_APP',
      })
    }
    return {
      setFavoritos: this.favoritosPorCliente.get(clienteId),
      preferencias: this.preferenciasPorCliente.get(clienteId),
    }
  }

  marcarFavorito(clienteId = CLIENTE_DEMO_ID, emolienteroId) {
    if (!emolienteroId) throw new TypeError('Se requiere el identificador del emolientero.')
    const { setFavoritos } = this._asegurarCliente(clienteId)
    setFavoritos.add(String(emolienteroId))
    return Array.from(setFavoritos)
  }

  desmarcarFavorito(clienteId = CLIENTE_DEMO_ID, emolienteroId) {
    if (!emolienteroId) throw new TypeError('Se requiere el identificador del emolientero.')
    const { setFavoritos } = this._asegurarCliente(clienteId)
    setFavoritos.delete(String(emolienteroId))
    return Array.from(setFavoritos)
  }

  alternarFavorito(clienteId = CLIENTE_DEMO_ID, emolienteroId) {
    if (this.esFavorito(clienteId, emolienteroId)) {
      return { esFavorito: false, favoritosIds: this.desmarcarFavorito(clienteId, emolienteroId) }
    }
    return { esFavorito: true, favoritosIds: this.marcarFavorito(clienteId, emolienteroId) }
  }

  esFavorito(clienteId = CLIENTE_DEMO_ID, emolienteroId) {
    const { setFavoritos } = this._asegurarCliente(clienteId)
    return setFavoritos.has(String(emolienteroId))
  }

  listarFavoritos(clienteId = CLIENTE_DEMO_ID) {
    const { setFavoritos } = this._asegurarCliente(clienteId)
    return this.catalogo.filter((emo) => setFavoritos.has(String(emo.id)))
  }

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
    return this.obtenerPreferencias(clienteId)
  }

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

    const coincideZona = zonasInteres.some(
      (z) => z.trim().toLowerCase() === zonaReal.trim().toLowerCase(),
    )
    if (!coincideZona) {
      const motivo = 'Apertura fuera de la zona de interés del cliente'
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
