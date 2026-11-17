-- US21 en la base: emolienteros favoritos de cada cliente, sus preferencias de aviso y el registro de avisos.
-- Antes vivían en memoria (src/favoritos.js); ahora sobreviven a los reinicios y usan emolienteros reales.

-- T93: un cliente marca o desmarca emolienteros como favoritos.
CREATE TABLE favoritos (
  cliente_id      UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  emolientero_id  UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cliente_id, emolientero_id)
);
-- Al abrir jornada se buscan los clientes que tienen a ese emolientero de favorito.
CREATE INDEX favoritos_emolientero_idx ON favoritos (emolientero_id);

-- T95/T96: preferencias del cliente. Sin fila = avisos activos y cualquier zona.
-- zonas vacío = todas las zonas de La Molina. Deben coincidir con ZONAS_LA_MOLINA de src/avisosFavoritos.js.
CREATE TABLE preferencias_avisos (
  cliente_id      UUID PRIMARY KEY REFERENCES usuarios (id) ON DELETE CASCADE,
  avisos_activos  BOOLEAN NOT NULL DEFAULT TRUE,
  zonas           TEXT[] NOT NULL DEFAULT '{}',
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- T95/T96: cada apertura de jornada de un favorito queda registrada para el cliente, se le haya avisado
-- o no (por avisos desactivados o zona fuera de su interés), con el motivo.
CREATE TABLE avisos_apertura (
  id              SERIAL PRIMARY KEY,
  cliente_id      UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  emolientero_id  UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  jornada_id      INTEGER NOT NULL REFERENCES jornadas (id) ON DELETE CASCADE,
  zona            TEXT NOT NULL,
  enviado         BOOLEAN NOT NULL,
  motivo          TEXT NOT NULL,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, jornada_id)
);
CREATE INDEX avisos_apertura_cliente_idx ON avisos_apertura (cliente_id, creado_en DESC);
