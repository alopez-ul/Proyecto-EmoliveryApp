-- US14 conectado a la base: el pago con QR de Yape ahora paga una orden real de US13.
-- Al pagar, la orden pasa de 'pendiente_pago' a 'pendiente', se guarda la hora del pago (pagada_en, de la
-- migración 016; desde ahí cuenta el plazo de cancelación de US16) y el número de operación de Yape.

-- T65: un número de operación de Yape sirve para pagar una sola orden, también entre reinicios del servidor.
ALTER TABLE ordenes ADD COLUMN numero_operacion TEXT CHECK (numero_operacion ~ '^\d{6,10}$');
CREATE UNIQUE INDEX ordenes_numero_operacion_unico ON ordenes (numero_operacion) WHERE numero_operacion IS NOT NULL;

-- T67 (RNF06): bitácora de transacciones de pago. Cada intento, aceptado o rechazado, queda registrado.
CREATE TABLE transacciones_pago (
  id                SERIAL PRIMARY KEY,
  orden_id          INTEGER REFERENCES ordenes (id) ON DELETE CASCADE,
  cliente_id        UUID REFERENCES usuarios (id) ON DELETE CASCADE,
  metodo            TEXT NOT NULL DEFAULT 'YAPE_QR',
  numero_operacion  TEXT NOT NULL DEFAULT '',
  monto_ingresado   NUMERIC(8, 2),
  monto_esperado    NUMERIC(8, 2),
  resultado         TEXT NOT NULL CHECK (resultado IN ('ACEPTADO', 'RECHAZADO')),
  codigo_causa      TEXT NOT NULL,
  detalle           TEXT NOT NULL,
  creada_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX transacciones_pago_orden_idx ON transacciones_pago (orden_id, creada_en DESC);
