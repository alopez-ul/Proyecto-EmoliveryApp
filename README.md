# Emolivery

Versión base de una web para la venta de emolientes y el registro de puntos de venta en Lima, Perú, sobre un mapa de Google Maps.

## Estructura

```
ProyectoBase/
├── neon.ts             Configuración de Neon (servicios del proyecto)
├── backend/            API REST (Node + Express) sobre Neon Postgres
│   ├── db/migrations/  Migraciones SQL versionadas
│   └── src/
│       ├── server.js
│       ├── db.js       Pool de conexiones (node-postgres)
│       ├── migrate.js  Aplica las migraciones pendientes
│       ├── seed.js     Crea los usuarios de prueba
│       ├── seguridad.js  Contraseñas (scrypt), sesiones (JWT) y enlaces de recuperación
│       └── routes/     auth, puntos, productos, ventas
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
| GET    | /api/puntos              | Lista los puntos de venta            |
| POST   | /api/puntos              | Registra un punto `{nombre, encargado, lat, lng, direccion?, horario?}` |
| PATCH  | /api/puntos/:id          | Actualiza un punto (p. ej. `activo`) |
| DELETE | /api/puntos/:id          | Elimina un punto                     |
| GET    | /api/productos           | Catálogo de emolientes               |
| GET    | /api/ventas?puntoId=     | Lista ventas (opcionalmente por punto) |
| POST   | /api/ventas              | Registra una venta `{puntoId, productoId, cantidad}` |
| GET    | /api/ventas/resumen      | Métricas de ventas                   |

## Base de datos

- **Driver:** `pg` (node-postgres) con un pool, porque el backend es un servidor de larga duración.
- **Conexiones:** la app usa `DATABASE_URL` (con pooling); las migraciones usan `DATABASE_URL_UNPOOLED` (directa), como recomienda Neon.
- **Esquema:** se cambia solo con migraciones nuevas en `backend/db/migrations/` (`002_...sql`, `003_...sql`) y `npm run db:migrate`.
