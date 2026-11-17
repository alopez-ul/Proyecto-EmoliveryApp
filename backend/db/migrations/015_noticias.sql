-- US22: publicación de noticias. El administrador las redacta para un público (todos, clientes o
-- emolienteros) y una fecha de publicación (hoy o futura). Cada usuario ve en su panel las de su público
-- cuya fecha ya llegó, de la más reciente a la más antigua.

CREATE TABLE noticias (
  id                 SERIAL PRIMARY KEY,
  autor_id           UUID REFERENCES usuarios (id) ON DELETE SET NULL,
  titulo             TEXT NOT NULL CHECK (char_length(titulo) BETWEEN 5 AND 120),
  contenido          TEXT NOT NULL CHECK (char_length(contenido) BETWEEN 10 AND 2000),
  -- Debe coincidir con PUBLICOS de src/validaciones/noticia.js.
  publico            TEXT NOT NULL CHECK (publico IN ('todos', 'clientes', 'emolienteros')),
  -- Día (hora de Lima) desde el que se muestra. La API exige que no sea anterior a hoy al crearla.
  fecha_publicacion  DATE NOT NULL,
  creada_en          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- T98: listado por fecha.
CREATE INDEX noticias_fecha_idx ON noticias (fecha_publicacion DESC, creada_en DESC);
