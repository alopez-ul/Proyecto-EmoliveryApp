-- US23: verificación de emolienteros (aprobar o rechazar su registro) y notificaciones.

-- DNI del emolientero (US02 lo pide al registrarse).
ALTER TABLE usuarios ADD COLUMN dni TEXT CHECK (dni ~ '^\d{8}$');
CREATE UNIQUE INDEX usuarios_dni_unico ON usuarios (dni) WHERE dni IS NOT NULL;

-- Nuevo estado: rechazado.
ALTER TABLE usuarios DROP CONSTRAINT usuarios_estado_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_estado_check
  CHECK (estado IN ('activo', 'suspendido', 'pendiente_verificacion', 'rechazado'));

-- Bandeja de pendientes (T28), ordenada por antigüedad.
CREATE INDEX usuarios_pendientes_idx ON usuarios (creado_en) WHERE estado = 'pendiente_verificacion';

-- Historial de decisiones (T30). Un rechazo siempre lleva motivo.
CREATE TABLE verificaciones (
  id          SERIAL PRIMARY KEY,
  usuario_id  UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  admin_id    UUID REFERENCES usuarios (id) ON DELETE SET NULL,
  decision    TEXT NOT NULL CHECK (decision IN ('aprobado', 'rechazado')),
  motivo      TEXT,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (decision = 'aprobado' OR length(trim(motivo)) >= 10)
);

CREATE INDEX verificaciones_usuario_idx ON verificaciones (usuario_id, creado_en DESC);

-- Notificaciones dentro de la app (T31). Cuando haya envío de correos, se enviarán también por ahí.
CREATE TABLE notificaciones (
  id          SERIAL PRIMARY KEY,
  usuario_id  UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL,
  titulo      TEXT NOT NULL,
  mensaje     TEXT NOT NULL,
  leida       BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notificaciones_usuario_idx ON notificaciones (usuario_id, creado_en DESC);
