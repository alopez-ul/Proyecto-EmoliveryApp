// US15 - T68: el cliente ve el código de recojo de cada pedido para mostrárselo al emolientero.
// US16 - T72: puede cancelar un pedido pagado y no entregado hasta 30 minutos después del pago.
import { useCallback, useEffect, useState } from 'react'
import { cancelableHasta, cancelarOrden, misPedidos } from '../services/ordenesService.js'
import FormularioResena from './FormularioResena.jsx'

const ESTADOS = { pendiente_pago: 'Pendiente de pago', pendiente: 'Pendiente', en_camino: 'En camino', entregada: 'Entregado', cancelada: 'Cancelado' }
const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })
const hora = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' })

const botonPequeno = {
  font: 'inherit',
  fontSize: '0.82rem',
  fontWeight: 600,
  padding: '6px 12px',
  borderRadius: 8,
  cursor: 'pointer',
}

export default function MisPedidos() {
  const [pedidos, setPedidos] = useState(null)
  const [ahora, setAhora] = useState(() => new Date())
  const [confirmando, setConfirmando] = useState(null) // id del pedido que se está por cancelar
  const [cancelando, setCancelando] = useState(false)
  const [mensaje, setMensaje] = useState(null) // { tipo: 'exito' | 'error', texto }

  const cargar = useCallback(() => {
    misPedidos()
      .then(setPedidos)
      .catch(() => setPedidos([]))
  }, [])

  useEffect(cargar, [cargar])

  // El botón de cancelar desaparece solo cuando vence el plazo.
  useEffect(() => {
    const intervalo = setInterval(() => setAhora(new Date()), 30_000)
    return () => clearInterval(intervalo)
  }, [])

  async function cancelar(pedido) {
    setCancelando(true)
    setMensaje(null)
    try {
      const { devolucion } = await cancelarOrden(pedido.id)
      setMensaje({
        tipo: 'exito',
        texto: `Cancelaste el pedido #${pedido.id}. ${pedido.emolientero} debe devolverte ${soles.format(devolucion.monto)} por Yape.`,
      })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setConfirmando(null)
      setCancelando(false)
      cargar()
    }
  }

  if (!pedidos?.length) return null

  return (
    <div style={{ margin: '0 0 18px' }}>
      <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem' }}>Mis pedidos</h3>
      {mensaje && (
        <div
          role={mensaje.tipo === 'error' ? 'alert' : 'status'}
          style={{
            margin: '0 0 10px',
            padding: '10px 12px',
            borderRadius: 10,
            fontSize: '0.86rem',
            fontWeight: 600,
            background: mensaje.tipo === 'error' ? '#fdecea' : '#e8f3e9',
            color: mensaje.tipo === 'error' ? '#b42318' : 'var(--hierba)',
          }}
        >
          {mensaje.texto}
        </div>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pedidos.map((p) => {
          const porRecoger = p.estado === 'pendiente' || p.estado === 'en_camino'
          const limite = cancelableHasta(p)
          const puedeCancelar = limite && ahora <= limite
          return (
            <li
              key={p.id}
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--borde)', background: 'var(--crema)', fontSize: '0.88rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong>Pedido #{p.id} · {p.emolientero}</strong>
                <span style={{ color: 'var(--cafe-medio)' }}>{ESTADOS[p.estado] ?? p.estado}</span>
              </div>
              {/* US14: una orden sin pagar se paga con Yape (si ya venció, la pantalla de pago lo indica) */}
              {p.estado === 'pendiente_pago' && (
                <a href={`#pago-yape?orden=${p.id}`} style={{ display: 'inline-block', marginTop: 6, color: '#742384', fontWeight: 700 }}>
                  Pagar con Yape →
                </a>
              )}
              {porRecoger && p.codigoRecojo && (
                <div style={{ marginTop: 6 }}>
                  Código de recojo:{' '}
                  <span style={{ fontFamily: 'monospace', fontSize: '1.15rem', fontWeight: 700, letterSpacing: '0.15em' }}>{p.codigoRecojo}</span>
                  <div style={{ fontSize: '0.78rem', color: 'var(--cafe-medio)' }}>Muéstralo al emolientero al recoger. Sirve una sola vez.</div>
                </div>
              )}
              {/* US17: reseña del pedido entregado (habilitada por US15) */}
              {p.resenaHabilitada && !p.resenaPublicada && (
                <FormularioResena ordenId={p.id} emolientero={p.emolientero} onPublicada={cargar} />
              )}
              {p.resenaPublicada && (
                <div style={{ marginTop: 6, fontSize: '0.85rem', color: 'var(--cafe-medio)' }}>
                  Tu reseña: <span style={{ color: '#c9952b', letterSpacing: 1 }}>{'★'.repeat(p.calificacion)}{'☆'.repeat(5 - p.calificacion)}</span>
                  {' · '}
                  <a href={`#resenas?id=${p.emolienteroId}`} style={{ color: 'var(--caramelo)', fontWeight: 600 }}>
                    Ver reseñas de {p.emolientero}
                  </a>
                </div>
              )}

              {/* US16: cancelar dentro del plazo, con confirmación */}
              {puedeCancelar && confirmando !== p.id && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--cafe-medio)' }}>Puedes cancelarlo hasta las {hora.format(limite)}.</span>
                  <button
                    type="button"
                    onClick={() => setConfirmando(p.id)}
                    style={{ ...botonPequeno, border: '1px solid #b42318', background: 'transparent', color: '#b42318' }}
                  >
                    Cancelar compra
                  </button>
                </div>
              )}
              {confirmando === p.id && (
                <div
                  role="group"
                  aria-label={`Confirmar cancelación del pedido ${p.id}`}
                  style={{ marginTop: 8, padding: '10px', borderRadius: 8, background: '#fff', border: '1px solid var(--borde)' }}
                >
                  <p style={{ margin: '0 0 8px', fontSize: '0.84rem' }}>
                    ¿Cancelar el pedido #{p.id}? Se anulará y {p.emolientero} deberá devolverte
                    {p.total != null ? ` ${soles.format(p.total)}` : ' lo que pagaste'}.
                  </p>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setConfirmando(null)}
                      disabled={cancelando}
                      style={{ ...botonPequeno, border: '1px solid var(--borde-fuerte)', background: '#fff', color: 'var(--cafe)' }}
                    >
                      No, mantener
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelar(p)}
                      disabled={cancelando}
                      aria-busy={cancelando}
                      style={{ ...botonPequeno, border: '1px solid #b42318', background: '#b42318', color: '#fff' }}
                    >
                      {cancelando ? 'Cancelando…' : 'Sí, cancelar'}
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
