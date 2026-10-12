# Querétaro Romance

Prueba de concepto para la Secretaría de Turismo del Estado de Querétaro: en vez de un quiz fijo
de 4 preguntas, una **conversación adaptativa** de 5 a 7 pasos — anclada en una **base de
conocimiento real** de recintos, zonas y experiencias de Querétaro (ratings y fotos reales de
Google Places, no texto inventado) — termina en un concepto de boda personalizado: paleta de
color, narrativa, recintos recomendados con liga a su sitio/Google Maps, un itinerario de fin de
semana, un moodboard descargable (PNG 1200×630) y un reel vertical (9:16) reproducible en el
navegador.

- Especificación de producto: [`specs/PRD.md`](specs/PRD.md)
- Diseño técnico: [`specs/TDD.md`](specs/TDD.md)
- Sistema de diseño y mockups: [`design/`](design/)
- Benchmark de modelos (motor del quiz y ruteo de proveedores): [`docs/ai-step-benchmark.md`](docs/ai-step-benchmark.md)
- Guion de demo con dos conversaciones reales grabadas: [`docs/demo-script.md`](docs/demo-script.md)

## Arquitectura

```
                      ┌─────────────────────────────────────────────┐
  Google Places  ───▶ │ kb:ingest → kb:build → kb:enrich             │ ───▶ data/kb/*.json
  (New) API           │ (ingesta, mapeo a facets, copy es-MX + LLM)  │      (zonas, recintos,
                      └─────────────────────────────────────────────┘       experiencias)
                                                                                   │
                                                                                   ▼
  Pareja responde   ┌──────────────────────────────┐   POST /api/quiz/next   ┌─────────────────┐
  una opción    ───▶│ Transcript (facets conocidos) │ ───────────────────▶   │  Quiz engine     │
  (swipe/tap)        └──────────────────────────────┘                        │  (motor fast-LLM  │
                             ▲                                               │  + digest de KB)  │
                             │   POST /api/quiz/prefetch (fire-and-forget,   └─────────────────┘
                             │   calienta cada opción visible en paralelo)           │
                             └────────────────────────────────────────────────────────┘
                                                                                   │ transcript completo
                                                                                   ▼
                                                                   POST /api/generate-experience
                                                                   (modelo primario/fallback + digest
                                                                    de KB → concepto, paleta, recintos
                                                                    reales, itinerario)
                                                                                   │
                                                                                   ▼
                                                        /resultados (moodboard PNG + reel 9:16)
```

1. **Base de conocimiento** (`data/kb/*.json`, validada por `src/domain/kb/`): zonas (las 10
   zonas turísticas de Querétaro), recintos y experiencias reales, cada uno con facets cerrados
   (`style`, `setting`, `scale`, `zone`, `experience`, `budget`, `lodging`, `season` —
   `src/domain/kb/taxonomy.ts`). Se construye con tres scripts (`kb:ingest` → `kb:build` →
   `kb:enrich`, ver más abajo) y se consulta en runtime vía `src/domain/kb/digest.ts` (un resumen
   acotado en tokens, solo los recintos/experiencias relevantes a los facets ya conocidos de la
   pareja).
2. **Motor de quiz adaptativo** (`src/domain/quiz/engine.ts`, expuesto por
   `POST /api/quiz/next`): dado el transcript de la conversación hasta ahora, decide si ya sabe
   suficiente (`done: true`, nunca antes de 5 respuestas, siempre al llegar a `QUIZ_MAX_STEPS`) o
   genera el siguiente paso — una pregunta y 3-4 opciones contrastantes, cada una anclada en ids
   reales de la base de conocimiento (`refs.venueIds`/`refs.experienceIds`) — con un modelo rápido
   (`OPENROUTER_MODEL_FAST`). Nunca falla visiblemente: cualquier error de red, timeout o
   respuesta que no pase validación cae a una de las 4 preguntas curadas estáticas
   (`src/domain/quiz/questions.ts`) o, si ya se agotaron, a `done: true`. El primer paso siempre
   es curado (instantáneo, sin esperar a ningún modelo).
3. **Prefetch especulativo** (`POST /api/quiz/prefetch`, `src/domain/quiz/prefetch.ts`): mientras
   la pareja mira las opciones del paso actual, el cliente dispara una sola llamada que calienta,
   en paralelo, el paso que resultaría de elegir _cada_ opción visible — así la opción que
   realmente elijan casi siempre ya está en caché. La ruta responde de inmediato
   (`{ scheduled: n }`, fire-and-forget) sin esperar a que esas generaciones terminen; el trabajo
   sigue en segundo plano (hasta `QUIZ_PREFETCH_BUDGET_MS`) y cachea su resultado igual.
4. **Generación final** (`src/domain/experience/service.ts`, `POST /api/generate-experience`):
   toma el transcript completo, pide a OpenRouter (modelo primario, con reintento de corrección y
   modelo de respaldo — `src/domain/ai/structured.ts`) un JSON estructurado que referencia recintos
   reales por id (`recommendedVenues[].venueId`), y lo resuelve contra la base de conocimiento
   (`assembleVenuesFromKb`) para adjuntar foto/rating/liga reales. Si el LLM falla o no está
   configurado, cae a un generador local determinista (`src/domain/experience/fallback.ts`) para
   que la demo nunca se quede sin resultado.
5. Las fotos salen, en este orden de preferencia: foto real de Google Places del recinto
   (proxied vía `GET /api/places/photo`, cacheada en disco) → Unsplash (si hay API key) → un set
   curado de fotos estáticas (`src/domain/images/static-fallback.ts`).
6. `/resultados` (`src/components/results`) muestra el concepto, la paleta, los recintos reales y
   el itinerario, el moodboard (`GET /api/og/moodboard`, Satori sobre runtime de Node) y el reel
   (`@remotion/player`, 100% en el navegador — no hay renderizado de video en el servidor).
7. `/recintos` (`CatalogScreen`) lista el catálogo completo de la base de conocimiento —
   independiente del quiz — filtrable por cualquiera de las 10 zonas.

## Navegación del quiz

Cada paso muestra sus 3-4 opciones en un **carrusel horizontal nativo** (`OptionCarousel`,
`overflow-x-auto snap-x snap-mandatory`, sin `framer-motion drag`): scroll con el dedo, el
trackpad o las flechas del teclado centra la siguiente tarjeta (`useActiveSlide`, un
`IntersectionObserver`), y los puntos (`DeckDots`) y la lista de opciones debajo
(`OptionList`, "Opciones de esta pregunta") hacen `scrollIntoView` a la misma tarjeta — nunca
avanzan el quiz por sí solos. Deslizar solo **ve** las opciones; la única forma de avanzar es
tocar el botón primario **"Elegir"** dentro de cada tarjeta (tocar la foto no hace nada, para
que deslizar sin querer nunca elija nada). Un texto bajo el carrusel lo deja explícito:
"Desliza para ver las {n} opciones · toca Elegir para continuar".

**Volver:** un único botón con ícono y texto, "Pregunta anterior" (visible desde el paso 2), bajo
la barra de progreso — también responde a Backspace. No hay botones circulares ni iconos sueltos
para retroceder.

**Sin barra inferior:** se eliminó el `BottomNav`; la navegación entre el quiz y el catálogo vive
en el header (`AppHeader`/`HeaderNavLink`) como un link de texto — "Recintos" en el quiz, "Quiz"
en `/recintos`.

## Desarrollo local

**Requisitos:** [Docker](https://www.docker.com/) y [kool](https://kool.dev/).

```bash
kool run setup    # copia .env.dist -> .env, instala git hooks, levanta el contenedor e instala dependencias
kool run setup:full   # lo mismo + kb:refresh (ingesta Places → build → enriquecimiento). Requiere GOOGLE_PLACES_API_KEY y OPENROUTER_API_KEY en .env
kool run kb:refresh   # solo la base de conocimiento: kb:ingest → kb:build → kb:enrich (incremental: solo enriquece lugares nuevos)
kool run dev       # arranca `next dev` dentro del contenedor, expuesto en http://localhost:3000
kool run test      # vitest (proyectos "node" y "jsdom"), 100% offline
kool run quality   # format:check + types:check + lint:check
kool run build     # next build
```

Todas las herramientas de Node corren dentro de Docker; no se debe ejecutar `yarn`/`npx`/`tsc`
directamente en el host.

`kool run test` es completamente **offline**: toda llamada externa (OpenRouter, Unsplash, Google
Places) está mockeada con MSW. La única excepción es un chequeo opt-in que valida en vivo que las
URLs de Unsplash del catálogo de fotos sigan respondiendo 200:

```bash
PHOTO_URL_CHECK=1 docker compose run --rm --no-deps -T app yarn test src/domain/media
```

### Scripts

| Script               | Qué hace                                                                                                                                                                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kool run dev`       | `next dev` dentro del contenedor.                                                                                                                                                                                                                                                                                                             |
| `kool run build`     | `next build` (producción).                                                                                                                                                                                                                                                                                                                    |
| `kool run test`      | `vitest run`, offline.                                                                                                                                                                                                                                                                                                                        |
| `kool run quality`   | `format:check` + `types:check` + `lint:check`.                                                                                                                                                                                                                                                                                                |
| `kool run kb:ingest` | Google Places (New) → `data/kb/places.raw.json` (snapshot committeado). Requiere `GOOGLE_PLACES_API_KEY`.                                                                                                                                                                                                                                     |
| `kool run kb:build`  | `places.raw.json` + `venues.json` actual → `data/kb/venues.json` regenerado (mapeo determinista, sin LLM).                                                                                                                                                                                                                                    |
| `kool run kb:enrich` | OpenRouter → clasifica facets y escribe copy es-MX en los recintos pendientes de `venues.json`. Requiere `OPENROUTER_API_KEY`.                                                                                                                                                                                                                |
| `kool run ai:bench`  | Benchmark real (p50/p95, % válido, % español, costo) de modelos candidatos para el paso del quiz — ver [`docs/ai-step-benchmark.md`](docs/ai-step-benchmark.md). Con `--providers=A,B,C` corre en cambio un benchmark más chico de ruteo de proveedores (`provider: { order }`) y _agrega_ una sección al mismo doc en vez de sobrescribirlo. |

## Variables de entorno

Definidas en [`.env.dist`](.env.dist); copia ese archivo a `.env` y completa lo que necesites.

| Variable                         | Requerida | Qué pasa si falta                                                                                                                                                                                                                                                               |
| -------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPENROUTER_API_KEY`             | No        | Todo el quiz y la generación final corren sobre fallbacks locales deterministas (ver `meta.fallbackUsed`/`meta.source`).                                                                                                                                                        |
| `OPENROUTER_MODEL_PRIMARY`       | No        | Default `qwen/qwen3-30b-a3b` (generación final).                                                                                                                                                                                                                                |
| `OPENROUTER_MODEL_FALLBACK`      | No        | Default `qwen/qwen-2.5-7b-instruct` (generación final).                                                                                                                                                                                                                         |
| `OPENROUTER_TIMEOUT_MS`          | No        | Default `8000` ms antes de pasar al modelo de respaldo o al fallback local.                                                                                                                                                                                                     |
| `OPENROUTER_MODEL_FAST`          | No        | Default `qwen/qwen-2.5-7b-instruct` (motor del quiz, cada paso).                                                                                                                                                                                                                |
| `OPENROUTER_MODEL_FAST_FALLBACK` | No        | Default `qwen/qwen3-30b-a3b` (motor del quiz, cada paso).                                                                                                                                                                                                                       |
| `OPENROUTER_PROVIDER_ORDER`      | No        | Lista opcional separada por comas (p. ej. `Cerebras,Groq,SambaNova`) pasada como `provider: { order, allow_fallbacks: true }` en cada llamada a OpenRouter. Vacío/ausente deja el ruteo de proveedor en manos de OpenRouter (default actual — ver el benchmark de proveedores). |
| `QUIZ_MAX_STEPS`                 | No        | Default `7` — máximo de pasos adaptativos (incluyendo el curado del paso 1) antes de forzar `done: true`.                                                                                                                                                                       |
| `QUIZ_STEP_TIMEOUT_MS`           | No        | Default `6000` ms por llamada del motor del quiz.                                                                                                                                                                                                                               |
| `QUIZ_PREFETCH`                  | No        | Default `true` — `false` desactiva `POST /api/quiz/prefetch` (responde `{ scheduled: 0 }` sin llamar al motor).                                                                                                                                                                 |
| `QUIZ_PREFETCH_BUDGET_MS`        | No        | Default `12000` — presupuesto en segundo plano por opción calentada (no bloquea la respuesta HTTP, que siempre es inmediata).                                                                                                                                                   |
| `UNSPLASH_ACCESS_KEY`            | No        | Se usan las fotos estáticas curadas en `src/domain/images/static-fallback.ts`.                                                                                                                                                                                                  |
| `GOOGLE_PLACES_API_KEY`          | No        | `kool run kb:ingest` no corre y `GET /api/places/photo` responde 404 `places_disabled`; la app sigue funcionando sobre la base de conocimiento ya committeada.                                                                                                                  |
| `PLACES_PHOTO_CACHE_DIR`         | No        | Default `.cache/places` (ruta relativa a la raíz del repo, ignorada por git; cache de 30 días para fotos de Places).                                                                                                                                                            |
| `ELEVENLABS_API_KEY`             | No        | La narración del reel queda `"disabled"` — el reel se reproduce en silencio (ver [Narración del reel](#narración-del-reel)).                                                                                                                                                    |
| `ELEVENLABS_VOICE_ID`            | No        | Igual que sin `ELEVENLABS_API_KEY`: narración `"disabled"` hasta tener ambas.                                                                                                                                                                                                   |
| `ELEVENLABS_MODEL_ID`            | No        | Default `eleven_multilingual_v2`.                                                                                                                                                                                                                                               |
| `NARRATION_CACHE_DIR`            | No        | Default `.cache/narration` (ruta relativa a la raíz del repo, ignorada por git; cache permanente de mp3 + timings por hash).                                                                                                                                                    |
| `NEXT_PUBLIC_NARRATION_FIXTURE`  | No        | **Solo desarrollo.** `1` fuerza el reel narrado "listo" con un fixture local (ver [Narración del reel](#narración-del-reel)), sin llamar nunca a ElevenLabs. Nunca se activa en producción.                                                                                     |
| `APP_URL`                        | No        | Default `http://localhost:3000` (header `HTTP-Referer` de OpenRouter y URLs absolutas).                                                                                                                                                                                         |
| `APP_PORT`                       | No        | Default `3000`, puerto publicado por `docker-compose`.                                                                                                                                                                                                                          |

**Importante:** `GOOGLE_PLACES_API_KEY` necesita el producto **Places API (New)** habilitado (y
facturación activa) en el proyecto de Google Cloud — no el "Places API" clásico. Habilítalo en:

> `https://console.cloud.google.com/apis/library/places.googleapis.com` (selecciona tu proyecto →
> **Habilitar**)

## Base de conocimiento

Las bodas reales de Querétaro (zonas, experiencias y recintos) viven en `data/kb/*.json`,
validadas por `src/domain/kb/`. Los recintos se alimentan de dos fuentes:

1. **Curados a mano** (`source: "curated"`, `confidence: 1`): los 12 recintos originales, con
   `oneLiner`/`whyWeddings`/`highlights` escritos a mano. No tienen `rating`/`websiteUri` reales
   (nunca pasaron por Places) — `VenueCard` simplemente no muestra esos elementos cuando faltan.
2. **Google Places (New)** (`source: "places"`, `confidence: 0.4` hasta que el paso de
   enriquecimiento los complete): resultados de búsqueda de texto por zona × categoría de boda.

**Estado actual committeado:** los 9 recintos `source: "places"` que vienen en `data/kb/venues.json`
hoy son datos de **fixture** (`v_placesfixture*`, `placeId` falso, `websiteUri` en `example.com`,
rating inventado) — un snapshot determinista para que `kool run test`/la demo sin red funcionen,
no el resultado de un `kb:ingest` real. Si `GOOGLE_PLACES_API_KEY` apunta a un proyecto con
**Places API (New)** deshabilitada (el error exacto es `PERMISSION_DENIED` / `SERVICE_DISABLED` en
los logs de `GET /api/places/photo`), sus fotos fallan con 500 en vez de mostrar la foto real — es
justo el síntoma que motiva la nota de **Places API (New)** arriba. Corre `kool run kb:ingest` con
una key válida (API habilitada) para reemplazarlos por recintos reales con foto/rating/liga
verdaderos; los 12 recintos curados no se ven afectados.

El refresco completo de la base de conocimiento es una secuencia de tres pasos:

```bash
kool run kb:ingest   # Google Places (New) -> data/kb/places.raw.json (snapshot committeado)
kool run kb:build     # places.raw.json + venues.json actual -> data/kb/venues.json regenerado
kool run kb:enrich    # OpenRouter (Qwen/DeepSeek) -> clasifica y escribe copy es-MX en venues.json
```

`kb:ingest` requiere `GOOGLE_PLACES_API_KEY` (ver la nota de **Places API (New)** arriba) y llama
a `places:searchText` por cada una de las 10 zonas × 6 categorías de boda (hasta 2 páginas cada
una, limitado a ~5 solicitudes/segundo, con reintento en 429/5xx). Text Search (Pro) tiene un
nivel gratuito de 5,000 llamadas/mes, así que una actualización completa (~60-120 llamadas) no
genera costo. Sin la API key, la app funciona igual sobre la base de conocimiento ya committeada.
`GET /api/places/photo` sirve las fotos de Places con cache en disco de 30 días
(`PLACES_PHOTO_CACHE_DIR`).

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

## Narración del reel

El reel se narra con una voz femenina de acento mexicano (ElevenLabs, modelo multilingüe) que lee
`reelScript` — un guion de 2-3 oraciones en es-MX, ya incluido en todo `ExperienceResult`
(generado por el modelo o, sin `OPENROUTER_API_KEY`, compuesto de forma determinista a partir del
concepto y el recinto principal). El audio se produce y sirve como se describe abajo, y la
composición de Remotion (`src/remotion/Reel.tsx`) lo reproduce con subtítulos sincronizados.

**Configuración:**

1. Abre la [Voice Library de ElevenLabs](https://elevenlabs.io/app/voice-library), filtra por
   idioma español (México) y voz femenina, y elige una. Copia su **Voice ID** (botón "Use" o los
   tres puntos → "Copy Voice ID").
2. En `.env`: `ELEVENLABS_API_KEY=<tu api key>` y `ELEVENLABS_VOICE_ID=<el id copiado>`.
   `ELEVENLABS_MODEL_ID` ya tiene el default correcto (`eleven_multilingual_v2`).
3. Sin ambas variables, `src/lib/narration-deps.ts` nunca construye el proveedor y
   `narration.ensure(...)` siempre resuelve `"disabled"` — el reel se reproduce en silencio, sin
   llamar nunca a ElevenLabs.

**Flujo:** `ExperienceService.generate` llama a `narration.ensure(reelScript, { budgetMs: 8000 })`
en paralelo con la resolución de fotos. Un hit de cache (`sha256(voiceId + modelId + reelScript)`,
ver `narrationHash`) resuelve `"ready"` sin red; si no, la síntesis arranca y se espera hasta 8 s —
lista a tiempo, resuelve `"ready"`; si no, sigue en segundo plano (mismo patrón fire-and-forget que
`src/domain/quiz/prefetch.ts`) y el resultado queda `"pending"`. El cliente (`useNarration`, usado
por `ResultsScreen`) sondea `GET /api/narration/<hash>/meta` cada 2 s hasta 60 s mientras esté
pendiente, y al quedar lista actualiza el resultado guardado (`saveResult`) con el ref final.

**Cache en disco** (`NARRATION_CACHE_DIR`, default `.cache/narration`, ignorado por git):

```
<hash>.mp3       # audio/mpeg
<hash>.json      # { script, voiceId, modelId, durationSec, sentences, createdAt }
<hash>.pending   # marcador mientras la síntesis está en curso (borrado al terminar o fallar)
```

`GET /api/narration/<hash>` sirve el mp3 con `Cache-Control: public, max-age=31536000, immutable`
y soporta `Range` (para que `<audio>`/el player de Remotion puedan buscar); `GET
/api/narration/<hash>/meta` expone `{ status, durationSec?, sentences? }` para el sondeo del
cliente.

**Costo:** cada guion son ~300 caracteres; con el plan Starter de ElevenLabs (~30,000
caracteres/mes) eso cubre ~100 reels/mes — el mismo orden de magnitud que la estimación de
`docs/ai-step-benchmark.md` para la generación de texto.

**En el reproductor (`ReelCard`/`ReelPlayer`):** mientras `narration.status === "pending"`, la
tarjeta muestra el póster estático con el pill "Preparando narración…" y el botón de play
deshabilitado — no renderiza el player interactivo todavía. `useNarration` (invocado desde
`ResultsScreen`) sondea `GET /api/narration/<hash>/meta` cada 2 s y, al quedar lista, actualiza el
resultado guardado; la tarjeta re-renderiza entonces con el player real. Una vez `"ready"`:

- La composición reproduce `<Audio src={narration.src} />` desde el frame 0 y agacha
  (`"duck"`) el volumen de la música de fondo a `0.12` mientras la narración habla, para volver a
  `0.8` (su volumen normal) un segundo después de que termina — `narrationMusicVolume` en
  `Reel.tsx` es la función pura que calcula esto, cubierta por tests.
- Los subtítulos (`Caption`) muestran una oración de `narration.sentences` a la vez, con fade
  in/out de 8 frames en sus límites `startSec`/`endSec` (`activeSentence`, también pura/testeada);
  sustituyen a las líneas narrativas estáticas del reel silencioso.
- La duración total del reel deja de ser fija (11 s): `reelDurationInFrames({ narrationDurationSec, photoCount })`
  la estira a `max(11s, narrationDurationSec + 1.5s)` y las escenas de fotos
  (`sceneWindows`) se reparten de forma pareja a lo largo de esa duración, con el mismo
  crossfade de siempre entre escenas consecutivas.
- El chip de pista en la cromática del player (`ReelBottomScrim`) cambia de la pista de música a
  "Narración · Querétaro Romance"; la tarjeta de resultados muestra la duración real en segundos
  ("`{n} seg`"), no siempre "11 seg".

**Browser-check sin `ELEVENLABS_API_KEY`:** con `NEXT_PUBLIC_NARRATION_FIXTURE=1` en `.env`
(dev-only, nunca en producción — ver la tabla de variables de entorno),
`useNarration` ignora el sondeo real y siempre devuelve un `NarrationRef` `"ready"` construido a
partir de `test/fixtures/narration/sample.json` (oraciones + duración) con un WAV silencioso
generado al vuelo (`src/lib/narration-fixture.ts`, sin binarios en el repo) como `src` — así se
puede ver el estado narrado completo (subtítulos, pill, duración) sin red ni cuenta de
ElevenLabs. Reinicia `next dev` tras cambiar la variable.

## Rendimiento y costo

Benchmark completo, metodología y decisión de modelos en
[`docs/ai-step-benchmark.md`](docs/ai-step-benchmark.md). Resumen:

- **Motor del quiz** (`OPENROUTER_MODEL_FAST=qwen/qwen-2.5-7b-instruct`, respaldo
  `qwen/qwen3-30b-a3b`): p50 ≈ 4.3s en frío, 100% válido/español en el benchmark, ~$0.0004/paso.
  Ningún modelo candidato (14 probados, incluidos los disponibles vía Cerebras/Groq/SambaNova)
  bajó de ~4s de forma confiable — es un límite de la capa de generación estructurada sobre
  modelos 7B-30B en OpenRouter, no de este prompt. Por eso el **prefetch especulativo** (punto 3
  de la arquitectura) es la estrategia real contra la latencia: calienta en paralelo la opción que
  la pareja termine eligiendo mientras la está leyendo, así que en una conversación real (con
  tiempo de lectura ≥ a la generación) la mayoría de los pasos después del primero resuelven casi
  instantáneo (cache hit) en vez de los ~4-9s de una generación en frío.
- **Generación final** (`OPENROUTER_MODEL_PRIMARY=qwen/qwen3-30b-a3b`, respaldo
  `qwen/qwen-2.5-7b-instruct`): ~3.5-4s, ~3,400 tokens de prompt (digest de KB incluido) + ~650 de
  respuesta por corrida real.
- **Ruteo de proveedor** (`OPENROUTER_PROVIDER_ORDER`): probado contra Cerebras/Groq/SambaNova
  para 4 modelos candidatos adicionales — ninguna combinación alcanzable igualó la confiabilidad
  (≥90% válido) de los modelos default, así que el default se mantiene sin pinning de proveedor.

## Assets que debes agregar

Estos archivos no se versionan en git y deben agregarse manualmente antes de un despliegue real:

- **`public/audio/wedding-theme.mp3`** — pista de audio de fondo del reel, royalty-free, de al
  menos 12 segundos (ver `public/audio/README.md` para la guía de tono — "Son Huapango
  Queretano" / cuerdas clásicas — y la nota de licencia que debe acompañarla). Mientras no
  exista, el reel se reproduce sin sonido y el chip de pista muestra "Sin audio".
- **`public/brand/logo.svg`** y **`public/brand/logo-mark.svg`** — son placeholders; deben
  reemplazarse por el logotipo oficial de Querétaro Romance / SECTUR (el segundo es solo el
  isotipo, usado en el header a partir de 360px de ancho).
- Las fuentes (`Playfair Display`, `Plus Jakarta Sans`) ya están incluidas en
  `public/fonts/` bajo la licencia SIL Open Font License 1.1 (ver `public/fonts/README.md`); no
  requieren acción.

## Reglas de copy

Ningún texto visible para la pareja (quiz, resultados, moodboard, reel, errores, aria-labels,
alt) debe mencionar IA/AI, nombres de modelos o proveedores (OpenRouter, Qwen, DeepSeek, GPT…),
"tokens" o "tiempo real" — el loader dice que la propuesta se está analizando/preparando, nunca
que "la IA" hace algo. `src/copy-audit.test.ts` escanea `src/**/*.tsx`, `src/components/**/*.ts`
y `data/kb/*.json` y falla si alguna de esas palabras aparece en un string literal o texto JSX
(con una lista blanca de rutas no visibles al usuario, como `src/domain/ai/`, y un escape por
línea `// copy-audit-ignore` para casos legítimos).

El footer de `/resultados` (`MetaFooter`, `src/components/results/MetaFooter.tsx`) sigue esta
regla por diseño: por default solo muestra "Propuesta generada en {s} s · {n} respuestas" (y el
pill "Modo demo sin conexión" si se usó el fallback local). El detalle técnico — modelo que
respondió, duración en ms y, cuando el proveedor la reporta, tokens y costo estimado — solo se
renderiza agregando `?debug=1` a la URL de resultados (vía `useSearchParams` en
`MetaFooterDebugLine.tsx`, un subcomponente cliente envuelto en `Suspense`). Cada paso del quiz
lleva la misma meta (`source`, `cached`, `fallbackUsed`, `attempts`) internamente, aunque no se
muestra en la UI del quiz.

## Despliegue en Vercel (Hobby)

1. Importa este repositorio de GitHub en Vercel.
2. Configura las variables de entorno de la tabla anterior en el proyecto de Vercel (al menos
   `OPENROUTER_API_KEY` y `GOOGLE_PLACES_API_KEY`/`UNSPLASH_ACCESS_KEY` si quieres generación y
   fotos reales en vez de los fallbacks).
3. `GET /api/og/moodboard` corre en el runtime de Node (`export const runtime = "nodejs"`) y lee
   fuentes desde `public/fonts/`; no es compatible con el runtime Edge.
4. No hay renderizado de video en el servidor: el reel se reproduce íntegramente en el cliente
   con `@remotion/player`.
5. El caché del motor del quiz y de las fotos de Places es en memoria/disco por proceso — en un
   entorno serverless multi-instancia (como Vercel) cada instancia tiene su propio caché, así que
   el beneficio del prefetch especulativo depende de que la misma instancia atienda ambas
   llamadas (normal dentro de una sola sesión de usuario, pero no garantizado). Ver "Próximas
   iteraciones" para la migración a un store compartido.

## Estructura del proyecto

```
src/
  app/              # Rutas de Next.js (App Router): quiz, resultados, recintos, API routes
  domain/           # Lógica de negocio pura: kb, quiz, experience, venues, media, moodboard, ai, images, places
  components/        # Componentes React: shell, ui, quiz, results, reel
  remotion/          # Composición del reel (Remotion Player)
  lib/               # Clientes de API (quiz, experience), stores de sesión, env, utilidades
scripts/
  kb/                # kb:ingest / kb:build / kb:enrich
  ai/                # ai:bench (benchmark de modelos y proveedores)
data/kb/             # Base de conocimiento versionada (zones.json, venues.json, experiences.json)
test/                # Setup de Vitest, stubs compartidos y fixtures (test/fixtures/demo/, test/fixtures/narration/)
docs/                # Benchmark de modelos y guion de demo
```

## Flujo de trabajo

Este repositorio se desarrolla en PRs apiladas (`poc/*`/`smart/*`, una capa por PR, con
`gh-stack`), usando conventional commits. Antes de subir cualquier cambio: `kool run quality` (y,
si toca código, `kool run test`) deben pasar en verde.

## Próximas iteraciones

- **Persistencia de sesión en Postgres**: hoy el transcript y el resultado generado viven en
  `sessionStorage` del navegador (`src/lib/transcript-store.ts`/`results-store.ts`) y el caché del
  motor del quiz es un `Map` en memoria del proceso (`src/lib/quiz-engine-deps.ts`). Mover ambos a
  Postgres habilitaría: reanudar una conversación desde otro dispositivo, un link permanente y
  compartible del resultado completo (hoy `src/lib/share.ts` solo comparte/copia la imagen del
  moodboard, no el JSON del resultado), y un caché de prefetch compartido entre instancias
  serverless (ver la nota de despliegue arriba).
