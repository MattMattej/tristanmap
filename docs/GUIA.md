# Guía del proyecto · Mapa de la Feria de Tristán Narvaja

Esta guía explica cómo levantar el proyecto, probar cada parte, publicarlo gratis y qué falta para la fase 2 (login con Google y comentarios).

---

## Índice

1. [Qué hay y cómo está armado](#1-qué-hay-y-cómo-está-armado)
2. [Levantarlo en tu compu](#2-levantarlo-en-tu-compu)
3. [Probar el sitio público](#3-probar-el-sitio-público)
4. [Probar el Estudio (panel de la diseñadora)](#4-probar-el-estudio-panel-de-la-diseñadora)
5. [Guía rápida para la diseñadora](#5-guía-rápida-para-la-diseñadora)
6. [Publicarlo en internet (gratis)](#6-publicarlo-en-internet-gratis)
7. [Fase 2: login con Google y comentarios](#7-fase-2-login-con-google-y-comentarios)
8. [Arquitectura y carpetas](#8-arquitectura-y-carpetas)
9. [Tareas de mantenimiento](#9-tareas-de-mantenimiento)
10. [Próximos pasos sugeridos](#10-próximos-pasos-sugeridos)
11. [Problemas comunes](#11-problemas-comunes)

---

## 1. Qué hay y cómo está armado

| | Sitio público `/` | Estudio `/admin` |
|---|---|---|
| Para quién | Cualquier persona que va a la feria | La diseñadora o quien administre |
| Acceso | Libre, solo lectura | Usuario y contraseña (definidos en variables de entorno) |
| Pensado para | Celular primero | Compu (pantalla ancha, mouse y teclado) |

**Las capas del mapa, de abajo hacia arriba:**

1. **Mapa base, el "esqueleto"**: manzanas, calles, edificios, agua y nombres de calles. Sale de OpenStreetMap a través de OpenFreeMap, pero **el estilo es nuestro**. Cada color y grosor es un token que la diseñadora cambia desde el Estudio, en la pestaña *Estilo*.
2. **Zona de la feria**: un polígono. Lo que queda afuera se atenúa para que la mirada vaya a la feria.
3. **Zonas** (áreas): por ejemplo, "zona más concurrida".
4. **Franjas** (líneas sobre las calles): por ejemplo, "esta cuadra es de libros". Se pueden correr hacia una vereda.
5. **Textos** sobre el mapa: carteles como "ZONA DE LIBROS".
6. **Puntos**: puestos y piques, cada uno con su ícono, foto y descripción.

Cada franja o zona tiene un **significado** (un ítem de la *Leyenda*) y cada punto tiene una **categoría** (un *Ícono*). Así, si cambiás el color de "Sector libros", cambian a la vez todas las cuadras pintadas con ese significado.

### Decisiones técnicas (y por qué)

- **MapLibre GL JS** (licencia BSD) es el motor del mapa. No pide claves, no tiene límites y dibuja en vectorial, así que todo se puede re-estilizar en vivo.
- **OpenFreeMap** sirve las teselas vectoriales gratis, sin registro y sin límite de vistas, con uso comercial permitido. Solo pide atribución, y el mapa ya la muestra.
- **Next.js** junta en un solo proyecto el sitio público, el Estudio y la API.
- **Los datos tienen dos modos**, que se cambian con una variable:
  - `DATA_DRIVER=local`: todo queda en `data/db.json` y las fotos en `data/uploads/`. Sirve para desarrollar sin crear cuentas.
  - `DATA_DRIVER=supabase`: Postgres más Storage de Supabase, en la capa gratuita. Es el modo de producción.
- **Solo Montevideo**: el mapa no deja salir del departamento de Montevideo ni se descargan teselas de afuera (`MONTEVIDEO_BOUNDS` en `src/lib/defaults.ts`). Desde Estilo → *Vista inicial y límites* se puede achicar el área ("Limitar a la vista") o volver a todo Montevideo.
- **Caché**: el público nunca le pega directo a la base. La página usa una "foto" (snapshot) del contenido que se renueva **solo cuando la diseñadora guarda un cambio**, o como mucho una vez por hora. Mil visitas no generan mil consultas, así que los límites de la capa gratuita no son un problema.
- **Imágenes livianas**: las fotos se comprimen **en el navegador, antes de subir**. Se redimensionan a 1280 px como máximo, se convierten a WebP (sin metadata EXIF/GPS) y se genera una miniatura de 320 px. Una foto de celular de 3–5 MB queda en unos **60–150 KB**, más una miniatura de unos 10–18 KB. Los íconos (SVG, PNG, JPG o WebP) se convierten a WebP de 96 px con transparencia (unos 2–6 KB). El servidor rechaza cualquier archivo que supere esos máximos (fotos 600 KB, miniaturas 80 KB, íconos 120 KB). Por seguridad nunca se sirven SVG subidos por usuarios. El pie del Estudio muestra cuánto espacio ocupan las fotos.

---

## 2. Levantarlo en tu compu

**Requisitos:** Node.js 20.9 o más nuevo (probado con Node 22) y npm.

```bash
npm install          # instala dependencias (también copia el "worker" de MapLibre a public/vendor)
npm run dev          # http://localhost:3000
```

El repo ya trae un `.env.local` de desarrollo:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=feria
DATA_DRIVER=local
```

- Sitio público: <http://localhost:3000>
- Estudio: <http://localhost:3000/admin> (usuario `admin`, contraseña `feria`)

La primera vez se crea `data/db.json` con contenido de ejemplo: 6 categorías con íconos, 5 significados de leyenda, 5 puntos, 2 franjas y 1 texto. Todo está marcado "(ejemplo)" para borrarlo o reemplazarlo. **Para volver a empezar de cero, borrá la carpeta `data/`.**

**Probar el modo producción en local:**

```bash
npm run build
npm start
```

> ⚠️ **Sobre OneDrive:** el proyecto está dentro de una carpeta de OneDrive. `node_modules` y `.next` tienen miles de archivos y OneDrive va a intentar sincronizarlos, lo que vuelve todo lento. Lo ideal es mover el proyecto fuera de OneDrive (por ejemplo a `C:\proyectos\tristanmap`) y usar Git para el respaldo. Si no, como mínimo pausá la sincronización mientras trabajás.

---

## 3. Probar el sitio público

Abrí <http://localhost:3000>. Para la vista de celular, usá las herramientas de desarrollo del navegador (F12 → ícono de celular) o entrá desde el teléfono a `http://IP-de-tu-compu:3000`.

Checklist:

- [ ] El mapa abre centrado en Tristán Narvaja, con la zona de la feria resaltada.
- [ ] Arriba se ven el título, el horario y los botones **Explorar** y **La feria**.
- [ ] **Chips de categorías**: tocá "Libros" y los puntos de libros se ocultan. Tocalo de nuevo y vuelven.
- [ ] **Referencias** (abajo a la izquierda): muestra qué significa cada color e ícono. Tocar un ítem lo oculta del mapa.
- [ ] **Tocar un punto** abre su ficha: foto, categoría, descripción, **Cómo llegar** (abre Google Maps a pie) y **Compartir**.
- [ ] **Tocar una franja** (por ejemplo, la cuadra azul cerca de 18 de Julio) también abre su ficha.
- [ ] La URL cambia a `/?p=...`. Si abrís ese link en otra pestaña, el mapa abre directo en ese lugar con su ficha.
- [ ] **Explorar**: buscador sin importar tildes (probá "antiguedades") y lista agrupada por categoría.
- [ ] **La feria**: texto, horario y "Cómo llegar a la feria".
- [ ] **Mi ubicación** (botón redondo, abajo a la derecha): si estás en la feria, te centra con un punto azul. Si estás lejos, el mapa se abre para mostrarte a vos y a la feria, con la distancia y "Cómo llegar". "Ver la feria" vuelve al mapa normal.
- [ ] Los íconos crecen y se achican con el zoom y se mueven pegados al mapa.
- [ ] En el celular, la ficha se cierra deslizándola hacia abajo.
- [ ] No te podés alejar más allá de los límites del barrio (eso se configura en el Estudio).

---

## 4. Probar el Estudio (panel de la diseñadora)

Entrá a <http://localhost:3000/admin>. Si no hay sesión, te manda al login.

**La pantalla:**

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Estudio   [V Seleccionar][P Punto][C Pintar cuadra][L Franja][A Zona]    │
│           [T Texto] | [M Imán][Deshacer]          Guardado · Ver sitio   │
├───────────────┬──────────────────────────────────────────┬───────────────┤
│ Elementos     │                                          │  Inspector    │
│ Íconos        │               M A P A                    │  (lo que está │
│ Leyenda       │                                          │  seleccionado)│
│ Estilo        │                                          │               │
│ Feria         │                                          │               │
└───────────────┴──────────────────────────────────────────┴───────────────┘
```

### Atajos de teclado

| Tecla | Acción |
|---|---|
| `V` | Seleccionar / mover |
| `P` | Agregar punto (con `Shift` apretado seguís agregando) |
| `C` | Pintar cuadra (un clic pinta una cuadra entera) |
| `L` | Dibujar franja |
| `A` | Dibujar zona |
| `T` | Agregar texto |
| `M` | Prender o apagar el imán (pegar a las calles) |
| `Alt` mientras dibujás | Desactiva el imán por un momento |
| `Enter` / doble clic | Terminar la franja o zona |
| `Retroceso` mientras dibujás | Borrar el último vértice |
| `Supr` / `Retroceso` | Eliminar el elemento seleccionado |
| `Ctrl+Z` | Deshacer |
| `Esc` | Cancelar, o sacar la selección |
| Clic derecho en un vértice | Borrar ese vértice |

### Checklist de prueba

- [ ] **Login:** una contraseña incorrecta muestra error. Con 8 intentos fallidos se bloquea por 10 minutos.
- [ ] **Pintar cuadra:** apretá `C`, elegí "Frutas y verduras" en la barra de arriba y pasá el mouse por las calles: la cuadra se resalta. Con un clic queda pintada. Podés pintar varias seguidas.
- [ ] **Franja con imán:** apretá `L`, hacé clic sobre una calle y otro clic más adelante. Los vértices se pegan a la calle (aparece un círculo azul). Doble clic para terminar.
- [ ] **Editar forma:** con la franja seleccionada, arrastrá los puntos naranjas. Los puntitos del medio agregan vértices nuevos y el clic derecho borra uno.
- [ ] **Vereda:** en el Inspector, mové "Desplazar hacia una vereda" para pintar solo un lado de la calle.
- [ ] **Zona:** apretá `A`, marcá 3 o más vértices y cerrá haciendo clic en el primero o con `Enter`.
- [ ] **Punto:** apretá `P`, elegí el ícono en la barra de arriba y hacé clic en el mapa. Se abre el Inspector: poné título, descripción y una **foto**. Fijate en el aviso "Foto optimizada: X MB → Y KB".
- [ ] **Mover un punto:** arrastralo con la herramienta Seleccionar (`V`). Un clic sin arrastrar solo lo selecciona.
- [ ] **Texto:** apretá `T`, hacé clic y ajustá tamaño, rotación y colores.
- [ ] **Borrador:** apagá "Publicado" y el elemento desaparece del sitio público, pero en el Estudio queda semitransparente.
- [ ] **Deshacer:** borrá algo con `Supr` y usá el botón "Deshacer" del aviso o `Ctrl+Z`.
- [ ] **Íconos:** creá uno nuevo y subí un SVG o PNG haciendo clic en el círculo o arrastrando el archivo. Cambiale nombre, color y descripción, y reordenalo con las flechas.
- [ ] **Leyenda:** creá un significado nuevo y cambiale color, opacidad, grosor y trazo (continuo, guiones o puntos). Todas las franjas que lo usan cambian al instante.
- [ ] **Estilo:** probá los estilos rápidos (Papel, Claro, Noche, Tinta) y después ajustá cada color a mano.
- [ ] **Límite de la feria:** en Estilo, probá *Editar bordes* (arrastrar los puntos naranjas), *Redibujar*, ocultar la línea de borde y la opción *Sin límite*.
- [ ] **Vista inicial:** acomodá el mapa y tocá "Usar la vista actual". Así abre el mapa para el público.
- [ ] **Feria:** editá el título, el horario y el texto "Sobre la feria".
- [ ] **Ver sitio:** el sitio público refleja todo enseguida (refrescá la página).
- [ ] El indicador arriba a la derecha pasa de "Guardando…" a "Guardado". Si cerrás la pestaña con cambios pendientes, el navegador avisa.

---

## 5. Guía rápida para la diseñadora

Un flujo de trabajo recomendado:

1. **Leyenda primero.** Definí qué significan los colores: "Sector libros", "Usados", "Frutas y verduras", "Recorrido sugerido", "Zona de mayor concurrencia"… Elegí si cada uno es *franja* (sobre calles) o *zona* (área).
2. **Íconos.** Subí tus diseños para cada tipo de puesto o pique. Funcionan mejor sobre fondo transparente y con formas simples, porque se ven a unos 22 px dentro del marcador. Formatos: SVG, PNG, JPG o WebP. El color del aro del marcador sale del "Color del marcador" de cada ícono.
3. **Estilo del mapa base.** Partí de un estilo rápido y ajustá los colores de manzanas, calles, bordes y textos. "Tinta" sirve de punto de partida para algo bien gráfico, en blanco y negro.
4. **Límite de la feria.** En Estilo → *Límite de la feria* hay dos opciones: **Zona delimitada** (con *Editar bordes* arrastrás los vértices del contorno y con *Redibujar* lo hacés de cero; la línea de borde se puede ocultar) o **Sin límite**, donde la feria queda marcada solo por las calles pintadas.
5. **Pintar cuadras** con la herramienta `C`. Si necesitás solo un tramo, usá Franja (`L`) con el imán y un clic en cada extremo.
6. **Puntos y piques**, con foto y descripción.
7. Usá **Borrador** para trabajar tranquila y publicar cuando esté listo.

Para retoques de la interfaz pública (tipografías, colores de botones), los tokens de diseño están en `src/app/globals.css` (bloque `:root`). La forma del marcador (gota con aro de color) se dibuja en `src/components/map/pins.ts`, y su tamaño se ajusta desde Estilo → Marcadores. El color de acento de los botones se cambia desde Estilo → Marcadores.

---

## 6. Publicarlo en internet (gratis)

La combinación recomendada es **Vercel** (hosting de la app) más **Supabase** (base de datos y fotos). Las dos tienen capa gratuita y no piden tarjeta.

### 6.1 Supabase (base de datos y fotos)

1. Creá una cuenta en <https://supabase.com> → **New project**. Elegí la región **São Paulo (sa-east-1)**, que es la más cercana a Uruguay, y guardá la contraseña de la base.
2. En el proyecto, andá a **SQL Editor** → **New query**, pegá el contenido de [`supabase/schema.sql`](../supabase/schema.sql) y tocá **Run**. Eso crea las tablas, la seguridad (RLS) y el bucket `media` para las fotos.
3. En **Project Settings → API**, copiá:
   - **Project URL**, que va en `SUPABASE_URL`
   - **service_role key** (secreta, **nunca** va en el navegador), que va en `SUPABASE_SERVICE_ROLE_KEY`
4. La primera vez que la app se conecte va a cargar sola el contenido de ejemplo.

> **¿Y los límites gratis?** Los de Supabase Free (pueden cambiar; revisá la web de Supabase) son 500 MB de base de datos, 1 GB de archivos y sin límite de consultas a la API. Con fotos de unos 100–150 KB (más su miniatura) entran **entre 6.000 y 9.000 fotos**. La base casi no recibe consultas gracias al caché. El único detalle es que **Supabase pausa los proyectos gratis tras 7 días sin actividad**. Para evitarlo, el proyecto incluye un cron diario (`vercel.json`) que visita `/api/health` y mantiene el proyecto activo.

### 6.2 Vercel (la app)

1. Subí el proyecto a GitHub (repositorio privado o público).
2. En <https://vercel.com> → **Add New → Project**, importá el repo. Detecta Next.js solo.
3. En **Environment Variables**, cargá:

   | Variable | Valor |
   |---|---|
   | `ADMIN_USERNAME` | el usuario que elijan |
   | `ADMIN_PASSWORD` | una contraseña **larga** (por ejemplo, 4 palabras al azar) |
   | `SESSION_SECRET` | generalo con `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
   | `DATA_DRIVER` | `supabase` |
   | `SUPABASE_URL` | la Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | la service_role key |
   | `SUPABASE_BUCKET` | `media` |
   | `NEXT_PUBLIC_SITE_URL` | `https://tu-dominio` (o la URL `.vercel.app`) |

4. Tocá **Deploy**. Listo: `https://tu-proyecto.vercel.app` es el sitio público y `/admin` el Estudio.
5. **Dominio propio** (opcional): en Vercel → Settings → Domains.

> Si cambiás variables de entorno, hacé **Redeploy** para que tomen efecto.

### 6.3 Alternativa: servidor propio

Si en algún momento prefieren no depender de servicios externos, la app corre en cualquier VPS con Node 20.9 o más nuevo y `DATA_DRIVER=local`: `npm ci && npm run build && npm start`, detrás de Nginx o Caddy con HTTPS. Respaldá la carpeta `data/` (base y fotos) con regularidad.

---

## 7. Fase 2: login con Google y comentarios

La idea es que cualquiera pueda entrar con su cuenta de Google y comentar u opinar sobre cada puesto. Lo que ya está preparado:

- La tabla `comments` con sus reglas de seguridad está en `supabase/schema.sql`. Solo usuarios con sesión pueden comentar, cada uno borra lo suyo y se puede ocultar un comentario sin borrarlo.
- La ficha de cada lugar (`DetailPanel` en `src/components/public/Panels.tsx`) es donde se van a sumar los comentarios.

### Lo que necesito de vos

No es una "API key" de Google sino un **cliente OAuth** (un *Client ID* y un *Client Secret*). Se configura en Supabase, no en el código. Pasos:

1. Entrá a <https://console.cloud.google.com> y creá un proyecto (por ejemplo, "Mapa Tristán Narvaja").
2. **APIs & Services → OAuth consent screen**:
   - User type: **External**
   - Nombre de la app, email de soporte y logo (opcional)
   - Scopes: solo `email`, `profile` y `openid` (no requieren verificación de Google)
   - Publicá la app (**Publish app**) para que pueda entrar cualquier persona, no solo usuarios de prueba.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - **Authorized JavaScript origins**: `https://tu-dominio` y `http://localhost:3000`
   - **Authorized redirect URIs**: `https://<tu-proyecto>.supabase.co/auth/v1/callback`. La URL exacta aparece en Supabase → Authentication → Providers → Google.
4. Copiá el **Client ID** y el **Client Secret**.
5. En **Supabase → Authentication → Providers → Google**, activalo y pegá los dos valores.
6. En **Supabase → Authentication → URL Configuration**, poné como *Site URL* tu dominio y agregá `http://localhost:3000/**` en *Redirect URLs*.
7. Pasame (o cargá en Vercel) dos variables públicas nuevas: `NEXT_PUBLIC_SUPABASE_URL` (la misma Project URL) y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (la clave *anon public* de Project Settings → API).

Con eso se implementa: botón "Entrar con Google", comentarios en la ficha de cada lugar, contador de comentarios en el mapa y moderación desde el Estudio (ocultar o mostrar). Hasta que se active, el sitio sigue siendo solo de consulta.

---

## 8. Arquitectura y carpetas

```
src/
  app/
    page.tsx                 Sitio público (renderiza con el snapshot cacheado)
    admin/page.tsx           Estudio (exige sesión; si no, redirige al login)
    admin/login/page.tsx     Login
    api/map/                 GET  snapshot público en JSON
    api/health/              GET  chequeo de salud (y "despertador" de Supabase)
    api/admin/login|logout   Sesión (cookie httpOnly firmada, 7 días)
    api/admin/data           GET  todo el contenido, incluidos borradores
    api/admin/collections/[collection]          PUT  crear o actualizar (categories | legend | features)
    api/admin/collections/[collection]/[id]     DELETE
    api/admin/collections/[collection]/reorder  POST orden
    api/admin/settings       PUT  ajustes y estilo
    api/admin/upload         POST imágenes (valida tipo real y tamaño)
    uploads/[...path]        Sirve las fotos en modo local
  components/
    map/                     Compartido público + Estudio
      baseStyle.ts           Estilo del mapa base, a partir de los tokens del tema
      overlays.ts            Capas propias: zona feria, zonas, franjas, textos
      pins.ts                Imágenes de los pines (dibujados por el motor del mapa, escalan con el zoom)
      userLocation.ts        Punto azul de "Mi ubicación"
      createMap.ts           Crea el mapa con los controles
    public/                  Sitio público (PublicApp, paneles, referencias)
    admin/                   Estudio
      Editor.tsx             Pantalla principal, herramientas y atajos
      drawing.ts             Motor de dibujo: herramientas, imán, edición de vértices
      useEditorData.ts       Estado, guardado automático y deshacer
      Inspector.tsx          Edición del elemento seleccionado
      SidePanels.tsx         Elementos, Íconos, Leyenda, Estilo, Feria
  lib/
    schemas.ts               Modelo de datos (zod): única fuente de verdad
    defaults.ts              Contenido inicial y estilos rápidos
    store/                   Persistencia: local.ts | supabase.ts (misma interfaz)
    snapshot.ts              Caché del contenido público + invalidación
    auth.ts                  Login, sesión y límite de intentos
    image.ts                 Compresión de fotos y rasterizado de íconos
public/
  data/cuadras.geojson       Cuadras de la zona (OSM), para pintar y para el imán
  icons/                     Íconos por defecto
supabase/schema.sql          Tablas, seguridad y bucket (+ comentarios, fase 2)
scripts/fetch-streets.mjs    Regenera las cuadras desde OpenStreetMap
```

**Seguridad, en resumen:**

- La contraseña del Estudio vive solo en variables de entorno y se compara en tiempo constante. El login tiene límite de intentos.
- La sesión es un JWT firmado en una cookie `httpOnly`, `SameSite=Lax` y `Secure` en producción.
- Todas las rutas del admin verifican la sesión y el origen de la petición (defensa CSRF).
- Todo lo que entra se valida con esquemas zod en el servidor.
- Las subidas se validan por *magic bytes*, con tamaño máximo y nombre aleatorio. Las rutas de archivos están protegidas contra *path traversal*.
- La service role key de Supabase solo se usa en el servidor. En la base hay RLS: el público solo puede leer lo publicado.

---

## 9. Tareas de mantenimiento

- **Cambiar la contraseña del Estudio:** cambiá `ADMIN_PASSWORD` (en `.env.local` o en Vercel y después Redeploy). Para cerrar todas las sesiones abiertas, cambiá también `SESSION_SECRET`.
- **Actualizar las calles** (si OpenStreetMap cambia o querés ampliar la zona): ajustá `BBOX` en `scripts/fetch-streets.mjs` y corré `npm run streets`.
- **Respaldo:** en modo local, copiá la carpeta `data/`. En Supabase, el plan gratis no tiene backups automáticos: exportá de vez en cuando desde *Database → Backups* o con `pg_dump`. También podés guardar la respuesta de `GET /api/map` como copia simple.

---

## 10. Próximos pasos sugeridos

1. **Fase 2: comentarios con Google** (sección 7).
2. **Teselas propias (PMTiles):** generar un archivo con solo Montevideo (unos 20 MB) y servirlo desde el propio sitio. Así se elimina la última dependencia externa y el mapa queda 100% bajo control.
3. **Modo sin conexión (PWA):** la feria tiene mucha gente y a veces la señal falla. Se puede cachear el mapa de la zona para que funcione sin datos.
4. **Varias personas en el Estudio:** usuarios individuales en vez de uno compartido, con historial de quién cambió qué.
5. **Capas por temporada o evento:** por ejemplo, "Feria de Navidad" o cortes de calle.
6. **Mover elementos completos** (franjas y zonas enteras) y **duplicar**, además de editar vértices.
7. **Estadísticas anónimas** (Plausible o Umami, que no usan cookies) para saber qué puestos se consultan más.
8. **Versión en inglés y portugués** para turistas.

---

## 11. Problemas comunes

| Problema | Solución |
|---|---|
| El mapa sale en blanco | Revisá la conexión (las teselas vienen de `tiles.openfreemap.org`) y que exista `public/vendor/maplibre-gl-worker.mjs`. Si falta, corré `npm install` (lo copia el `postinstall`). |
| "Sesión vencida" en el Estudio | La sesión dura 7 días. Volvé a ingresar. |
| "No se pudo guardar: …" | El mensaje dice qué campo está mal (por ejemplo, un título vacío). Corregilo y se guarda solo. |
| Los cambios no aparecen en el sitio público | Refrescá la página. Si usás Supabase, revisá en Vercel → Logs que no haya errores de conexión. |
| La foto no sube | El máximo después de comprimir es 600 KB (el panel comprime solo, así que normalmente no se llega). Si es un formato raro (HEIC de iPhone), exportala como JPG primero. |
| Todo anda lento en Windows | Ver la nota sobre OneDrive en la sección 2. |
| En `npm run dev` el mapa se ve con colores o posiciones raras | Caché vieja de desarrollo: pará el servidor, borrá la carpeta `.next` y volvé a levantar. |
| Quiero empezar de cero (local) | Pará el servidor, borrá la carpeta `data/` y volvé a levantar. |
