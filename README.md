# Querétaro Romance AI (PoC)

Prueba de concepto para la Secretaría de Turismo del Estado de Querétaro: un quiz tipo swipe
genera, con un modelo de lenguaje, un concepto de boda personalizado con paleta de color,
narrativa, recintos recomendados de Querétaro, un moodboard descargable (PNG 1200×630) y un
reel vertical (9:16) reproducible en el navegador.

- Especificación de producto: [`specs/PRD.md`](specs/PRD.md)
- Diseño técnico: [`specs/TDD.md`](specs/TDD.md)
- Sistema de diseño y mockups: [`design/`](design/)

## Arquitectura

1. El usuario responde el quiz (`/`, `src/components/quiz`) y el cliente llama a
   `POST /api/generate-experience` (`src/app/api/generate-experience/route.ts`) con sus
   respuestas.
2. El servicio de experiencia (`src/domain/experience/service.ts`) pide a OpenRouter un JSON
   estructurado, primero al modelo primario (Qwen) y, si falla o no cumple el schema, a un
   modelo de respaldo (DeepSeek). Si ambos fallan, usa un generador local determinista
   (`src/domain/experience/fallback.ts`) para que la demo nunca se quede sin resultado.
3. Las fotos del resultado vienen de Unsplash (`src/domain/images/unsplash.ts`) cuando hay una
   API key configurada; si no, de un set curado de fotos estáticas
   (`src/domain/images/static-fallback.ts`).
4. `/resultados` (`src/components/results`) muestra el concepto, la paleta, el moodboard y el
   reel. El moodboard se renderiza como imagen en `GET /api/og/moodboard`
   (`src/app/api/og/moodboard/route.tsx`, Satori sobre el runtime de Node). El reel se reproduce
   con `@remotion/player` (`src/remotion`) directamente en el navegador — no hay renderizado de
   video en el servidor.

## Desarrollo local

**Requisitos:** [Docker](https://www.docker.com/) y [kool](https://kool.dev/).

```bash
kool run setup    # copia .env.dist -> .env, instala git hooks, levanta el contenedor e instala dependencias
kool run dev       # arranca `next dev` dentro del contenedor, expuesto en http://localhost:3000
kool run test      # vitest (proyectos "node" y "jsdom"), 100% offline
kool run quality   # format:check + types:check + lint:check
kool run build     # next build
```

Todas las herramientas de Node corren dentro de Docker; no se debe ejecutar `yarn`/`npx`/`tsc`
directamente en el host.

`kool run test` es completamente **offline**: toda llamada externa (OpenRouter, Unsplash) está
mockeada en los tests. La única excepción es un chequeo opt-in que valida en vivo que las URLs de
Unsplash del catálogo de fotos sigan respondiendo 200:

```bash
PHOTO_URL_CHECK=1 docker compose run --rm --no-deps -T app yarn test src/domain/media
```

## Variables de entorno

Definidas en [`.env.dist`](.env.dist); copia ese archivo a `.env` y completa lo que necesites.

| Variable                    | Requerida | Qué pasa si falta                                                                              |
| --------------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| `OPENROUTER_API_KEY`        | No        | Se usa el fallback local determinista en vez de un modelo real (ver `meta.fallbackUsed`).      |
| `OPENROUTER_MODEL_PRIMARY`  | No        | Usa el default `qwen/qwen-2.5-72b-instruct`.                                                   |
| `OPENROUTER_MODEL_FALLBACK` | No        | Usa el default `deepseek/deepseek-chat`.                                                       |
| `OPENROUTER_TIMEOUT_MS`     | No        | Usa el default `8000` (ms) antes de pasar al modelo de respaldo o al fallback local.           |
| `UNSPLASH_ACCESS_KEY`       | No        | Se usan las fotos estáticas curadas en `src/domain/images/static-fallback.ts`.                 |
| `GOOGLE_PLACES_API_KEY`     | No        | `kool run kb:ingest` no corre y `GET /api/places/photo` responde 404 `places_disabled`.        |
| `PLACES_PHOTO_CACHE_DIR`    | No        | Usa el default `.cache/places` (ruta relativa a la raíz del repo, ignorada por git).           |
| `APP_URL`                   | No        | Usa el default `http://localhost:3000` (header `HTTP-Referer` de OpenRouter y URLs absolutas). |
| `APP_PORT`                  | No        | Usa el default `3000` como puerto publicado por `docker-compose`.                              |

## Base de conocimiento

Las bodas reales de Querétaro (zonas, experiencias y recintos) viven en `data/kb/*.json`,
validadas por `src/domain/kb/`. Los recintos se alimentan de dos fuentes:

1. **Curados a mano** (`source: "curated"`, `confidence: 1`): los 12 recintos originales, con
   `oneLiner`/`whyWeddings`/`highlights` escritos a mano.
2. **Google Places (New)** (`source: "places"`, `confidence: 0.4` hasta que el paso de
   enriquecimiento los complete): resultados de búsqueda de texto por zona × categoría de boda.

El refresco completo de la base de conocimiento es una secuencia de tres pasos:

```bash
kool run kb:ingest   # Google Places (New) -> data/kb/places.raw.json (snapshot committeado)
kool run kb:build     # places.raw.json + venues.json actual -> data/kb/venues.json regenerado
kool run kb:enrich    # OpenRouter (Qwen/DeepSeek) -> clasifica y escribe copy es-MX en venues.json
```

`kb:ingest` requiere `GOOGLE_PLACES_API_KEY` (con **Places API (New)** habilitada y facturación
activa en el proyecto de Google Cloud) y llama a `places:searchText` por cada una de las 10 zonas
× 6 categorías de boda (hasta 2 páginas cada una, limitado a ~5 solicitudes/segundo, con
reintento en 429/5xx). Text Search (Pro) tiene un nivel gratuito de 5,000 llamadas/mes, así que
una actualización completa (~60-120 llamadas) no genera costo. Sin la API key, la app funciona
igual sobre la base de conocimiento ya committeada. `GET /api/places/photo` sirve las fotos de
Places con cache en disco de 30 días (`PLACES_PHOTO_CACHE_DIR`).

`kb:enrich` requiere `OPENROUTER_API_KEY` y clasifica, en lotes de 8 recintos por llamada
estructurada, cada recinto proveniente de Places con `confidence < 0.9` (o sin `whyWeddings`):
asigna facetas (`styles`, `settings`, `scale`, `experiences`, `budget`), estima capacidad, escribe
`oneLiner`/`whyWeddings`/`highlights` en español latinoamericano y marca `isWeddingVenue: false`
para lugares que no pueden albergar una boda (se eliminan de `venues.json`, igual que los de
`confidence < 0.5`). Los recintos curados se omiten salvo `--all`, y solo ganan los campos que
tuvieran vacíos. Es idempotente — una segunda corrida solo reprocesa lo que siga por debajo del
umbral — y reporta tokens y costo estimado (`src/domain/ai/pricing.ts`) por modelo usado. Si el
modelo primario configurado es lento/inestable para el tamaño de lote completo, `--batch-size=<n>`
reduce el lote (p. ej. `kool exec app yarn kb:enrich --batch-size=2`).

## Assets que debes agregar

Estos archivos no se versionan en git y deben agregarse manualmente antes de un despliegue real:

- **`public/audio/wedding-theme.mp3`** — pista de audio de fondo del reel, royalty-free, de al
  menos 12 segundos (ver `public/audio/README.md` para la guía de tono — "Son Huapango
  Queretano" / cuerdas clásicas — y la nota de licencia que debe acompañarla). Mientras no
  exista, el reel se reproduce sin sonido y el chip de pista muestra "Sin audio".
- **`public/brand/logo.svg`** y **`public/brand/logo-mark.svg`** — son placeholders; deben
  reemplazarse por el logotipo oficial de Querétaro Romance AI / SECTUR (el segundo es solo el
  isotipo, usado en el header a partir de 360px de ancho).
- Las fuentes (`Playfair Display`, `Plus Jakarta Sans`) ya están incluidas en
  `public/fonts/` bajo la licencia SIL Open Font License 1.1 (ver `public/fonts/README.md`); no
  requieren acción.

## Métricas de la PoC

Cada resultado generado muestra, en el footer de `/resultados` (`MetaFooter`,
`src/components/results/MetaFooter.tsx`): el modelo que respondió (o si se usó el fallback
local), la duración de la generación en milisegundos y, cuando el proveedor la reporta, la suma
de tokens de prompt + completion.

## Despliegue en Vercel (Hobby)

1. Importa este repositorio de GitHub en Vercel.
2. Configura las variables de entorno de la tabla anterior en el proyecto de Vercel (al menos
   `OPENROUTER_API_KEY` y `UNSPLASH_ACCESS_KEY` si quieres generación real en vez de los
   fallbacks).
3. `GET /api/og/moodboard` corre en el runtime de Node (`export const runtime = "nodejs"`) y lee
   fuentes desde `public/fonts/`; no es compatible con el runtime Edge.
4. No hay renderizado de video en el servidor: el reel se reproduce íntegramente en el cliente
   con `@remotion/player`.

## Estructura del proyecto

```
src/
  app/              # Rutas de Next.js (App Router): quiz, resultados, recintos, API routes
  domain/           # Lógica de negocio pura: quiz, experience, venues, media, moodboard, ai, images
  components/        # Componentes React: shell, ui, quiz, results, reel
  remotion/          # Composición del reel (Remotion Player)
  lib/               # Cliente de API, store de resultados, env, utilidades
test/                # Setup de Vitest y stubs compartidos
```

## Flujo de trabajo

Este repositorio se desarrolla en PRs apiladas (`poc/*`, una capa por PR, con `gh-stack`), usando
conventional commits. Antes de subir cualquier cambio: `kool run quality` (y, si toca código,
`kool run test`) deben pasar en verde.

## Próxima iteración

- Reel narrado con voz generada (TTS, p. ej. ElevenLabs) está planeado como un stack separado,
  fuera del alcance de esta PoC.
