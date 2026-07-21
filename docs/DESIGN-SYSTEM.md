# Design System — next-TPV

Fuente de verdad del diseño. Base **shadcn/ui**, **modo claro**, tokens fijos y **reglas estrictas**
para que la interfaz sea 100% consistente y ningún agente "invente" espaciados, colores ni estilos.

> **Regla suprema:** todo estilo sale de un TOKEN de este documento. Nada de valores sueltos
> (`#hex`, `p-[13px]`, `mt-[7px]`, `text-[15px]`). Si algo no encaja en la escala, se revisa la
> escala aquí — no se hace una excepción en el componente.

Los valores viven en código en `packages/ui/src/styles/tokens.css` (variables CSS). El componente
de referencia es `packages/ui/src/components/button.tsx`: **todo componente nuevo imita ese patrón.**

---

## 0. Principios

1. **Tokens, no valores.** Color, espaciado, tipografía, radios y sombras salen de la escala.
2. **Consistencia por rejilla de 4px.** Todos los espaciados son múltiplos de 4px.
3. **Reutilizar antes que crear.** Primero un componente de shadcn/ui. Si no existe para una
   sección, se crea **con el mismo patrón** (cva + tokens + `cn`), lo más shadcn posible.
4. **Táctil primero (TPV).** Objetivos mínimos de 44–48px. Pensado para dedos en barra.
5. **Temeable.** Los colores son variables CSS → un cliente premium re-skinea con su marca sin
   tocar componentes.
6. **Accesible.** Contraste AA, foco visible (`ring`), estados claros.
7. **Optimista por defecto.** Tap → feedback visual **<100ms siempre** (el estado optimista se
   pinta al instante y se confirma/revierte después). Ninguna pulsación bloquea la siguiente.
   Las confirmaciones destructivas usan un **toast con acción "Deshacer" (5s)**, no un diálogo
   modal bloqueante — excepto para anular una comanda entera o cerrar la sesión de caja.

---

## 1. Color (modo claro)

Convención shadcn: cada color es una terna HSL en una variable CSS y se usa como `hsl(var(--token))`.
Tailwind mapea estos tokens a clases (`bg-primary`, `text-muted-foreground`, `border-border`...).

| Token | Uso | Valor HSL |
|---|---|---|
| `background` / `foreground` | Fondo de app / texto principal | `0 0% 100%` / `222 47% 11%` |
| `card` / `card-foreground` | Tarjetas | `0 0% 100%` / `222 47% 11%` |
| `popover` / `popover-foreground` | Menús, popovers | `0 0% 100%` / `222 47% 11%` |
| `primary` / `primary-foreground` | **Acento de marca** (botones, activo, total) | `211 90% 42%` / `0 0% 100%` |
| `secondary` / `secondary-foreground` | Botones/superficies secundarias | `210 40% 96%` / `222 47% 11%` |
| `muted` / `muted-foreground` | Fondos apagados / texto atenuado | `210 40% 96%` / `215 16% 47%` |
| `accent` / `accent-foreground` | Hover de items, resaltados suaves | `210 40% 96%` / `222 47% 11%` |
| `destructive` / `-foreground` | Borrar, anular, errores | `0 72% 51%` / `0 0% 100%` |
| `success` / `-foreground` | Cobro OK, confirmaciones | `142 72% 29%` / `0 0% 100%` |
| `warning` / `-foreground` | Avisos (bajo stock, por cobrar) | `38 92% 50%` / `222 47% 11%` |
| `border` / `input` / `ring` | Bordes / bordes de input / anillo de foco | `214 32% 91%` / `214 32% 91%` / `211 90% 42%` |

> ⚠️ **Contraste AA:** los valores de `primary` (`211 90% 42%`) y `success` (`142 72% 29%`) han
> sido oscurecidos respecto al diseño inicial para alcanzar ≥4.5:1 con texto blanco. **Verificar
> con una herramienta de contraste** (p. ej. Polypane, axe DevTools) al implementar, especialmente
> en el botón "Cobrar" (`success`, talla `xl`) que es el elemento más importante de la pantalla.

**Estados de mesa** (plano de sala) — colores semánticos dedicados:

| Estado | Token | Color | Uso |
|---|---|---|---|
| Libre | `state-free` | verde `142 71% 45%` | Relleno/borde (3:1 sobre fondo blanco). No poner texto blanco encima sin verificar AA |
| Ocupada | `state-occupied` | azul `211 90% 54%` | Relleno/borde (ver nota) |
| Por cobrar | `state-billing` | ámbar `38 92% 50%` | Relleno/borde (ver nota) |
| Reservada | `state-reserved` | violeta `262 83% 58%` | Relleno/borde (ver nota) |

> Los tokens `state-*` se usan como relleno o borde de las fichas de mesa, donde el ratio 3:1 es
> suficiente (UI element, no texto normal). Si necesitas texto encima de ellos, verifica el
> contraste con herramienta antes de hacerlo.

**Reglas de color**
- Nunca un `#hex` en un componente. Solo tokens.
- Texto sobre color de marca → siempre el `*-foreground` correspondiente.
- No crear tonos nuevos a mano: usa opacidad de Tailwind sobre el token (`bg-primary/90`, `/10`).
- Verde = éxito/dinero, rojo = destructivo, ámbar = aviso. No mezclar significados.

**Tema oscuro para KDS**
Los tokens tendrán una variante `[data-theme='dark']` en `tokens.css`. Esta variante es **obligatoria para la pantalla KDS** (cocina con poca luz y pantalla encendida muchas horas) y opcional para el TPV en turno de noche. No se implementa en Fase 1; se deja el hueco definido para que añadirla no requiera tocar componentes.

---

## 2. Tipografía

Fuente única: **Inter** (con `font-feature-settings` de números tabulares para precios).

| Rol | Tamaño / línea | Peso | Uso |
|---|---|---|---|
| `display` | 36 / 40 | 700 | Total a cobrar, cifras grandes |
| `h1` | 30 / 36 | 700 | Título de pantalla |
| `h2` | 24 / 32 | 600 | Secciones |
| `h3` | 20 / 28 | 600 | Subsecciones, nombre de producto en ficha |
| `h4` | 18 / 28 | 600 | Encabezados menores |
| `body-lg` | 16 / 24 | 400 | Texto táctil (botones lg, listas del TPV) |
| `body` | 14 / 20 | 400 | **Base** por defecto |
| `small` | 13 / 18 | 400 | Metadatos, ayudas |
| `caption` | 12 / 16 | 500 | Etiquetas, tabs, mayúsculas con tracking |

**Reglas de tipografía**
- Pesos permitidos: **400, 500, 600, 700**. Nada intermedio.
- **Precios y cantidades:** siempre `tabular-nums` (los dígitos no bailan al cambiar). Peso 600.
- No usar tamaños fuera de la escala (`text-[15px]` prohibido).
- Máx. 2 pesos por bloque para no ensuciar.

### Iconografía

Librería única: **Lucide React**. No mezclar con otras librerías de iconos.

| Parámetro | Valor |
|---|---|
| `stroke-width` | **2** (legibilidad táctil a distancia en el TPV) — 1.5 solo en admin de alta densidad |
| Tamaños permitidos | 16px · 20px · 24px · 32px |
| `aria-label` | **Obligatorio** en todos los icon-buttons (botones sin texto visible) |
| Emojis en UI | ❌ Prohibido |

---

## 3. Espaciado (rejilla de 4px) — LO MÁS ESTRICTO

Solo se permiten estos pasos (coinciden con la escala nativa de Tailwind). **Prohibido inventar
valores arbitrarios.**

| Token Tailwind | px | Uso típico |
|---|---|---|
| `0.5` | 2 | Micro-ajustes (separación icono-texto fino) |
| `1` | 4 | Gaps mínimos |
| `2` | 8 | Gap entre elementos relacionados |
| `3` | 12 | Padding interno de controles pequeños |
| `4` | 16 | **Padding estándar** de tarjetas y contenedores |
| `5` | 20 | — |
| `6` | 24 | Separación entre grupos |
| `8` | 32 | Separación entre secciones |
| `10` | 40 | — |
| `12` | 48 | Márgenes de pantalla amplios |
| `16` | 64 | Bloques grandes |

**Contratos de espaciado (aplícalos siempre igual):**
- **Padding interno de tarjeta/panel:** `p-4` (16px). Compacto (admin): `p-3`.
- **Gap entre items de una lista/comanda:** `gap-2` (8px).
- **Gap entre grupos o campos de formulario:** `gap-4` (16px).
- **Separación entre secciones de una pantalla:** `space-y-6` u `8`.
- **Padding de pantalla (contenedor raíz):** `p-4` en TPV táctil, `p-6` en admin.
- **Rejilla de productos:** `gap-3` o `gap-4` uniforme (nunca mezclar en la misma rejilla).

Regla de oro: **si dudas entre dos valores, elige el de la escala más cercano; nunca un valor a medida.**

---

## 4. Radios, sombras, bordes, z-index

**Radio** (base `--radius: 0.5rem` = 8px):
- `rounded-sm` = 4px (badges, chips pequeños)
- `rounded-md` = 6px (botones, inputs)
- `rounded-lg` = 8px (tarjetas, diálogos)
- `rounded-full` (avatares, pills)

**Elevación (sombras)** — en modo claro se prefiere **borde antes que sombra**:
- Tarjetas: `border` + `shadow-xs` (0 1px 2px rgba(0,0,0,.05)).
- Popovers/menús: `shadow-md`.
- Diálogos/hojas: `shadow-lg`.
- Nada de sombras fuertes o de colores.

**Bordes:** 1px, color `border`. Radios y grosores siempre por token.

**Z-index (escala fija):**
`base 0` · `dropdown 1000` · `sticky 1100` · `overlay 1200` · `modal 1300` · `popover 1400` · `toast 1500`.
Prohibido `z-[9999]` a mano.

---

## 5. Tamaños y objetivos táctiles

TPV = pantalla táctil en barra. Objetivos generosos.

| Elemento | Altura | Nota |
|---|---|---|
| Botón `sm` | 36px | Solo admin/densos |
| Botón `default` | 40px | Uso general |
| Botón `lg` | 48px | **Acción táctil del TPV** |
| Botón `xl` | 56px | Cobro / acción principal |
| Objetivo táctil mínimo | 44px | Nunca menos en el TPV |
| Tecla de teclado numérico | 64px | PIN y cobro |
| Tarjeta de producto | ≥ 96px | Foto + nombre + precio |
| Fila de comanda | 48–56px | Cómoda para tocar el stepper |

**Resoluciones objetivo:**
- **Caja (tablet landscape):** 1280×800px — pantalla principal del TPV.
- **Camarero (móvil PWA):** 390×844px — vista compacta para tomar comandas de pie.
- **Rejilla de productos:** 4–5 columnas en caja; 2–3 columnas en móvil.
- **Panel de comanda:** fijo a la derecha, ancho mínimo 320px en caja.

---

## 6. Inventario de componentes

### 6.1 Base de shadcn/ui (instalar tal cual con el CLI de shadcn)
`button` (ya de referencia), `input`, `label`, `textarea`, `select`, `checkbox`, `radio-group`,
`switch`, `dialog`, `sheet`, `drawer`, `dropdown-menu`, `popover`, `tooltip`, `tabs`, `card`,
`badge`, `avatar`, `separator`, `scroll-area`, `sonner` (toasts), `skeleton`, `alert`,
`alert-dialog`, `table`, `form`, `command`.

> Al instalarlos, se adaptan a nuestros tokens (ya que shadcn usa las mismas variables CSS).

### 6.2 Componentes propios del TPV (crear con el patrón de `button.tsx`)
Cuando shadcn no cubre una necesidad, se crea en `packages/ui` imitando su estilo (cva + tokens + `cn`):

- **PriceTag / MoneyDisplay** — muestra céntimos formateados (`@tpv/core.formatCents`), `tabular-nums`.
- **QuantityStepper** — − / valor / + (objetivos ≥44px).
- **ProductCard** — foto (ratio fijo), nombre (`h4`), precio (`PriceTag`); `p-3`, `rounded-lg`, `gap-2`.
- **CategoryTabBar / CategoryChip** — navegación de categorías.
- **OrderPanel** — lista de la comanda con `gap-2`, total abajo en `display`.
- **OrderLineItem** — nombre + modificadores + `QuantityStepper` + precio; altura 48–56px.
- **NumericKeypad / PinPad** — teclas 64px, `gap-2`.
- **TableTile** — mesa del plano; color por `state-*`; forma según `shape`.
- **FloorPlanCanvas** — lienzo del plano (arrastrar mesas).
- **ZoneTabs** — salón/terraza/barra.
- **PaymentMethodButton** — efectivo/tarjeta/bizum/mixto (tamaño `xl`).
- **EmployeeAvatarButton** — selección de empleado para login por PIN.
- **StatCard** — tarjeta de KPI en informes.
- **KdsTicketCard** — comanda en la pantalla de cocina, con estado.
- **SyncStatusPill** — indicador de sincronización offline (verde/ámbar + cola).

**Cada componente propio:**
1. Usa `cva` para variantes/tamaños y `cn` para combinar clases.
2. Solo tokens (colores/espaciados/radios de este documento).
3. `forwardRef` y props tipadas; `asChild` cuando aplique.
4. Textos vía i18n (nada de español fijo).
5. Vive en `packages/ui`, se exporta desde `src/index.ts`.
6. Llega con su story en Storybook.

---

## 7. Motion (animación y transiciones)

### Tokens de duración y easing

En `tokens.css` (usar siempre estas variables — no inventar duraciones):

```css
--duration-fast:     150ms;  /* feedback táctil, respuesta de pulsación */
--duration-base:     250ms;  /* transiciones de UI estándar */
--duration-slow:     400ms;  /* overlays, modales, panels laterales */
--ease-standard:     cubic-bezier(0.2, 0, 0, 1);
```

### Reglas absolutas

- **Solo animar:** `transform`, `opacity`. En casos excepcionales: `filter`. **Nunca** `width`, `height`, `top`, `left`, `margin`, `padding` (layout thrashing).
- **`prefers-reduced-motion`:** desactiva animaciones decorativas y de entrada, pero **nunca** el feedback de pulsación (scale 0.97 al pulsar un botón). El feedback táctil no marea a nadie y es funcional, no decorativo.
- `will-change: transform` solo justo antes de animar y retirarlo después. No ponerlo de forma permanente.

### Categorías de animación

| Categoría | Duración | Afecta a `prefers-reduced-motion` |
|---|---|---|
| Feedback de pulsación (scale) | `--duration-fast` | ❌ Siempre activo |
| Hover / focus | CSS `transition` nativo | ❌ Siempre activo |
| Toast / notificación entrada | `--duration-base` | ✅ Desactivar con reduced-motion |
| Overlay / modal entrada | `--duration-slow` | ✅ Desactivar con reduced-motion |
| Animaciones de scroll / reveal | Variable | ✅ Desactivar con reduced-motion |

---

## 8. Interacciones del TPV (diseño de referencia)

Estas interacciones son **diferenciadores del producto**, no decoración. Cada una tiene una justificación de ergonomía. Implementarlas como parte del sistema, no como extras.

### S1 — Repetir ronda
**Qué:** Un botón en el panel de comanda que re-añade todos los ítems de la última tanda de la mesa en 1 toque.
**Por qué acelera:** Los bares venden rondas ("lo mismo otra vez"). Convierte 6 toques en 1. Muy pocos TPV lo hacen bien.
**Implementación:** El historial de la comanda guarda la "última tanda" (los ítems desde el último `sent_to_kitchen_at`). Un toque los copia como ítems nuevos con `status='pending'`.

### S2 — Cobro rápido con billetes comunes
**Qué:** En la pantalla de cobro, botones grandes que representan los billetes más comunes (5 / 10 / 20 / 50 €) más un botón de "importe exacto". Al tocar, el cambio se calcula y muestra instantáneamente en tamaño `display`.
**Por qué acelera:** El cálculo de cambio es el microcuello de botella nº1 en barra. Con 2 toques (billete → confirmar) el camarero ve el cambio a 1 metro de distancia.
**Implementación:** Calcular con `@tpv/core`. El cambio en fuente `display` (36/40, peso 700, `tabular-nums`).

### S3 — Tap = +1 con pulso; long-press = incremento continuo
**Qué:** Al tocar la tarjeta de producto (o el botón `+` del stepper), un counter flotante en la esquina superior derecha de la tarjeta muestra la cantidad añadida. La tarjeta hace `scale(0.97)` al presionar y vuelve a `1` al soltar (`--duration-fast`, `transform` solamente). Long-press (>500ms) activa el incremento continuo mientras se mantiene pulsado.
**Por qué acelera:** Añadir "5 cañas" sin abrir ningún diálogo. El feedback <100ms hace que el camarero confíe sin mirar.
**Nota:** el counter flotante usa `opacity` + `scale` para entrar y salir (no `display: none`).

### S4 — Swipe en líneas de comanda
**Qué:** Deslizar una línea de comanda a la **izquierda** la anula (con estado optimista inmediato + toast con "Deshacer" durante 5s). Deslizar a la **derecha** la duplica.
**Por qué acelera:** Los botones pequeños de anular/duplicar son difíciles de tocar con dedos mojados o bajo presión. Los gestos son más naturales y rápidos.
**Nota de seguridad:** la anulación de líneas enviadas a cocina requiere rol manager+ (verificación en servidor). El swipe visible solo si el empleado tiene el rol.

### S5 — Plano de mesas vivo
**Qué:** Las fichas de mesa del plano tienen dos indicadores dinámicos:
1. **Pulso sutil** en el borde (opacity 1→0.6→1, lento, `--duration-slow`) cuando cocina marca un plato como "listo" — el camarero sabe a qué mesa ir sin que nadie grite.
2. **Badge de tiempo** en la esquina de la ficha (ej. "12m") mostrando los minutos desde el último pedido en las mesas ocupadas.
**Por qué acelera:** Visibilidad periférica. El camarero ve de un vistazo dónde actuar. El badge de tiempo detecta mesas desatendidas (más consumo, mejor servicio).
**Implementación:** El pulso es CSS puro (`animation: pulse`). El badge calcula desde `orders.updated_at` o el último `order_events` de tipo `item_added`.

### S6 — Pill de estado de sincronización
**Qué:** Indicador discreto en la esquina de la UI (componente `SyncStatusPill`):
- 🟢 Verde: en línea, todo sincronizado.
- 🟡 Ámbar: offline, `n` operaciones en cola.
- Al reconectar, una animación de "vaciado" de izquierda a derecha en el pill (usando `transform: scaleX()`, no `width`).
**Por qué acelera:** "¿Se ha guardado?" es la pregunta que genera más desconfianza en los TPV cloud. Hacer la cola visible convierte el miedo en rutina conocida.
**Implementación:** Estado de Zustand; el pill se suscribe solo al contador de la cola offline.

### S7 — Command palette de productos
**Qué:** En la caja, un atajo de teclado (ej. `/` o `Ctrl+K`) abre la paleta de búsqueda de productos (shadcn `command`). Escribir "cro" muestra "Croquetas" instantáneamente. En táctil, el icono de búsqueda abre el mismo componente con teclado en pantalla.
**Por qué acelera:** Cartas con 100+ productos hacen la rejilla inviable. La paleta es más rápida que navegar categorías para quienes conocen el catálogo de memoria (el personal).

### S8 — Chip de empleado en cada línea de comanda
**Qué:** Avatar circular de 20px del empleado que añadió la línea, en el extremo derecho de cada fila de la comanda.
**Por qué acelera:** En mesas atendidas por varios camareros, identifica quién añadió qué sin abrir el histórico. Útil para resolver discrepancias en el cobro.
**Implementación:** Color de acento por empleado (generado deterministamente desde el `employee.id`). Solo visible si hay >1 empleado activo en la mesa.

### S9 — Borde izquierdo de color de categoría en líneas de comanda
**Qué:** Cada fila del panel de comanda tiene un borde izquierdo (4px, `rounded-sm`) del color de la categoría del producto (`product_categories.color`).
**Por qué acelera:** Escaneo visual instantáneo del ticket — distingues bebidas de cocina sin leer. Especialmente útil al repasar antes de enviar.
**Implementación:** `style={{ borderLeftColor: category.color }}` es la excepción válida al uso de `style={{}}` (color dinámico de dato, no valor inventado).

### S10 — Total con "tick" animado al añadir línea
**Qué:** Al añadir una línea a la comanda, el total (`display`, `tabular-nums`) hace un `scale(1) → scale(1.04) → scale(1)` en `--duration-fast` (150ms).
**Por qué acelera:** Confirmación periférica: el camarero ve que "ha entrado" sin necesidad de leer el número. El efecto es sutil — no debe distraer.
**Implementación:** Disparar la animación con una clave de React (`key={totalCents}`) o con Framer Motion `animate`.

---

## 9. Cómo se conecta (wiring)

1. En el scaffolding (tarea 0.5): inicializar shadcn/ui en `apps/web` (crea `components.json`,
   estilo **new-york**, base color **slate**, radio **0.5rem**, fuente **Inter**).
2. **Reemplazar** las variables CSS que genere shadcn por las de `packages/ui/src/styles/tokens.css`
   (nuestra fuente de verdad) e importar ese archivo en el `globals.css` de la app.
3. Mapear los tokens en el tema de Tailwind (según la versión vigente de Tailwind/shadcn) para que
   `bg-primary`, `text-muted-foreground`, etc. resuelvan a `hsl(var(--token))`.
4. Registrar la fuente Inter y activar `tabular-nums` donde haya cifras.

> No hardcodear el mapeo aquí para no quedar desactualizado con la versión de Tailwind: se hace
> siguiendo la doc vigente de shadcn, pero **los valores** salen siempre de `tokens.css`.

> **Regla crítica para Tailwind v4 — tokens de color:** al instalar un componente de shadcn que
> introduzca tokens de color nuevos (p. ej. `sidebar`, `chart`), hay que mapearlos explícitamente en
> el bloque `@theme` de `globals.css` (y en `storybook.css`) con la forma
> `--color-{nombre}: hsl(var(--{nombre}))`. En Tailwind v4 las utilidades (`bg-sidebar`,
> `text-sidebar-foreground`…) **no existen** hasta declararse en `@theme`.

> **Regla crítica para Tailwind v4 — sintaxis de variables arbitrarias:** la sintaxis v3
> `w-[--mi-var]` ya **no es válida** en v4 y no genera CSS. La sintaxis correcta es
> `w-(--mi-var)` (shorthand v4) o `w-[var(--mi-var)]` (explícita). Al portar componentes de
> shadcn, verificar que la fuente usada sea la versión compatible con v4; si no, las clases de
> ancho/alto con variables CSS no se generan y el layout se rompe en silencio.

---

## 10. Reglas de cumplimiento (para que salga perfecto a la primera)

**Obligatorio en cada componente/pantalla:**
- ❌ Nada de colores `#hex`/`rgb()` en componentes → ✅ solo tokens (`bg-primary`, `text-foreground`).
- ❌ Nada de espaciados arbitrarios (`p-[13px]`, `gap-[7px]`) → ✅ solo la escala de la Sección 3.
- ❌ Nada de tamaños de fuente sueltos (`text-[15px]`) → ✅ solo la escala tipográfica.
- ❌ Nada de `z-[9999]` → ✅ escala de z-index.
- ❌ Nada de `width`/`height` animados → ✅ `transform`/`opacity` con tokens de Motion (Sección 7).
- ✅ Variantes con `cva`, combinación con `cn`. Nada de `style={{}}` salvo posición dinámica
  (coordenadas de mesa en el plano) y colores dinámicos de dato (color de categoría en S9).
- ✅ Objetivos táctiles ≥44px en el TPV.
- ✅ Textos vía i18n.
- ✅ Estados completos: hover, focus-visible (`ring`), disabled, loading (skeleton), vacío y error.
- ✅ Story en Storybook por cada componente nuevo de `@tpv/ui`.

**Checklist antes de dar por hecha una pantalla:**
- [ ] ¿Todos los espaciados son de la escala de 4px?
- [ ] ¿Todos los colores son tokens?
- [ ] ¿Los precios usan `tabular-nums` y `formatCents`?
- [ ] ¿Objetivos táctiles ≥44px?
- [ ] ¿Reutiliza componentes de `@tpv/ui` en vez de duplicar?
- [ ] ¿Foco visible y accesible? ¿Contraste AA verificado?
- [ ] ¿Sin textos fijos (todo i18n)?
- [ ] ¿Iconos Lucide con `stroke-width=2` y `aria-label` en icon-buttons?
- [ ] ¿Las animaciones usan solo `transform`/`opacity` y los tokens de Motion?

---

## 11. Do / Don't (ejemplos rápidos)

```tsx
// ✅ BIEN: tokens + escala + cn + variantes
<Button variant="success" size="xl" className="w-full">Cobrar</Button>
<div className="rounded-lg border bg-card p-4 space-y-2"> ... </div>

// ❌ MAL: valores inventados, color fijo, espaciado a medida
<button style={{ background: '#3aa0f5', padding: '13px' }}>Cobrar</button>
<div className="rounded-[9px] p-[15px] text-[15px]"> ... </div>

// ✅ BIEN: animación con tokens de Motion
<motion.div style={{ scale }} transition={{ duration: 0.15 }}>...</motion.div>
// (usar la variable --duration-fast en vez de 0.15 cuando Framer lo permita, o un const importado)

// ❌ MAL: animar layout
<div style={{ width: isOpen ? '300px' : '0' }}>...</div>  // usar scaleX o AnimatePresence
```

*Este documento y `packages/ui` son la referencia. Cualquier componente o pantalla que no los
respete se considera incompleto (ver Definición de terminado en CLAUDE.md).*
