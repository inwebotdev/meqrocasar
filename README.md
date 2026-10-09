# Querétaro Romance AI (PoC)

Proof of concept for the Secretaría de Turismo del Estado de Querétaro: a gamified card quiz plus an LLM that
designs a destination-wedding concept, recommends real Querétaro venues, and produces a shareable moodboard
(PNG 1200x630) and a vertical video reel (9:16).

- Product spec: [`specs/PRD.md`](specs/PRD.md)
- Technical design: [`specs/TDD.md`](specs/TDD.md)
- Design system and mockups: [`design/`](design/)

## Desarrollo local

**Requisitos:** [Docker](https://www.docker.com/) y [kool](https://kool.dev/).

```bash
kool run setup   # copia .env.dist -> .env, instala hooks, levanta el contenedor e instala dependencias
kool run dev      # http://localhost:3000
kool run test     # vitest (proyectos node + jsdom)
kool run quality  # format:check + types:check + lint:check
```

Copia `.env.dist` a `.env` y completa las variables que necesites (claves de OpenRouter/Unsplash); sin ellas
la app usa valores por defecto / fallbacks locales.
