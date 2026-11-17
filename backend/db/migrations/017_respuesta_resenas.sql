-- US19: respuesta del emolientero a una reseña. Va en la misma fila de la reseña: así una reseña admite
-- una sola respuesta por construcción (T91), y se oculta junto con la reseña si la modera US25.
ALTER TABLE resenas
  ADD COLUMN respuesta TEXT CHECK (char_length(respuesta) BETWEEN 2 AND 500),
  ADD COLUMN respondida_en TIMESTAMPTZ,
  -- Respondida si y solo si tiene texto de respuesta.
  ADD CONSTRAINT resenas_respuesta_con_fecha CHECK ((respuesta IS NULL) = (respondida_en IS NULL)),
  -- Solo se responde una reseña publicada (con calificación).
  ADD CONSTRAINT resenas_respuesta_publicada CHECK (respuesta IS NULL OR publicada_en IS NOT NULL);
