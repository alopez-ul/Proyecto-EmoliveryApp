# Emolivery

Versión base de una web para la venta de emolientes y el registro de puntos de venta en Lima, Perú, sobre un mapa de Google Maps.

## Estructura

```
ProyectoBase/
├── neon.ts             Configuración de Neon (servicios del proyecto)
├── backend/            API REST (Node + Express) sobre Neon Postgres
│   ├── db/migrations/  Migraciones SQL versionadas
│   ├── test/           Pruebas automáticas (npm test)
│   └── src/
│       ├── app.js      Crea la app Express (rutas y errores)
│       ├── server.js   Arranca la app en el puerto 3001
│       ├── autenticacion.js  Middleware de sesión y de rol
│       ├── notificaciones.js Notificaciones al usuario
│       ├── db.js       Pool de conexiones (node-postgres)
│       ├── migrate.js  Aplica las migraciones pendientes
│       ├── seed.js     Crea los usuarios de prueba
│       ├── seguridad.js  Contraseñas (scrypt), sesiones (JWT) y enlaces de recuperación
│       └── routes/     auth, admin, notificaciones, puntos, productos, ventas
└── frontend/           Vite + React
    └── src/
        ├── pages/MainPage.jsx
        ├── components/ MapaLima (elige MapaGoogle o MapaOSM), MenuPrincipal, EmolienteIcon
        └── services/api.js
```

## Cómo ejecutarlo

Requiere Node 22.9 o superior.

La base de datos es **Neon Postgres**. La primera vez:

```bash
npm i -g neon@latest
neon login            # inicia sesión en Neon (abre el navegador)
neon env pull         # crea .env.local con DATABASE_URL y DATABASE_URL_UNPOOLED
```

Luego:

```bash
npm run install:all   # instala raíz, backend y frontend
npm run db:migrate    # crea/actualiza las tablas en Neon
npm run db:seed       # (opcional) crea los usuarios de prueba
npm run dev           # levanta la API (:3001) y la web (:5173)
npm test              # pruebas automáticas de la API (usan la BD de .env.local)
```

Además, copia `backend/.env.example` como `backend/.env` y completa `JWT_SECRET` (clave para firmar las sesiones). En desarrollo puedes poner `BUZON_SIMULADO=true` para ver en pantalla el enlace de recuperación de contraseña, ya que aún no se envían correos.

`.env.local` y `backend/.env` contienen credenciales y no se suben al repositorio.

### Usuarios de prueba (`npm run db:seed`)

| Correo | Contraseña | Rol |
|---|---|---|
| cliente@emolivery.pe | Cliente123 | cliente |
| emolientero@emolivery.pe | Emoliente123 | emolientero |
| admin@emolivery.pe | Admin123 | admin |
| suspendido@emolivery.pe | Suspendido123 | cliente (cuenta suspendida) |
| rosa@, luis@, juana@emolivery.pe | Pendiente123 | emolienteros pendientes de verificación (US23) |

Sus contraseñas son públicas: no ejecutes `db:seed` en una base con usuarios reales.

El mapa usa Google Maps si `frontend/.env` tiene `VITE_GOOGLE_MAPS_API_KEY` (ver `frontend/.env.example`); si no, usa un mapa de respaldo con Leaflet y mosaicos de Esri, sin necesidad de clave.

Abre http://localhost:5173. Vite redirige `/api` al backend.

## API

| Método | Ruta                     | Descripción                          |
|--------|--------------------------|--------------------------------------|
| GET    | /api/health              | Estado de la API y de la conexión a la BD |
| POST   | /api/auth/login          | US03: inicia sesión `{correo, password}` → `{token, usuario}` |
| GET    | /api/auth/yo             | Usuario de la sesión (cabecera `Authorization: Bearer <token>`) |
| POST   | /api/auth/recuperar      | US04: genera un enlace de recuperación `{correo}` (respuesta igual exista o no el correo) |
| GET    | /api/auth/recuperar/:token | US04: indica si el enlace sigue vigente |
| POST   | /api/auth/nueva-password | US04: define la nueva contraseña `{token, password}` |
| POST   | /api/emolienteros/registro | US02: registra un emolientero `{nombreNegocio, dni, codigoMunicipal, telefono, correo, password}` en `pendiente_verificacion` y notifica a los admins. 400 con `campos` si hay datos inválidos; 409 si el DNI, el código o el correo ya existen |
| POST   | /api/clientes/registro   | US01: registra un cliente `{nombre, telefono, correo, password}` como `activo`. 400 con `campos` si hay datos inválidos; 409 si el correo ya existe |
| GET    | /api/ubicaciones         | US05/US08: ubicación más confiable de los emolienteros **con la jornada abierta** (público, para el mapa), con `antiguedadMin` y `confiabilidad` (`alto` < 15 min, `medio` ≤ 1 h, `bajo` > 1 h o solo horario habitual). Excluye las de más de 4 h sin confirmación |
| GET    | /api/ubicaciones/mia     | US05: última ubicación del emolientero con sesión |
| POST   | /api/ubicaciones         | US05: registra la ubicación `{lat, lng, precision}` (solo La Molina, precisión de 50 m o mejor) |
| GET    | /api/catalogo/:emolienteroId | US12: catálogo público agrupado por categoría, con `precio`, `disponible` y `comprable` por producto; `puedeComprar` es false fuera de jornada. 404 si el emolientero no existe o no está activo |
| GET    | /api/jornadas/estado     | US06: jornada abierta, ubicación de hoy y jornadas de hoy (solo emolientero) |
| POST   | /api/jornadas/abrir      | US06: abre la jornada; exige ubicación registrada hoy (422 si no) y una sola abierta (409) |
| POST   | /api/jornadas/cerrar     | US06: cierra la jornada abierta (409 si no hay; 422 si quedan órdenes sin entregar) |
| GET    | /api/puntos-habituales   | US10: puntos habituales del emolientero con sesión, por día y hora |
| POST   | /api/puntos-habituales   | US10: registra `{referencia, lat, lng, diaSemana (1=lunes…7=domingo), horaInicio, horaFin ("HH:MM")}`. 400 con `campos` si hay datos inválidos (p. ej. fin no posterior al inicio); 409 si se cruza con otro punto suyo del mismo día |
| DELETE | /api/puntos-habituales/:id | US10: elimina un punto propio (404 si no existe o es de otro) |
| GET    | /api/catalogo            | US11: catálogo del emolientero con sesión, por categoría y nombre |
| POST   | /api/catalogo            | US11: agrega un producto `{nombre, descripcion?, categoria ("emoliente", "quinua_avena", "maca", "bebida" o "acompanamiento"), precio, disponible}`. 400 con `campos` si hay datos inválidos; 409 si ya tiene un producto con ese nombre |
| PATCH  | /api/catalogo/:id        | US11: edita un producto propio (mismos campos y reglas; 404 si no existe o es de otro) |
| POST   | /api/ordenes             | US13: el cliente confirma su carrito `{emolienteroId, lineas: [{productoId, cantidad}]}` → orden `pendiente_pago` con vigencia de 15 min y precios congelados. 400 si el carrito está vacío o es inválido; 422 si el emolientero cerró su jornada o un producto ya no está disponible (solo cliente) |
| GET    | /api/ordenes/:id         | US13: orden propia con sus líneas, `total`, `expiraEn` y `vencida` (solo cliente) |
| GET    | /api/resenas/emolientero/:id | US18: reseñas publicadas de un emolientero, de la más reciente a la más antigua, con `promedio` (1 decimal) y `total`. Sin reseñas: `total` 0 y `promedio` null (público) |
| POST   | /api/moderacion/resenas/:id/reportes | US25: reporta una reseña `{motivo}` (10–300 caracteres; con sesión). 409 si ya la reportaste y sigue pendiente; 422 si es tuya |
| GET    | /api/moderacion/reportes?estado=pendientes o atendidos | US25: bandeja de reportes pendientes o registro de decisiones (solo admin) |
| POST   | /api/moderacion/reportes/:id/decision | US25: `{decision: "ocultar" o "mantener", nota}`. Ocultar oculta la reseña y baja 10 puntos la reputación del autor. 409 si ya fue atendido; 410 si el autor eliminó la reseña (solo admin) |
| POST   | /api/ordenes/:id/cancelar | US16: el cliente cancela su orden pagada y no entregada dentro de los 30 min posteriores al pago. Registra la devolución y avisa al emolientero. 409 fuera de plazo, ya entregada, ya cancelada o sin pagar |
| GET    | /api/devoluciones        | US16: devoluciones del emolientero por pedidos cancelados, primero las pendientes (solo emolientero) |
| POST   | /api/devoluciones/:id/realizada | US16: el emolientero marca la devolución como hecha y se avisa al cliente. 409 si ya estaba realizada |
| GET    | /api/resenas/mias        | US19: reseñas publicadas sobre el emolientero con sesión, con su respuesta y si fueron ocultadas |
| POST   | /api/resenas/:id/respuesta | US19: responde una reseña `{respuesta}` (2–500 caracteres). Solo una respuesta por reseña; 409 si ya tiene respuesta o fue ocultada por moderación |
| GET    | /api/admin/usuarios?rol=&estado=&desde=&hasta= | US24: usuarios filtrados por rol, estado y fecha de registro (AAAA-MM-DD, hora de Lima), con `totales` por rol y por estado (solo admin) |
| POST   | /api/admin/usuarios/:id/suspender | US24: suspende una cuenta activa `{motivo}` (10–500). 409 con la lista `ordenes` si es un emolientero con pedidos pagados por entregar; 422 si es un admin o tu propia cuenta |
| POST   | /api/admin/usuarios/:id/reactivar | US24: reactiva una cuenta suspendida `{motivo}` y le avisa |
| GET    | /api/ubicaciones/estimadas | US10: ubicación aproximada (`fuente: horario_habitual`, 300 m, `confiabilidad: bajo`) de los emolienteros **sin** jornada abierta que suelen estar en un punto a esta hora (público, para el mapa) |
| GET    | /api/ordenes/mias        | US15: pedidos del cliente con sesión, con su `codigoRecojo` ("ABC-23X") y si ya tiene la reseña habilitada |
| GET    | /api/ordenes/por-entregar | US15: pedidos pendientes o en camino del emolientero con sesión (sin el código) |
| POST   | /api/ordenes/entregar    | US15: valida `{codigo}` y entrega el pedido. 200 `{orden, resena}`; 400 si el formato es inválido; 404 si no existe; 403 si es de otro emolientero; 409 si ya se usó o el pedido está cancelado |
| POST   | /api/avistamientos       | US09: el cliente confirma `{emolienteroId, lat, lng, precision}` (su GPS). 201 `{avistamiento, verificado, confirmaciones}`; 422 si está a más de 100 m, el GPS es impreciso o el emolientero no atiende; 409 si ya lo confirmó en esta ventana de 30 min; 404 si no existe |
| GET    | /api/noticias            | US22: noticias del usuario con sesión (de su público o para todos) cuya fecha ya llegó, de la más reciente a la más antigua |
| GET    | /api/noticias/todas      | US22: todas las noticias, con `programada` (solo admin) |
| POST   | /api/noticias            | US22: publica `{titulo, contenido, publico ("todos", "clientes" o "emolienteros"), fechaPublicacion ("AAAA-MM-DD")}` (solo admin). 400 con `campos` si hay datos inválidos o la fecha es anterior a hoy |
| DELETE | /api/noticias/:id        | US22: elimina una noticia (solo admin) |
| GET    | /api/admin/emolienteros/pendientes | US23: bandeja de emolienteros por verificar (solo admin) |
| GET    | /api/admin/emolienteros/historial  | US23: decisiones tomadas (solo admin) |
| POST   | /api/admin/emolienteros/:id/aprobar  | US23: aprueba → cuenta `activo` y notifica (solo admin) |
| POST   | /api/admin/emolienteros/:id/rechazar | US23: rechaza `{motivo}` (10–500 caracteres) → `rechazado` y notifica (solo admin) |
| GET    | /api/notificaciones      | Notificaciones del usuario con sesión |
| POST   | /api/notificaciones/:id/leida | Marca una notificación como leída |
| GET    | /api/puntos              | Lista los puntos de venta            |
| POST   | /api/puntos              | Registra un punto `{nombre, encargado, lat, lng, direccion?, horario?}` |
| PATCH  | /api/puntos/:id          | Actualiza un punto (p. ej. `activo`) |
| DELETE | /api/puntos/:id          | Elimina un punto                     |
| GET    | /api/productos           | Catálogo de emolientes               |
| GET    | /api/ventas?puntoId=     | Lista ventas (opcionalmente por punto) |
| POST   | /api/ventas              | Registra una venta `{puntoId, productoId, cantidad}` |
| GET    | /api/ventas/resumen      | Métricas de ventas                   |

## Registro de emolientero (US02)

- El código de autorización municipal de La Molina tiene el formato `MLM-AAAA-NNNNN` (año entre 2000 y el actual, correlativo distinto de 00000). La regla vive en `backend/src/validaciones/emolientero.js`.
- DNI, código municipal y correo son únicos. Se revisan antes de insertar, y los índices únicos de la BD resuelven los registros simultáneos.
- La cuenta y el aviso a cada administrador activo se crean en una sola transacción. El aviso se ve en las notificaciones del panel del admin.
- `npm test` incluye las pruebas de T09: DNI duplicado y código inválido, contra la BD de `.env.local`.

## Puntos habituales del emolientero (US10)

- El emolientero los registra en `#puntos-habituales` (enlace en su panel): zona marcada en el mapa dentro de La Molina con una referencia, día de la semana y rango horario.
- Reglas (`backend/src/validaciones/puntoHabitual.js`, repetidas en el frontend solo para avisar antes): la hora de fin debe ser posterior a la de inicio (no se admiten rangos que crucen la medianoche) y los rangos de un mismo día no pueden cruzarse. Los rangos son `[inicio, fin)`: 08:00–10:00 y 10:00–12:00 son válidos. La restricción `EXCLUDE` de la migración 008 frena los registros simultáneos.
- `PatronHistorico` es la fuente de localización de baja precisión (`horario_habitual`, 300 m, confiabilidad `bajo`) dentro de la jerarquía de fuentes de US08 (`backend/src/fuentesUbicacion.js`): a quien no tiene la jornada abierta lo ubica en su punto habitual del momento (hora de Lima). Si tiene la jornada abierta manda su GPS. El mapa muestra estas ubicaciones con un marcador punteado.

## Catálogo: gestión (US11) y consulta (US12)

- Cada emolientero tiene su catálogo en `catalogo_productos` (migraciones `009` y `011`), con nombre, descripción opcional, categoría, precio y disponibilidad. Las categorías son `emoliente`, `quinua_avena`, `maca`, `bebida` (Otras bebidas) y `acompanamiento`; viven en `backend/src/validaciones/producto.js`.
- US11: el emolientero lo administra en `#mi-catalogo` (enlace en su panel). El nombre no se repite dentro de su catálogo y el precio va de S/ 0.01 a S/ 100. `npm run db:seed` carga un catálogo de prueba para `emolientero@emolivery.pe`.
- Al tocar un emolientero en el mapa se abre `#catalogo?id=<emolientero>`. La vista agrupa los productos por categoría, siempre en el mismo orden: Emolientes, Quinua y avena, Maca, Otras bebidas y Acompañamientos.
- Un producto agotado sigue visible, pero no se puede comprar. Fuera de jornada todo el catálogo se ve, pero ningún producto se puede comprar.
- Solo publican su catálogo los emolienteros con cuenta activa. Uno pendiente, rechazado o suspendido responde 404.
- Al crear la compra anticipada, US13 debe volver a comprobar en el servidor la jornada y la disponibilidad, porque deshabilitar el botón en pantalla no basta.

## Código de recojo (US15)

- Cada pedido tiene un código de recojo de un solo uso: 6 caracteres sin 0/O ni 1/I, generado con `crypto` (`backend/src/codigoRecojo.js`). Se crea con `crearOrden()`, que US13 debe usar al crear la compra anticipada. El cliente lo ve en su panel ("Mis pedidos").
- El emolientero lo valida en `#validar-recojo` (botón en su panel). En **una sola transacción** (RNF12) la orden pasa a `entregada`, el código queda usado (`entregada_en`), se habilita la reseña del cliente (tabla `resenas`, migración `012`) y se le notifica. Si un paso falla no se guarda nada, y dos validaciones simultáneas del mismo código entregan una sola vez.
- `npm run db:seed` crea un pedido de `cliente@` a `emolientero@` por entregar e imprime su código.

## Confirmación de avistamiento (US09)

- En el catálogo de un emolientero que está atendiendo (se abre desde el mapa), el cliente con sesión pulsa "Sí, lo estoy viendo aquí". Se usa su GPS: debe estar a **100 m o menos** de la ubicación que muestra el mapa.
- La confirmación se guarda como una ubicación con fuente `avistamiento_cliente` (entra en la confiabilidad de US08) y en la tabla `avistamientos` (migración `014`), con el cliente y la distancia.
- `AvistamientoCliente` implementa `equals` y `hashCode` (RNF19): es el mismo avistamiento si el mismo cliente confirma al mismo emolientero en la misma ventana de 30 min. Así se rechaza la confirmación repetida (409) y no se cuenta dos veces.
- Cuando 2 clientes distintos coinciden (últimos 30 min, a 100 m o menos entre sí) se registra un `AvistamientoVerificado` en el punto medio de sus reportes.
- La regla para abrir jornada (US06) y "Mi ubicación" (US05) solo cuentan el GPS del propio emolientero, no los avistamientos.

## Noticias (US22)

- El administrador las publica en la pestaña "Noticias" de su panel: título, contenido, público objetivo (todos, clientes o emolienteros) y fecha de publicación, que no puede ser anterior a hoy (hora de Lima). Con fecha futura quedan programadas.
- Clientes y emolienteros ven en su panel las noticias de su público cuya fecha ya llegó, de la más reciente a la más antigua (tabla `noticias`, migración `015`).

## Cancelación, respuestas y gestión de usuarios (US16, US19, US24)

- **US16:** el plazo de cancelación (30 min) se cuenta desde `ordenes.pagada_en` (migración `015_cancelacion.sql`), que debe llenar el pago con QR de US14. Cancelar anula la orden y libera lo que ocupaba: sale de los pedidos por entregar, su código de recojo deja de servir y ya no impide cerrar la jornada. Además registra una devolución en `devoluciones` que el emolientero ve en su panel. Cancelación y entrega van en una sola consulta, así que si llegan a la vez solo una se aplica.
- **US19:** la respuesta se guarda en la misma fila de la reseña (`resenas.respuesta`, migración `016_respuesta_resenas.sql`), así que solo puede haber una. Se ve en la vista pública de reseñas (US18) y se oculta junto con la reseña si la modera US25. El emolientero responde desde `#mis-resenas`.
- **US24:** pestaña "Usuarios" del panel del administrador. Cada suspensión o reactivación queda en `cambios_estado_cuenta` (migración `017_suspensiones.sql`) con su motivo y el admin que la hizo. Suspender a un emolientero le cierra la jornada abierta.
- Mientras no existan US14 (pago) y US17 (publicar reseña), `npm run db:seed` crea un pedido pagado cancelable y una reseña publicada para probar estas historias.

## Base de datos

- **Migraciones `012` a `015`:** `012` código de recojo y `resenas` (US15), `013` compra anticipada (US13), `014_avistamientos` (US09), `014_moderacion` (US25) y `015` noticias (US22). Hay dos `014` porque se crearon en ramas distintas; ya están aplicadas en Neon con esos nombres y **no se deben renombrar** (el sistema las reconoce por el nombre del archivo). La próxima migración es la `016`.
- **Pedidos:** la compra anticipada (US13) crea la orden en `pendiente_pago` y ya con su código de recojo; el código se valida (US15) cuando la orden pasa a `pendiente`, es decir, cuando está pagada.
- **Migraciones del sprint 2:** `008` puntos habituales (US10), `009` catálogo (US11), `010` fuente `avistamiento_verificado` (US08) y `011` descripción y categorías del catálogo (US11 + US12). Antes de crear una migración nueva, revisa el último número en `main` para no repetirlo.

- **Órdenes:** la tabla `ordenes` (migración 007) sirve para la regla de US06 (no cerrar la jornada con órdenes `pendiente` o `en_camino`) y para la entrega con código de recojo (US15). Crear órdenes desde la app corresponde a US13.

- **Driver:** `pg` (node-postgres) con un pool, porque el backend es un servidor de larga duración.
- **Conexiones:** la app usa `DATABASE_URL` (con pooling); las migraciones usan `DATABASE_URL_UNPOOLED` (directa), como recomienda Neon.
- **Esquema:** se cambia solo con migraciones nuevas en `backend/db/migrations/` (`002_...sql`, `003_...sql`) y `npm run db:migrate`.
