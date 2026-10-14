# Mapa de la Feria de Tristán Narvaja

Mapa interactivo de la feria de Tristán Narvaja (Cordón, Montevideo): puestos, sectores, recorridos y piques.

- **Sitio público** (`/`): mapa de consulta pensado primero para celular. Filtros por categoría, referencias de colores, buscador, ficha de cada lugar con foto, "Cómo llegar" y links para compartir.
- **Estudio** (`/admin`): panel para la diseñadora. Se puede pintar cuadras, dibujar franjas y zonas que se pegan a las calles, ubicar puntos y textos, subir íconos propios, darle significado a cada color y cambiar todo el estilo del mapa base. Los cambios se guardan solos y se pueden deshacer.

```bash
npm install
cp .env.example .env.local   # completá usuario/contraseña (ya hay un .env.local de desarrollo)
npm run dev                  # http://localhost:3000  ·  Estudio: http://localhost:3000/admin
```

Toda la documentación está en **[docs/GUIA.md](docs/GUIA.md)**: cómo levantarlo, cómo probar cada parte, cómo publicarlo gratis (Vercel + Supabase) y qué falta para el login con Google.

## Stack

| Pieza | Elección | Por qué |
|---|---|---|
| Mapa | [MapLibre GL JS](https://maplibre.org) (BSD-3) | Open source, sin claves ni límites, vectorial: todo se puede re-estilizar |
| Teselas | [OpenFreeMap](https://openfreemap.org) | Gratis, sin registro, sin límite de vistas, uso comercial permitido |
| Datos de calles | OpenStreetMap (ODbL) | Las cuadras de la feria (`public/data/cuadras.geojson`) para pintar y para el imán |
| App | Next.js 16 + React 19 + TypeScript | Sitio público y Estudio en un mismo proyecto, con API propia |
| Datos | Archivo local **o** Supabase (Postgres + Storage) | Se elige con `DATA_DRIVER`: local para desarrollar, Supabase para producción |

Datos del mapa © colaboradores de OpenStreetMap · Teselas © OpenMapTiles / OpenFreeMap.
