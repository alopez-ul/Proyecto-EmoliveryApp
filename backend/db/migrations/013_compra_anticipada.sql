-- US13: compra anticipada. El cliente arma un carrito con productos del catálogo de un emolientero y
-- confirma la compra: se crea una orden en estado 'pendiente_pago' con vigencia de 15 minutos (el pago
-- con QR de Yape es US14). Cada línea guarda el nombre y el precio del momento de la compra (T58).

-- Nuevo estado inicial 'pendiente_pago'. No bloquea el cierre de jornada (US06): esa regla solo cuenta
-- las órdenes ya pagadas y sin entregar ('pendiente' y 'en_camino').
ALTER TABLE ordenes DROP CONSTRAINT ordenes_estado_check;
ALTER TABLE ordenes ADD CONSTRAINT ordenes_estado_check
  CHECK (estado IN ('pendiente_pago', 'pendiente', 'en_camino', 'entregada', 'cancelada'));

-- Las órdenes creadas antes de US13 no tienen total ni vigencia: por eso ambas columnas admiten NULL.
ALTER TABLE ordenes ADD COLUMN total NUMERIC(8, 2) CHECK (total > 0);
ALTER TABLE ordenes ADD COLUMN expira_en TIMESTAMPTZ;

-- T60: una orden pendiente de pago siempre tiene su vigencia.
ALTER TABLE ordenes ADD CONSTRAINT ordenes_pendiente_pago_con_vigencia
  CHECK (estado <> 'pendiente_pago' OR expira_en IS NOT NULL);

-- T58: LineaDeOrden. Composición con la orden (si se elimina la orden, se eliminan sus líneas).
-- El nombre y el precio se copian del catálogo al comprar: si después el emolientero cambia el precio o
-- borra el producto, la orden conserva lo que el cliente compró.
CREATE TABLE lineas_orden (
  id               SERIAL PRIMARY KEY,
  orden_id         INTEGER NOT NULL REFERENCES ordenes (id) ON DELETE CASCADE,
  producto_id      INTEGER REFERENCES catalogo_productos (id) ON DELETE SET NULL,
  nombre           TEXT NOT NULL,
  precio_unitario  NUMERIC(6, 2) NOT NULL CHECK (precio_unitario > 0),
  cantidad         SMALLINT NOT NULL CHECK (cantidad BETWEEN 1 AND 20),
  -- Un producto aparece una sola vez por orden (con su cantidad). También sirve de índice por orden.
  UNIQUE (orden_id, producto_id)
);
