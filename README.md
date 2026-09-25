# Emolientes Lima

Versión base de una web para la venta de emolientes y el registro de puntos de venta en Lima, Perú, sobre un mapa de Google Maps.

## Estructura

```
ProyectoBase/
├── backend/            API REST (Node + Express)
│   ├── data/db.json    Datos persistidos (productos, puntos, ventas)
│   └── src/
│       ├── server.js
│       ├── db.js
│       └── routes/     puntos, productos, ventas
└── frontend/           Vite + React
    └── src/
        ├── pages/MainPage.jsx
        ├── components/ MapaLima (elige MapaGoogle o MapaOSM), MenuEmoliente, EmolienteIcon, StatsHud, PuntoList, PuntoPanel, NuevoPuntoForm
        └── services/api.js
```

## Cómo ejecutarlo

Requiere Node 18 o superior.

```bash
npm run install:all   # instala raíz, backend y frontend
npm run dev           # levanta la API (:3001) y la web (:5173)
```

El mapa usa Google Maps si `frontend/.env` tiene `VITE_GOOGLE_MAPS_API_KEY` (ver `frontend/.env.example`); si no, usa OpenStreetMap como respaldo, sin necesidad de clave.

Abre http://localhost:5173. Vite redirige `/api` al backend.

## API

| Método | Ruta                     | Descripción                          |
|--------|--------------------------|--------------------------------------|
| GET    | /api/puntos              | Lista los puntos de venta            |
| POST   | /api/puntos              | Registra un punto `{nombre, encargado, lat, lng, direccion?, horario?}` |
| PATCH  | /api/puntos/:id          | Actualiza un punto (p. ej. `activo`) |
| DELETE | /api/puntos/:id          | Elimina un punto                     |
| GET    | /api/productos           | Catálogo de emolientes               |
| GET    | /api/ventas?puntoId=     | Lista ventas (opcionalmente por punto) |
| POST   | /api/ventas              | Registra una venta `{puntoId, productoId, cantidad}` |
| GET    | /api/ventas/resumen      | Métricas para el HUD                 |

La persistencia es un archivo JSON (`backend/data/db.json`), pensado para reemplazarse por una base de datos real.
