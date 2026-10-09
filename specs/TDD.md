Aquí tienes el **TDD** completo encerrado dentro de un único bloque de código Markdown para que puedas copiarlo íntegramente sin que se renderice parte de él en la respuesta.

```markdown
# 🛠️ Technical Design Document (TDD)

**Proyecto:** Querétaro Romance AI (PoC)  
**Cliente:** Secretaría de Turismo del Estado de Querétaro

---

## 1. Arquitectura del Sistema
```

[ Frontend: Next.js (App Router) + Framer Motion ]
│
▼ (POST /api/generate-experience)
[ OpenRouter API (Qwen 2.5 72B / DeepSeek) ]
│
▼ (Returns JSON Schema)
[ Next.js Backend Processing ]
├── Data Enrichment (Google Places / Unsplash)
├── Moodboard Generation (@vercel/og / Satori)
└── Video Rendering (Remotion Client-Side)
│
▼
[ Dashboard de Resultados ]

````

---

## 2. Stack Tecnológico de $0 USD en Licencias

* **Framework Base:** Next.js 14+ (App Router).
* **Hosting / Infrastructure:** Vercel (Plan Hobby Gratuito).
* **Estilos y Componentes:** Tailwind CSS + `framer-motion` (para las cards gamificadas) + `lucide-react`.
* **API de Inteligencia Artificial:** OpenRouter API (`qwen/qwen-2.5-72b-instruct`).
* **Imágenes de Recursos:** Unsplash API (Plan Dev Gratuito: 50 requests/hora) o Pexels API.
* **Generación de Moodboard:** `@vercel/og` (Librería basada en Satori que convierte JSX/HTML a PNG en la Edge Network de Vercel a $0 USD).
* **Generación de Video Reel:** Remotion (`@remotion/player` y renderizado programmatic en Next.js a $0 USD).

---

## 3. Especificación de APIs e Integraciones

### 3.1. Endpoint Principal: `POST /api/generate-experience`

**Payload de Entrada (Request Body):**
```json
{
  "style": "rustic_vineyard",
  "timeOfDay": "sunset",
  "guestExperience": "wine_tasting",
  "vibe": "boho_chic"
}

````

**Prompt Enviado a OpenRouter (`qwen/qwen-2.5-72b-instruct`):**

```text
System: Eres un experto en Turismo de Romance del Estado de Querétaro, México.
Analiza las preferencias de la pareja y devuelve ÚNICAMENTE un objeto JSON estricto sin bloques markdown de código con la siguiente estructura:

{
  "conceptTitle": "Título poético corto para la boda",
  "colorPalette": ["#HEX1", "#HEX2", "#HEX3", "#HEX4"],
  "narrative": "Descripción en 2 párrafos de cómo sería su boda ideal en Querétaro de forma orgánica.",
  "searchQueries": ["query1 para fotos de Unsplash", "query2", "query3"],
  "recommendedVenues": [
    {
      "name": "Nombre Real de Hacienda o Viñedo en Querétaro",
      "zone": "Ubicación (Ej. Tequisquiapan, Ezequiel Montes, Centro Histórico)",
      "reason": "Por qué conecta con su estilo"
    }
  ]
}

User Input:
- Estilo: rustic_vineyard
- Momento: sunset
- Experiencia: wine_tasting
- Ambiente: boho_chic

```

---

## 4. Pipeline de Renderizado Visual (Moodboard y Reel)

### 4.1. Moodboard Dinámico (`/api/og/moodboard`)

Se implementa una ruta de la API de Next.js utilizando `@vercel/og`:

```tsx
// app/api/og/moodboard/route.tsx
import { ImageResponse } from "@vercel/og";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "Tu Boda Soñada";
  const colors = searchParams.get("colors")?.split(",") || [
    "#D4AF37",
    "#FFF",
    "#000",
    "#E8D8C8",
  ];
  const img1 = searchParams.get("img1");
  const img2 = searchParams.get("img2");

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "1200px",
          height: "630px",
          backgroundColor: "#F9F6F0",
          padding: "40px",
        }}
      >
        <h1 style={{ fontSize: "48px", color: "#333", fontFamily: "serif" }}>
          {title}
        </h1>
        <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
          <img
            src={img1!}
            style={{
              width: "500px",
              height: "350px",
              borderRadius: "12px",
              objectFit: "cover",
            }}
          />
          <img
            src={img2!}
            style={{
              width: "500px",
              height: "350px",
              borderRadius: "12px",
              objectFit: "cover",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          {colors.map((color, idx) => (
            <div
              key={idx}
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                backgroundColor: color,
              }}
            />
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
```

### 4.2. Video Reel con Remotion (`<Player />`)

En lugar de renderizar el video en el servidor (lo cual consume CPU y tiempo), la PoC utilizará el componente `<Player />` de Remotion en el Frontend.

- El video se reproduce **en tiempo real en el navegador** combinando las imágenes obtenidas de Unsplash, las capas de texto generadas por la IA y la música de fondo.
- Para el usuario final es indistinto de un MP4 y permite previsualizar e interactuar con el Reel de forma instantánea sin costo de renderizado.

---

## 5. Estructura de Directorios del Proyecto (`Next.js`)

```text
queretaro-romance-poc/
├── app/
│   ├── api/
│   │   ├── generate-experience/route.ts  # Llamada a OpenRouter
│   │   └── og/moodboard/route.tsx        # Generador PNG (@vercel/og)
│   ├── components/
│   │   ├── QuizCards.tsx                 # Interfaz de Swipe Gamificada
│   │   ├── MoodboardView.tsx             # Visualizador del Moodboard
│   │   └── ReelPlayer.tsx                # Reproductor de Remotion (Video)
│   ├── page.tsx                          # Landing y orquestador del flujo
│   └── layout.tsx
├── remotion/                             # Plantilla de Video Vertical
│   ├── Composition.tsx
│   └── Root.tsx
├── public/
│   └── audio/wedding-theme.mp3
└── package.json

```

```

```
