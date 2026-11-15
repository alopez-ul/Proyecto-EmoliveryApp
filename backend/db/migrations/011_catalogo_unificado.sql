-- Sprint 2: une el catálogo de US11 (gestión, migración 009) con lo que necesita US12 (consulta pública).
-- La tabla de 009 se conserva; se le agregan la descripción y las categorías que muestra la vista
-- pública. "Otras bebidas" usa la clave 'bebida' que ya existía.
-- Las categorías deben coincidir con CATEGORIAS de src/validaciones/producto.js.

ALTER TABLE catalogo_productos
  ADD COLUMN descripcion TEXT NOT NULL DEFAULT '' CHECK (char_length(descripcion) <= 200);

ALTER TABLE catalogo_productos DROP CONSTRAINT catalogo_productos_categoria_check;
ALTER TABLE catalogo_productos ADD CONSTRAINT catalogo_productos_categoria_check
  CHECK (categoria IN ('emoliente', 'quinua_avena', 'maca', 'bebida', 'acompanamiento'));

-- Consulta de US12: el catálogo de un emolientero agrupado por categoría.
CREATE INDEX catalogo_productos_emolientero_idx ON catalogo_productos (emolientero_id, categoria);
