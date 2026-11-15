-- US15: validación del código de recojo.
-- T68: cada orden lleva un código de recojo de un solo uso que el cliente muestra al recoger su pedido.
-- El código se genera en la API con crypto (src/codigoRecojo.js) al crear la orden. Las órdenes
-- creadas antes de esta migración quedan sin código (NULL) y no se pueden entregar con uno.

ALTER TABLE ordenes
  -- 6 caracteres sin los que se confunden al dictarlos (0/O, 1/I): A-H, J-N, P-Z y 2-9.
  ADD COLUMN codigo_recojo TEXT CHECK (codigo_recojo ~ '^[A-HJ-NP-Z2-9]{6}$'),
  -- Momento en que el emolientero validó el código. Mientras sea NULL, el código sigue sin usar.
  ADD COLUMN entregada_en TIMESTAMPTZ;

-- Un código identifica a una sola orden, aunque ya se haya usado (no se recicla).
CREATE UNIQUE INDEX ordenes_codigo_recojo_unico ON ordenes (codigo_recojo);

-- T70 (RNF12): al validar el código, la entrega y la habilitación de la reseña se guardan juntas.
-- Una fila por orden entregada: el cliente puede calificar al emolientero una sola vez por pedido.
-- La calificación y el comentario los completa el cliente en la historia de reseñas.
CREATE TABLE resenas (
  id              SERIAL PRIMARY KEY,
  orden_id        INTEGER NOT NULL UNIQUE REFERENCES ordenes (id) ON DELETE CASCADE,
  cliente_id      UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  emolientero_id  UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  calificacion    SMALLINT CHECK (calificacion BETWEEN 1 AND 5),
  comentario      TEXT CHECK (char_length(comentario) <= 500),
  habilitada_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  publicada_en    TIMESTAMPTZ,
  -- Publicada si y solo si tiene calificación.
  CHECK ((publicada_en IS NULL) = (calificacion IS NULL))
);

CREATE INDEX resenas_emolientero_idx ON resenas (emolientero_id);
