-- US16: cancelación de compra anticipada. El cliente puede anular una orden pagada y no entregada dentro
-- de los 30 minutos posteriores al pago; la orden pasa a 'cancelada' y se registra la devolución que el
-- emolientero debe hacerle.

-- Hora del pago: desde ahí corre el plazo de 30 minutos (T72). La registra el pago con QR de Yape (US14);
-- IF NOT EXISTS para no chocar si US14 también la crea.
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS pagada_en TIMESTAMPTZ;
ALTER TABLE ordenes ADD COLUMN cancelada_en TIMESTAMPTZ;

-- T74: solicitud de devolución para el emolientero. Una por orden cancelada.
CREATE TABLE devoluciones (
  id              SERIAL PRIMARY KEY,
  orden_id        INTEGER NOT NULL UNIQUE REFERENCES ordenes (id) ON DELETE CASCADE,
  cliente_id      UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  emolientero_id  UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  monto           NUMERIC(8, 2) NOT NULL CHECK (monto > 0),
  estado          TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'realizada')),
  solicitada_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  realizada_en    TIMESTAMPTZ,
  -- Realizada si y solo si tiene fecha de realización.
  CHECK ((estado = 'realizada') = (realizada_en IS NOT NULL))
);

-- El emolientero ve primero sus devoluciones pendientes.
CREATE INDEX devoluciones_emolientero_idx ON devoluciones (emolientero_id, solicitada_en DESC);
