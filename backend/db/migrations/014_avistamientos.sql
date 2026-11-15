-- US09: confirmación de avistamiento.
-- Cada confirmación de un cliente se guarda como una fila de `ubicaciones` con fuente
-- 'avistamiento_cliente' (así entra en el cálculo de confiabilidad de US08) y aquí, con quién la hizo.
-- Cuando varios clientes coinciden, se agrega otra fila de `ubicaciones` con fuente 'avistamiento_verificado'.

CREATE TABLE avistamientos (
  id              SERIAL PRIMARY KEY,
  ubicacion_id    INTEGER NOT NULL UNIQUE REFERENCES ubicaciones (id) ON DELETE CASCADE,
  emolientero_id  UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  cliente_id      UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  -- T79: distancia del cliente a la ubicación que confirmó (radio máximo de 100 m).
  distancia_m     DOUBLE PRECISION NOT NULL CHECK (distancia_m >= 0 AND distancia_m <= 100),
  -- T81: bloque de 30 min (epoch / 1800). Debe coincidir con ventanaDe() de src/fuentesUbicacion.js.
  ventana         INTEGER NOT NULL,
  registrado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- T81: un cliente confirma a un emolientero una sola vez por ventana. La API lo revisa con equals/hashCode
  -- para dar un mensaje claro; esta restricción resuelve las confirmaciones simultáneas.
  CONSTRAINT avistamientos_sin_repetir UNIQUE (emolientero_id, cliente_id, ventana)
);

-- T80: reportes recientes de un emolientero, para buscar coincidencias.
CREATE INDEX avistamientos_emolientero_reciente_idx ON avistamientos (emolientero_id, registrado_en DESC);
