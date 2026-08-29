---
name: Informe de Acceso Estudiantil UNIFRANZ
description: Panel institucional de acceso estudiantil — datos calmos, un solo acento naranja, claro/oscuro.
colors:
  accent: "#ef5a22"
  accent-soft: "#fdece4"
  alert: "#d92d20"
  alert-soft: "#fce9e7"
  series-2: "#a8a8ae"
  bg: "#f4f4f3"
  surface: "#ffffff"
  surface-2: "#fafafa"
  ink: "#18181b"
  ink-2: "#3f3f46"
  muted: "#71717a"
  border: "#e5e5e6"
  track: "#ededee"
  brand-black: "#000000"
  accent-dark: "#ff6a37"
  bg-dark: "#0c0c0e"
  surface-dark: "#151518"
typography:
  display:
    fontFamily: "'Inter Tight Variable', 'Inter Variable', system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 5.4vw, 4rem)"
    fontWeight: 650
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  figure:
    fontFamily: "'Inter Tight Variable', 'Inter Variable', system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 2.6vw, 2rem)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "'Inter Tight Variable', 'Inter Variable', system-ui, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Inter Tight Variable', 'Inter Variable', system-ui, sans-serif"
    fontSize: "1.06rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "'Inter Variable', system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.011em"
  body-sm:
    fontFamily: "'Inter Variable', system-ui, sans-serif"
    fontSize: "0.86rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.006em"
  label:
    fontFamily: "'Inter Variable', system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "normal"
  micro:
    fontFamily: "'Inter Variable', system-ui, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "normal"
rounded:
  hair: "3px"
  xs: "4px"
  data: "6px"
  sm: "9px"
  control: "10px"
  md: "14px"
  pill: "999px"
spacing:
  xs: "9px"
  sm: "14px"
  md: "18px"
  lg: "22px"
components:
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "20px 22px"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  stat-figure:
    typography: "{typography.headline}"
    textColor: "{colors.ink}"
---

# Design System: Informe de Acceso Estudiantil UNIFRANZ

## Overview

**Creative North Star: "El Boletín de Control"**

Un panel institucional que convierte un export crudo de molinetes ZKTeco en una sola pantalla legible y confiable. La personalidad es la de un boletín de control serio: calmo, denso donde importa, sin adornos. Toma su vara de oficio de Linear (jerarquía sobria, densidad cómoda, detalle preciso) y de Vercel/Observable (claridad en la visualización de datos). Cada banda de la página afirma **una** verdad dominante; el naranja de UNIFRANZ aparece una sola vez como acento.

Rechaza deliberadamente el rut del dashboard SaaS: sin sidebar, sin índigo, sin tarjetas-sparkline idénticas como estructura de página. El negro se reserva para la teja de marca; el resto es tinta casi neutra sobre fondo casi neutro. Soporta tema claro (predeterminado, escena de oficina/impresión) y oscuro (afín al negro de marca) por interruptor.

**Key Characteristics:**
- Un único acento (naranja) sobre base casi neutra.
- Numerales tabulares en toda cifra; tipografía Inter Tight para display, Inter para UI.
- Gráficos de datos dibujados a mano en SVG, planos y precisos.
- Rojo reservado, por ley, solo para bloqueo/denegación por deuda.
- Claro y oscuro como pares de primera clase.

## Colors

Paleta casi monocroma: base neutra, un acento naranja y un rojo de alerta de uso estricto.

### Primary
- **Naranja UNIFRANZ** (#ef5a22 claro / #ff6a37 oscuro): el único acento. Cifra héroe, relleno de barras de ingresos, botón primario, estados activos de carga, borde de foco, caret y selección. Su versión suave (#fdece4 / #2a1207) es fondo de badges y hover de filas.

### Secondary
- **Neutro de serie** (#a8a8ae claro / #55555e oscuro): la segunda serie de datos (salidas) en los gráficos. No compite con el acento; separa entradas de salidas sin introducir un segundo color de marca.

### Tertiary
- **Rojo de alerta** (#d92d20 claro / #f97066 oscuro): exclusivo de deuda/denegación — barras de bloqueados, pastilla de denegados por carrera, cifra de bloqueados. Su versión suave (#fce9e7) es el fondo de esas pastillas.

### Neutral
- **Fondo** (#f4f4f3 claro / #0c0c0e oscuro): lienzo de la página.
- **Superficie** (#ffffff / #151518) y **Superficie-2** (#fafafa / #1b1b1f): tarjetas/paneles y encabezados de tabla.
- **Tinta** (#18181b / #f4f4f5) e **Tinta-2** (#3f3f46 / #d4d4d8): texto principal y secundario.
- **Apagado** (#71717a / #9a9aa2): metadatos, ejes, notas.
- **Borde** (#e5e5e6 / #29292f) y **Riel** (#ededee / #232329): divisores y fondo de las pistas de barras.
- **Negro de marca** (#000000): exclusivo de la teja del logotipo UNIFRANZ, en ambos temas; nunca como fondo de página ni de superficie.

### Named Rules
**La Regla del Acento Único.** El naranja es el único color de marca en pantalla; entradas y estructura lo usan, todo lo demás es neutro. Si aparece un segundo acento, algo se rompió.
**La Regla del Rojo Reservado.** El rojo solo significa bloqueo/denegación por deuda. Nunca es decorativo ni un segundo acento.

## Typography

**Display Font:** Inter Tight Variable (con Inter Variable, system-ui)
**Body Font:** Inter Variable (con system-ui)

**Character:** Inter Tight, más comprimida, carga las cifras y los títulos con presencia sin gritar; Inter sostiene la UI con neutralidad legible. Ambas variables y auto-hospedadas (fontsource), nunca caras de sistema como voz de display.

### Hierarchy
- **Display** (650, clamp(2.6rem, 5.4vw, 4rem), 0.95): la cifra protagonista del héroe (asistencia % o ingresos).
- **Figure** (600, clamp(1.5rem, 2.6vw, 2rem)): cifras de stat en la banda de resumen.
- **Title** (600, 1.2rem): títulos de secciones de estado vacío.
- **Headline** (600, 1.06rem): títulos de panel; cifra de tally.
- **Body** (400, 0.95rem, 1.5): texto general.
- **Body-sm** (600, 0.86rem): valores de tabla y de barras, botones, período.
- **Label** (600, 0.8rem): claves de stat, códigos de carrera, notas de panel.
- **Micro** (500, 0.72rem): badges, nombres de archivo, ejes de gráfico, legendas, pastillas.

La escala completa de UI es {0.72, 0.78, 0.80, 0.86, 0.95, 1.06, 1.20}rem más los clamps de Figure y Display; consolidada para evitar duplicados casi idénticos.

### Named Rules
**La Regla de los Numerales Tabulares.** Toda cifra usa `font-variant-numeric: tabular-nums` para que columnas y comparaciones alineen. Sin excepción.

## Layout

Contenedor centrado de ancho máximo 1180px con relleno fluido (`clamp(16px, 4vw, 40px)`). El cuerpo apila bandas: cabecera pegajosa, zona de carga (grilla de 3), banda de resumen (héroe + stats), pares de paneles en grilla de 2 columnas (afluencia/día), y paneles de ancho completo (carrera, bloqueados, admisiones). Ritmo vertical de 18px entre bandas. Bajo 860px todo colapsa a una columna; bajo 520px las stats van a 2 columnas y los nombres de carrera se ocultan (queda el código). Los gráficos son SVG responsivos (`viewBox`, ancho 100%).

## Elevation & Depth

Sistema mayormente plano con una elevación suave y única para tarjetas. Sin sombras duras de bloque.

### Shadow Vocabulary
- **Lift de tarjeta** (`box-shadow: 0 1px 2px rgba(24,24,27,.05), 0 10px 28px -14px rgba(24,24,27,.18)`): eleva paneles, zonas de carga y la banda de resumen sobre el fondo. En oscuro sube a `0 1px 2px rgba(0,0,0,.4), 0 16px 40px -18px rgba(0,0,0,.7)`.
- **Foco de carga** (`0 0 0 3px var(--accent-soft)` + lift): estado `is-over` al arrastrar un archivo.

### Named Rules
**La Regla Plana-con-Lift.** Las superficies son planas; la profundidad la da una sola sombra suave (offset + blur), nunca un halo sin offset ni una sombra dura de bloque.

## Shapes

Esquinas redondeadas escalonadas: tarjetas y zonas de carga a 14px (md), tablas y sub-bloques a 9px (sm), controles a 10px (control), y pastillas/pistas de barra totalmente redondeadas (999px, pill). Micro-radios para micro-elementos: 6px (data) en columnas de gráfico, 4px (xs) en anillos de foco, 3px (hair) en chips de leyenda. Bordes de 1px en `--border`; los paneles de alerta tiñen su borde mezclando el rojo (`color-mix`), nunca con una franja lateral. Iconos SVG con trazo consistente (1.7–2), nunca glifos ni emoji.

## Components

### Buttons
- **Shape:** 10px (`--radius-control`).
- **Primary:** fondo naranja, texto superficie, 9px 15px; hover sube brillo (`filter: brightness(1.06)`).
- **Ghost:** transparente, texto tinta-2, borde `--border`; hover intensifica borde y tinta. Usado para "Exportar CSV".
- Todo botón lleva su icono SVG a la izquierda con trazo 2.

### Cards / Containers (paneles)
- **Corner Style:** 14px.
- **Background:** superficie; encabezados de tabla en superficie-2.
- **Shadow Strategy:** Lift de tarjeta (ver Elevation).
- **Border:** 1px `--border`; variante `--alert` tiñe el borde con rojo.
- **Internal Padding:** 20–24px.

### Inputs / Fields (zonas de carga)
- **Style:** tarjeta-etiqueta que envuelve un `<input type=file>` oculto; icono + título + estado + nombre de archivo.
- **States:** `idle` (pista), `busy` (icono pulsa, "Procesando…"), `done` (borde e icono naranja, resumen), `error` (estado rojo), `is-over` (anillo de foco naranja al arrastrar).
- La zona principal lleva un badge "Principal".

### Data bars (barra horizontal)
- Grilla de 3: identidad (código + nombre) · pista redondeada · valor. Relleno naranja (o rojo en variante alerta) que crece con `scaleX` en una sola revelación escalonada. El valor puede llevar una pastilla roja de denegados.

### Charts (SVG a medida)
- Afluencia por hora: columnas agrupadas entradas (naranja) / salidas (neutro), con rótulo de pico. Ingresos por día: área + línea naranja con puntos. Ejes y grilla en neutros; interacción por `:hover` + `<title>` nativo.

### Signature Component — Banda de resumen (héroe)
- Dos zonas: una cifra dominante (Display, naranja) con etiqueta y sub-contexto, separada por un divisor de una fila de stats (auto-fit, mínimo 118px). Jerarquía real en vez de cuatro tarjetas idénticas.

## Do's and Don'ts

### Do:
- **Do** usar el naranja como acento único; deja que su rareza lo haga leer.
- **Do** reservar el rojo exclusivamente para bloqueo/denegación por deuda.
- **Do** aplicar numerales tabulares a toda cifra.
- **Do** dibujar iconos como SVG de trazo consistente y gráficos como SVG a medida.
- **Do** tematizar las superficies del navegador (selección, caret, scrollbar, foco) desde la paleta.

### Don't:
- **Don't** introducir un segundo acento de color ni un shell de sidebar/índigo.
- **Don't** usar sombras duras de bloque, gradient text, franjas laterales de color, ni caras de sistema como display.
- **Don't** convertir el badge "Principal" (etiqueta funcional de la zona de carga) en un kicker/eyebrow sobre títulos.
- **Don't** apilar tarjetas idénticas como estructura de página; usa jerarquía.
