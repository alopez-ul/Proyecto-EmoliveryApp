-- US02: registro de emolientero. El DNI y el estado pendiente_verificacion ya existen (003);
-- aquí se agregan la autorización municipal y el celular de contacto.

-- Código de la autorización municipal de La Molina: MLM-AAAA-NNNNN. Una autorización, una cuenta.
ALTER TABLE usuarios ADD COLUMN codigo_municipal TEXT CHECK (codigo_municipal ~ '^MLM-\d{4}-\d{5}$');
CREATE UNIQUE INDEX usuarios_codigo_municipal_unico ON usuarios (codigo_municipal) WHERE codigo_municipal IS NOT NULL;

ALTER TABLE usuarios ADD COLUMN telefono TEXT CHECK (telefono ~ '^9\d{8}$');
