# 📋 Product Requirement Document (PRD)

**Proyecto:** Querétaro Romance AI (PoC)  
**Cliente:** Secretaría de Turismo del Estado de Querétaro

---

## 1. Visión e Identidad del Producto

- **Nombre del Proyecto:** Querétaro Romance AI (PoC)
- **Objetivo:** Demostrar a la Secretaría de Turismo cómo una experiencia gamificada basada en tarjetas interactivas e Inteligencia Artificial puede personalizar la planificación de bodas de destino, recomendando recintos locales de forma orgánica y entregando un Moodboard y un Video Reel listos para compartir.
- **Público Objetivo:** Novios/parejas en búsqueda de destino para su boda y funcionarios de la Secretaría de Turismo de Querétaro.

---

## 2. Modelos de IA Seleccionados (OpenRouter)

Se descartan OpenAI y Anthropic por costo. Se seleccionan **modelos chinos de alta eficiencia** en OpenRouter para garantizar velocidad, soporte multilingüe fluido y costo casi nulo:

1. **`qwen/qwen-2.5-72b-instruct` (o `qwen/qwen-turbo`)**
   - **Rol:** Modelo Principal (Motor Lógico).
   - **Costo estimado:** ~$0.10 - $0.35 USD / 1M tokens.
   - **Razón:** Superior rendimiento en formateo JSON estricto, excelente redacción narrativa en español latino y comprensión de matices culturales de México.
2. **`deepseek/deepseek-chat` (DeepSeek V3 / Flash)**
   - **Rol:** Modelo Fallback / Backup.
   - **Costo estimado:** ~$0.14 - $0.28 USD / 1M tokens.
   - **Razón:** Latencia ultrarrápida para mantener la fluidez en el cuestionario dinámico.

---

## 3. Requerimientos Funcionales

### 3.1. Cuestionario Interactivo (Swipe Cards)

- Interfaz táctil y visual con animaciones de tarjetas estilo "Tinder/Swipe".
- **Pregunta 1:** Estilo visual (_Colonial, Rústico Viñedo, Boho Chic, Elegante Moderno_).
- **Pregunta 2:** Horario y entorno (_Atardecer Jardín, Noche Casona, Día Viñedo_).
- **Pregunta 3:** Tipo de experiencia (_Íntima / Boutique, Gran Fiesta Tradicional, Escapada de Fin de Semana_).
- **Pregunta 4:** Elemento infaltable (_Cata de Vinos, Fuegos Artificiales, Banquete Mexicano Gourmet, Callejoneada_).

### 3.2. Motor de Recomendación Orgánica (Querétaro)

- El sistema asociará las respuestas con una base de datos local de zonas turísticas y recintos reales (Ej. _Hacienda Lagunillas, Viñedos La Redonda, Casona de los Cinco Patios, Centro Histórico de Querétaro, Tequisquiapan, San Juan del Río_).
- La recomendación no incluirá lenguaje publicitario directo, integrando los recintos dentro de la narrativa del viaje.

### 3.3. Generación del Moodboard Visual (100% Gratis)

- Construcción de una imagen resumen (PNG, 1200x630px) que contenga:
  - Título del concepto de boda.
  - Paleta de 4 colores armónicos (HEX).
  - 3 fotografías representativas extraídas vía Unsplash API.
  - Sello visual oficial: _"Diseñado con la IA de Turismo Querétaro"_.

### 3.4. Generación del Video Reel (100% Gratis)

- Un video vertical MP4 / Canvas (9:16) de 10-12 segundos con:
  - Transición de las 3 imágenes del destino.
  - Overlay de texto con la narrativa y nombre del concepto.
  - Audio de fondo romántico de libre uso.

---

## 4. Métricas de Éxito de la PoC

- Tiempo total de procesamiento (Cuestionario a Resultados) < 5 segundos.
- Costo por sesión generada < $0.002 USD.
- Renderizado exitoso del Moodboard y Video Reel en el 100% de los casos de prueba.
