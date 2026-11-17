// Contenedor visual compartido por las pantallas de autenticación (US03 y US04) y los paneles.
import Encabezado from './Encabezado.jsx'

export const estilos = {
  campo: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 },
  etiqueta: { fontSize: '0.9rem', fontWeight: 600, color: 'var(--cafe)' },
  input: {
    font: 'inherit',
    padding: '12px 14px',
    border: '1px solid var(--borde-fuerte)',
    borderRadius: 12,
    background: 'var(--superficie)',
    color: 'var(--cafe)',
  },
  boton: {
    width: '100%',
    padding: '13px',
    marginTop: 6,
    border: 'none',
    borderRadius: 999,
    background: 'var(--caramelo)',
    color: '#fff',
    fontWeight: 600,
    fontSize: '1rem',
    cursor: 'pointer',
  },
  botonSecundario: {
    padding: '11px 14px',
    border: '1px solid var(--borde-fuerte)',
    borderRadius: 999,
    background: 'var(--superficie)',
    color: 'var(--cafe)',
    fontWeight: 600,
    cursor: 'pointer',
  },
  enlace: { color: 'var(--caramelo)', fontWeight: 600, textDecoration: 'none' },
  error: {
    padding: '12px 14px',
    marginBottom: 16,
    borderRadius: 12,
    background: '#fdecea',
    color: '#9b2c1f',
    fontSize: '0.92rem',
  },
  exito: {
    padding: '12px 14px',
    marginBottom: 16,
    borderRadius: 12,
    background: 'var(--hierba-suave)',
    color: 'var(--hierba)',
    fontSize: '0.92rem',
  },
  errorCampo: { fontSize: '0.82rem', color: '#9b2c1f' },
}

// ancho: el panel del usuario usa una tarjeta más ancha que el inicio de sesión.
export default function AuthCard({ titulo, subtitulo, children, pie, ancho = 440 }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo)' }}>
      <Encabezado />
      <main style={{ display: 'grid', placeItems: 'start center', padding: '48px 16px 64px' }}>
        <section
          style={{
            width: '100%',
            maxWidth: ancho,
            padding: '32px 28px',
            background: 'var(--superficie)',
            border: '1px solid var(--borde)',
            borderRadius: 20,
            boxShadow: 'var(--sombra-md)',
          }}
        >
          <h1 style={{ margin: '0 0 6px', fontSize: '1.75rem', lineHeight: 1.2 }}>{titulo}</h1>
          {subtitulo && <p style={{ margin: '0 0 24px', color: 'var(--cafe-medio)' }}>{subtitulo}</p>}
          {children}
          {pie && <div style={{ marginTop: 22, textAlign: 'center', fontSize: '0.95rem', color: 'var(--cafe-medio)' }}>{pie}</div>}
        </section>
      </main>
    </div>
  )
}

// Lee un parámetro de la parte "?..." del hash, p. ej. #nueva-password?token=abc
export function parametroHash(nombre) {
  return new URLSearchParams(window.location.hash.split('?')[1] || '').get(nombre)
}
