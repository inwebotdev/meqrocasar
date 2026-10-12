# Guion de demo en vivo

Dos conversaciones reales y contrastantes, grabadas con `kool run dev` corriendo contra
OpenRouter real (sin mocks) el 2026-10-11. El transcript y el resultado generado de cada una
viven en [`test/fixtures/demo/`](../test/fixtures/demo/) (claves/API keys nunca aparecen en esos
JSON — solo transcript, resultado y metadatos de modelo/latencia/tokens).

Úsalas como guion para una demo en vivo (`/` → quiz → `/resultados`) o para inspeccionar el JSON
directamente cuando no haya conexión a OpenRouter a la mano.

## Pareja A — Valentina & Rodrigo (íntima, colonial, presupuesto medio)

**Fixtures:** `couple-a-intima-colonial.transcript.json` / `.experience.json`

Valentina y Rodrigo quieren algo íntimo, con alma de centro histórico: cantera rosa, candiles,
callejones. Nada de presupuesto exclusivo — buscan algo medido pero inolvidable.

| Paso | Tema                    | Eligen                                                                                  |
| ---- | ----------------------- | --------------------------------------------------------------------------------------- |
| 1    | Estilo                  | **Colonial Imperial & Casonas** — patios de cantera rosa virreinal del Centro Histórico |
| 2    | Entorno                 | **Callejoneada en el Centro Histórico** — andadores de cantera con luz dorada de tarde  |
| 3    | Escala y experiencia    | **Callejoneada en el Centro Histórico** (celebración íntima, música tradicional)        |
| 4    | Elemento infaltable     | **Cata de Vinos** — cava subterránea de Finca Sala Vivé by Freixenet                    |
| 5    | Zona y presupuesto      | **Tequisquiapan** — calles adoquinadas y casas de colores                               |
| 6    | Presupuesto y hospedaje | **Casona de los Cinco Patios** — hasta 280 invitados, presupuesto medio, con hospedaje  |
| 7    | Temporada               | **Primavera en Tequisquiapan** — ruta de viñedos y queserías artesanales                |

**Resultado generado** (`qwen/qwen3-30b-a3b`, ~3.9s, sin fallback):

- **Concepto:** "Catas y Calles bajo el Cielo Colonial"
- **Paleta:** Canela Colonial, Rosa Cantera, Café Antiguo, Beige Viñedo
- **Recintos:** Casona de los Cinco Patios (principal) · Finca Sala Vivé by Freixenet · Hacienda
  Atongo
- **Itinerario:** Viernes Ruta del Arte/Queso/Vino en Tequisquiapan → Sábado cata en Freixenet →
  Domingo celebración en Casona de los Cinco Patios

**Qué mostrar en vivo:** cómo la 2ª pregunta ya no es la genérica "entorno" del quiz estático —
el motor adapta la pregunta 2 en adelante al "colonial" elegido en el paso 1 (compara con la
pareja B, que ve una pregunta de entorno distinta desde el mismo paso 2). Señala los chips de
facets conocidos acumulándose (`KnownFacetsStrip`) y la tarjeta con foto/rating reales de la
Casona de los Cinco Patios en el paso 6.

## Pareja B — Ana & Diego (grande, viñedos, exclusiva)

**Fixtures:** `couple-b-grande-vinedos.transcript.json` / `.experience.json`

Ana y Diego quieren una boda grande entre viñedos, sin límite de presupuesto: vendimia, cavas,
una hacienda para el banquete.

| Paso | Tema                | Eligen                                                                                     |
| ---- | ------------------- | ------------------------------------------------------------------------------------------ |
| 1    | Estilo              | **Rústico Viñedo & Enológico** — parras centenarias, barricas de roble americano           |
| 2    | Entorno             | **Viñedos La Redonda** — el viñedo más grande de Querétaro, vista a la Peña de Bernal      |
| 3    | Escala              | **Boda Privada en Viñedos La Redonda** — casona principal, hasta 550 invitados             |
| 4    | Experiencia         | **Cata en Bodegas De Cote** — alta cocina de autor, viñedo con lago artificial             |
| 5    | Zona                | **Centro Histórico** — calles empedradas y patios de cantera rosa bajo el cielo estrellado |
| 6    | Elemento infaltable | **Cata de Vinos** — cava subterránea de Finca Sala Vivé by Freixenet                       |
| 7    | Presupuesto         | **Hacienda Viborillas, 150k MXN** — banquete gourmet, presupuesto exclusivo                |

**Resultado generado** (`qwen/qwen3-30b-a3b`, ~3.6s, sin fallback):

- **Concepto:** "Boda en el Tiempo de la Vendimia"
- **Paleta:** Vino de Barrica, Oro Vendimia, Beige Barrica, Verde Viñedo
- **Recintos:** Viñedos La Redonda (principal) · Bodegas De Cote · Hacienda Viborillas
- **Itinerario:** Viernes cata en Bodegas De Cote → Sábado ceremonia en Viñedos La Redonda →
  Domingo recepción en Hacienda Viborillas

**Qué mostrar en vivo:** el contraste total con la pareja A desde el paso 2 (misma pregunta de
"estilo" en el paso 1, pero una conversación completamente distinta a partir de ahí porque el
motor conoce ya `style: rustic_vineyard`); la escala "grande" (550 invitados) reflejada en el
venue principal; y que el presupuesto "exclusivo" del paso 7 no colisiona con el "medio" de la
pareja A — son conversaciones independientes, cada una grounded en los mismos 21 recintos y 20
experiencias de la base de conocimiento, pero nunca repiten la misma pregunta en el mismo orden.

## Cómo reproducir la demo en vivo

```bash
kool run dev   # arranca next dev en el contenedor, http://localhost:3000
```

1. Abre `http://localhost:3000/`, completa el quiz siguiendo la columna "Eligen" de la pareja que
   quieras narrar (los textos de las opciones generadas cambian corrida a corrida — el motor es
   no determinista entre ejecuciones reales — pero los _facets_ que estableces en cada paso son
   los que importan para que el resultado final sea equivalente al de la tabla).
2. Al terminar el quiz, `/resultados` muestra el concepto, la paleta, los recintos con foto/rating
   reales, el moodboard descargable y el reel.
3. **Reel narrado:** con `ELEVENLABS_API_KEY`/`ELEVENLABS_VOICE_ID` configuradas, el reel trae una
   voz femenina de acento mexicano leyendo el guion, con subtítulos sincronizados y la música de
   fondo agachada mientras habla — da play y señala el pill "Narración · Querétaro Romance" y los
   subtítulos apareciendo en sincro con la voz. **Si la narración sigue `"Preparando
narración…"`** (la síntesis de ElevenLabs no llegó a tiempo), sigue hablando de la paleta, los
   recintos o el itinerario durante ~10 s más — la tarjeta sondea el estado cada 2 s y el player
   aparece solo en cuanto la voz está lista, sin que tengas que recargar nada. Sin esas variables
   (o sin conexión), el reel se reproduce en silencio con las líneas narrativas estáticas; para
   mostrar igual el estado narrado completo sin red, arranca con
   `NEXT_PUBLIC_NARRATION_FIXTURE=1` en `.env` (dev-only, ver el README) antes de `kool run dev`.
4. Si no hay conexión a OpenRouter a la mano, los JSON en `test/fixtures/demo/` son el resultado
   real de estas mismas dos conversaciones — útiles para mostrar el resultado final sin depender
   de la red, o como fixture para una futura prueba de regresión end-to-end.
5. Visita `/recintos` y filtra por "Bernal" o "Tequisquiapan" para mostrar el catálogo completo de
   la base de conocimiento (independiente del quiz).
