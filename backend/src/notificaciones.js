// US23 - T31: notificaciones al usuario. Se guardan en la BD (las ve en su panel).
// Aún no hay envío de correos: con BUZON_SIMULADO=true el correo se simula en el log del servidor.
const BUZON_SIMULADO = process.env.BUZON_SIMULADO === 'true'

// `db` puede ser el pool o un cliente dentro de una transacción, para que la notificación
// se guarde junto con el cambio que la origina (o no se guarde si este falla).
export async function notificar(db, usuario, { tipo, titulo, mensaje }) {
  await db.query('INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje) VALUES ($1, $2, $3, $4)', [
    usuario.id,
    tipo,
    titulo,
    mensaje,
  ])
  if (BUZON_SIMULADO) console.log(`[correo simulado] Para: ${usuario.correo} | ${titulo} | ${mensaje}`)
}
