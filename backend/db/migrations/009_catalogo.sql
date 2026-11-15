-- Catálogo de productos de cada emolientero. US12 lo consulta (vista pública);
-- US11 (gestión del catálogo por el emolientero) lo crea y edita.

CREATE TABLE catalogo_productos (
  id              SERIAL PRIMARY KEY,
  emolientero_id  UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL CHECK (length(trim(nombre)) BETWEEN 2 AND 80),
  descripcion     TEXT NOT NULL DEFAULT '' CHECK (length(descripcion) <= 200),
  -- Categorías fijas para que la vista pública agrupe igual en todos los puestos (T54).
  categoria       TEXT NOT NULL CHECK (categoria IN ('emoliente', 'quinua_avena', 'maca', 'otras_bebidas', 'acompanamiento')),
  precio          NUMERIC(8, 2) NOT NULL CHECK (precio > 0),
  -- false = agotado hoy: sigue visible en el catálogo, pero no se puede comprar (T55).
  disponible      BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un emolientero no repite el nombre de un producto (sin distinguir mayúsculas).
CREATE UNIQUE INDEX catalogo_productos_nombre_unico ON catalogo_productos (emolientero_id, lower(nombre));
CREATE INDEX catalogo_productos_emolientero_idx ON catalogo_productos (emolientero_id, categoria);
