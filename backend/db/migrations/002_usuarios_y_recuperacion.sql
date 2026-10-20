-- US03 (inicio de sesión) y US04 (recuperación de contraseña).

CREATE TABLE usuarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  correo          TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  rol             TEXT NOT NULL CHECK (rol IN ('cliente', 'emolientero', 'admin')),
  estado          TEXT NOT NULL DEFAULT 'activo'
                  CHECK (estado IN ('activo', 'suspendido', 'pendiente_verificacion')),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- El correo es único sin distinguir mayúsculas.
CREATE UNIQUE INDEX usuarios_correo_unico ON usuarios (lower(correo));

-- Enlaces de recuperación. Solo se guarda el hash SHA-256 del token, nunca el token.
CREATE TABLE tokens_recuperacion (
  token_hash  TEXT PRIMARY KEY,
  usuario_id  UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  expira_en   TIMESTAMPTZ NOT NULL,
  usado_en    TIMESTAMPTZ,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tokens_recuperacion_usuario_idx ON tokens_recuperacion (usuario_id);
