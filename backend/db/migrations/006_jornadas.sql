-- US06: apertura y cierre de jornada del emolientero.
-- Cada fila es una jornada; está abierta mientras cerrada_en sea NULL.

CREATE TABLE jornadas (
  id              SERIAL PRIMARY KEY,
  emolientero_id  UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  abierta_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  cerrada_en      TIMESTAMPTZ,
  CHECK (cerrada_en IS NULL OR cerrada_en >= abierta_en)
);

-- Un emolientero solo puede tener una jornada abierta a la vez (también ante pedidos simultáneos).
CREATE UNIQUE INDEX jornadas_una_abierta ON jornadas (emolientero_id) WHERE cerrada_en IS NULL;

CREATE INDEX jornadas_emolientero_idx ON jornadas (emolientero_id, abierta_en DESC);
