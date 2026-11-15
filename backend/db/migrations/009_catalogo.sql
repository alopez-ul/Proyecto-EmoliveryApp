-- US11: catálogo de productos de cada emolientero (su punto de venta).
-- T52: composición con el punto de venta. Un producto no existe sin su emolientero: si se elimina
-- la cuenta, se eliminan sus productos (ON DELETE CASCADE).
-- Es independiente de la tabla `productos` de 001, que sigue usando `ventas`.

CREATE TABLE catalogo_productos (
  id              SERIAL PRIMARY KEY,
  emolientero_id  UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL CHECK (char_length(nombre) BETWEEN 3 AND 60),
  -- T51: categoría obligatoria. Debe coincidir con CATEGORIAS de src/validaciones/producto.js.
  categoria       TEXT NOT NULL CHECK (categoria IN ('emoliente', 'bebida', 'acompanamiento')),
  -- T51: precio positivo, con céntimos y un tope razonable para una bebida.
  precio          NUMERIC(6, 2) NOT NULL CHECK (precio > 0 AND precio <= 100),
  disponible      BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- T51: el nombre es único dentro del catálogo de cada emolientero, sin distinguir mayúsculas.
-- Dos emolienteros distintos sí pueden vender un "Emoliente clásico". La API revisa antes para dar
-- un mensaje claro; este índice resuelve los registros simultáneos.
CREATE UNIQUE INDEX catalogo_productos_nombre_unico ON catalogo_productos (emolientero_id, lower(nombre));
