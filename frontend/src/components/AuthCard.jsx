// Contenedor visual compartido por las pantallas de autenticación (US03 y US04).
// Los estilos van en línea para no modificar index.css.

export const estilos = {
  campo: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 },
  etiqueta: { fontSize: '0.85rem', fontWeight: 600, color: 'var(--cafe-medio)' },
  input: {
    font: 'inherit',
    padding: '11px 12px',
    border: '1px solid var(--borde-fuerte)',
    borderRadius: 10,
    background: 'var(--crema)',
    color: 'var(--cafe)',
  },
  boton: {
    width: '100%',
    padding: '12px',
    marginTop: 6,
    border: 'none',
    borderRadius: 10,
    background: 'var(--caramelo)',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },
  botonSecundario: {
    padding: '8px 12px',
    border: '1px solid var(--borde-fuerte)',
    borderRadius: 10,
    background: 'var(--superficie)',
    color: 'var(--cafe)',
    fontWeight: 600,
    cursor: 'pointer',
  },
  enlace: { color: 'var(--caramelo)', fontWeight: 600, textDecoration: 'none' },
  error: {
    padding: '10px 12px',
    marginBottom: 14,
    borderRadius: 10,
    background: '#fdecea',
    color: '#9b2c1f',
    fontSize: '0.9rem',
  },
  exito: {
    padding: '10px 12px',
    marginBottom: 14,
    borderRadius: 10,
    background: '#e8f3e9',
    color: 'var(--hierba)',
    fontSize: '0.9rem',
  },
  errorCampo: { fontSize: '0.8rem', color: '#9b2c1f' },
}

export default function AuthCard({ titulo, subtitulo, children, pie }) {
  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'var(--fondo)' }}>
      <header className="barra-superior">
        <a href="#inicio" style={{ textDecoration: 'none' }}>
          <h1 className="titulo">Emolivery</h1>
        </a>
      </header>
      <main style={{ display: 'grid', placeItems: 'center', padding: '40px 16px' }}>
        <section
          style={{
            width: '100%',
            maxWidth: 420,
            padding: 28,
            background: 'var(--superficie)',
            border: '1px solid var(--borde)',
            borderRadius: 'calc(var(--radio) + 6px)',
            boxShadow: 'var(--sombra-lg)',
          }}
        >
          <h2 style={{ margin: '0 0 6px', fontSize: '1.35rem', letterSpacing: '-0.02em' }}>{titulo}</h2>
          {subtitulo && <p style={{ margin: '0 0 22px', color: 'var(--cafe-medio)', fontSize: '0.92rem' }}>{subtitulo}</p>}
          {children}
          {pie && <div style={{ marginTop: 20, textAlign: 'center', fontSize: '0.9rem' }}>{pie}</div>}
        </section>
      </main>
    </div>
  )
}

// Lee un parámetro de la parte "?..." del hash, p. ej. #nueva-password?token=abc
export function parametroHash(nombre) {
  return new URLSearchParams(window.location.hash.split('?')[1] || '').get(nombre)
}
