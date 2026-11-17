-- US24: gestión de usuarios registrados. El administrador suspende o reactiva cuentas indicando un motivo;
-- cada cambio queda registrado con quién lo hizo y cuándo (T102).
CREATE TABLE cambios_estado_cuenta (
  id          SERIAL PRIMARY KEY,
  usuario_id  UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  admin_id    UUID REFERENCES usuarios (id) ON DELETE SET NULL,
  accion      TEXT NOT NULL CHECK (accion IN ('suspender', 'reactivar')),
  motivo      TEXT NOT NULL CHECK (char_length(motivo) BETWEEN 10 AND 500),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX cambios_estado_cuenta_usuario_idx ON cambios_estado_cuenta (usuario_id, creado_en DESC);
