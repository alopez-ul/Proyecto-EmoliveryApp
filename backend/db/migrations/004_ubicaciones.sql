-- US05: registro de ubicación del emolientero.
-- Cada registro es una lectura de GPS con su fecha y hora. Se guarda el historial completo
-- (no se pisa la anterior) y la ubicación "actual" es la más reciente de cada emolientero.
-- "fuente" prepara la jerarquía de fuentes de localización (US07/US08): hoy solo existe el GPS.

CREATE TABLE ubicaciones (
  id             SERIAL PRIMARY KEY,
  emolientero_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  lat            DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng            DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  precision_m    DOUBLE PRECISION NOT NULL CHECK (precision_m > 0),
  fuente         TEXT NOT NULL DEFAULT 'gps_emolientero'
                 CHECK (fuente IN ('gps_emolientero', 'avistamiento_cliente', 'horario_habitual')),
  registrada_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consulta frecuente: la última ubicación de cada emolientero.
CREATE INDEX ubicaciones_emolientero_reciente_idx ON ubicaciones (emolientero_id, registrada_en DESC);
