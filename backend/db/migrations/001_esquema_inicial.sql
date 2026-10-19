-- Esquema inicial: catálogo de productos, puntos de venta y ventas.

CREATE TABLE productos (
  id      SERIAL PRIMARY KEY,
  nombre  TEXT NOT NULL UNIQUE,
  precio  NUMERIC(8, 2) NOT NULL CHECK (precio >= 0)
);

CREATE TABLE puntos (
  id         SERIAL PRIMARY KEY,
  nombre     TEXT NOT NULL,
  encargado  TEXT NOT NULL,
  direccion  TEXT NOT NULL DEFAULT '',
  lat        DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng        DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  horario    TEXT NOT NULL DEFAULT '',
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Si se elimina un punto, sus ventas se conservan con punto_id en NULL.
CREATE TABLE ventas (
  id           SERIAL PRIMARY KEY,
  punto_id     INTEGER REFERENCES puntos (id) ON DELETE SET NULL,
  producto_id  INTEGER NOT NULL REFERENCES productos (id),
  cantidad     INTEGER NOT NULL CHECK (cantidad > 0),
  total        NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  fecha        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ventas_punto_id_idx ON ventas (punto_id);
CREATE INDEX ventas_fecha_idx ON ventas (fecha);

INSERT INTO productos (nombre, precio) VALUES
  ('Emoliente clásico', 1.50),
  ('Emoliente con maca', 2.00),
  ('Quinua con manzana', 2.00),
  ('Maca con leche', 2.50);
