-- US25: moderación de contenido. Los usuarios reportan reseñas; el administrador decide ocultarlas o
-- mantenerlas, y la decisión queda registrada (RNF06). Ocultar una reseña baja la reputación de su autor.

-- T105: una reseña oculta deja de verse en la vista pública (US18) y no admite respuesta (US19).
ALTER TABLE resenas ADD COLUMN oculta_en TIMESTAMPTZ;

-- T106: reputación del usuario, de 0 a 100. Empieza en 100 y baja cuando se oculta contenido suyo.
ALTER TABLE usuarios ADD COLUMN reputacion SMALLINT NOT NULL DEFAULT 100 CHECK (reputacion BETWEEN 0 AND 100);

CREATE TABLE reportes (
  id             SERIAL PRIMARY KEY,
  -- Si el autor elimina su reseña, el reporte se conserva (con resena_id NULL) para el registro (T107).
  resena_id      INTEGER REFERENCES resenas (id) ON DELETE SET NULL,
  reportado_id   UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE, -- autor del contenido
  reportante_id  UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  motivo         TEXT NOT NULL CHECK (char_length(motivo) BETWEEN 10 AND 300),
  contenido      TEXT NOT NULL DEFAULT '', -- copia del comentario al momento de reportarlo
  estado         TEXT NOT NULL DEFAULT 'pendiente'
                 CHECK (estado IN ('pendiente', 'oculto', 'mantenido', 'contenido_eliminado')),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- T105 (RNF06): registro de la decisión: quién, cuándo y por qué.
  decidido_por   UUID REFERENCES usuarios (id) ON DELETE SET NULL,
  decidido_en    TIMESTAMPTZ,
  nota_decision  TEXT CHECK (char_length(nota_decision) <= 500),
  -- Un reporte está pendiente si y solo si aún no tiene decisión.
  CHECK ((estado = 'pendiente') = (decidido_en IS NULL))
);

-- Una misma persona no puede tener dos reportes pendientes sobre la misma reseña.
CREATE UNIQUE INDEX reportes_uno_pendiente_por_persona ON reportes (resena_id, reportante_id) WHERE estado = 'pendiente';

-- T104: la bandeja lista los pendientes del más antiguo al más reciente.
CREATE INDEX reportes_pendientes_idx ON reportes (creado_en) WHERE estado = 'pendiente';
