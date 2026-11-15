-- US10: puntos habituales del emolientero (zona, día de la semana y rango horario).
-- Alimentan a PatronHistorico (src/fuentes/patronHistorico.js), la fuente de localización de baja
-- precisión ('horario_habitual'), que ubica de forma aproximada a quien no tiene la jornada abierta.

-- btree_gist permite combinar "=" (emolientero, día) con "&&" (rango horario) en una restricción EXCLUDE.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE puntos_habituales (
  id              SERIAL PRIMARY KEY,
  emolientero_id  UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  referencia      TEXT NOT NULL CHECK (char_length(referencia) BETWEEN 3 AND 100),
  lat             DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng             DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  -- ISO 8601: 1 = lunes ... 7 = domingo (igual que EXTRACT(ISODOW ...)).
  dia_semana      SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
  hora_inicio     TIME NOT NULL,
  hora_fin        TIME NOT NULL,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- T47: el rango es coherente (no termina antes ni a la misma hora que empieza; no cruza la medianoche).
  CONSTRAINT puntos_habituales_rango_coherente CHECK (hora_fin > hora_inicio),
  -- T47: un emolientero no puede estar en dos puntos a la vez el mismo día. El rango es [inicio, fin),
  -- así 08:00-10:00 y 10:00-12:00 no chocan. La API revisa antes para dar un mensaje claro; esta
  -- restricción resuelve los registros simultáneos.
  CONSTRAINT puntos_habituales_sin_traslape EXCLUDE USING gist (
    emolientero_id WITH =,
    dia_semana WITH =,
    tsrange(DATE '2000-01-01' + hora_inicio, DATE '2000-01-01' + hora_fin, '[)') WITH &&
  )
);
