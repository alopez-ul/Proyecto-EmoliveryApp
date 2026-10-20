-- Órdenes (pedidos) de clientes a emolienteros. Por ahora solo lo necesario para la regla de US06:
-- no se puede cerrar la jornada con órdenes sin entregar. Crear, aceptar y entregar órdenes
-- (y sus pantallas) corresponde a la historia de pedidos.

CREATE TABLE ordenes (
  id              SERIAL PRIMARY KEY,
  cliente_id      UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  emolientero_id  UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  estado          TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente', 'en_camino', 'entregada', 'cancelada')),
  creada_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizada_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consulta de US06: órdenes sin entregar de un emolientero.
CREATE INDEX ordenes_sin_entregar_idx ON ordenes (emolientero_id) WHERE estado IN ('pendiente', 'en_camino');
