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
│       └── routes/     puntos, productos, ventas
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
npm run dev           # levanta la API (:3001) y la web (:5173)
```

`.env.local` contiene credenciales y no se sube al repositorio.

El mapa usa Google Maps si `frontend/.env` tiene `VITE_GOOGLE_MAPS_API_KEY` (ver `frontend/.env.example`); si no, usa un mapa de respaldo con Leaflet y mosaicos de Esri, sin necesidad de clave.

Abre http://localhost:5173. Vite redirige `/api` al backend.

## API

| Método | Ruta                     | Descripción                          |
|--------|--------------------------|--------------------------------------|
| GET    | /api/health              | Estado de la API y de la conexión a la BD |
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
