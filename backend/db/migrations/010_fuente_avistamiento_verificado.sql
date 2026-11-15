-- US08 (T41): la jerarquía de fuentes de ubicación tiene cuatro subclases (glosario, cap. 1.4):
-- GPS del vendedor, avistamiento de cliente, avistamiento verificado y patrón horario habitual.
-- La migración 004 solo admitía tres; se agrega 'avistamiento_verificado'.

ALTER TABLE ubicaciones DROP CONSTRAINT ubicaciones_fuente_check;
ALTER TABLE ubicaciones ADD CONSTRAINT ubicaciones_fuente_check
  CHECK (fuente IN ('gps_emolientero', 'avistamiento_cliente', 'avistamiento_verificado', 'horario_habitual'));
