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

---

## 1. Color (modo claro)

Convención shadcn: cada color es una terna HSL en una variable CSS y se usa como `hsl(var(--token))`.
Tailwind mapea estos tokens a clases (`bg-primary`, `text-muted-foreground`, `border-border`...).

| Token | Uso | Valor HSL |
|---|---|---|
| `background` / `foreground` | Fondo de app / texto principal | `0 0% 100%` / `222 47% 11%` |
| `card` / `card-foreground` | Tarjetas | `0 0% 100%` / `222 47% 11%` |
| `popover` / `popover-foreground` | Menús, popovers | `0 0% 100%` / `222 47% 11%` |
| `primary` / `primary-foreground` | **Acento de marca** (botones, activo, total) | `211 90% 54%` / `0 0% 100%` |
| `secondary` / `secondary-foreground` | Botones/superficies secundarias | `210 40% 96%` / `222 47% 11%` |
| `muted` / `muted-foreground` | Fondos apagados / texto atenuado | `210 40% 96%` / `215 16% 47%` |
| `accent` / `accent-foreground` | Hover de items, resaltados suaves | `210 40% 96%` / `222 47% 11%` |
| `destructive` / `-foreground` | Borrar, anular, errores | `0 72% 51%` / `0 0% 100%` |
| `success` / `-foreground` | Cobro OK, confirmaciones | `142 71% 45%` / `0 0% 100%` |
| `warning` / `-foreground` | Avisos (bajo stock, por cobrar) | `38 92% 50%` / `222 47% 11%` |
| `border` / `input` / `ring` | Bordes / bordes de input / anillo de foco | `214 32% 91%` / `214 32% 91%` / `211 90% 54%` |

**Estados de mesa** (plano de sala) — colores semánticos dedicados:

| Estado | Token | Color |
|---|---|---|
| Libre | `state-free` | verde `142 71% 45%` |
| Ocupada | `state-occupied` | azul `211 90% 54%` |
| Por cobrar | `state-billing` | ámbar `38 92% 50%` |
| Reservada | `state-reserved` | violeta `262 83% 58%` |

**Reglas de color**
- Nunca un `#hex` en un componente. Solo tokens.
- Texto sobre color de marca → siempre el `*-foreground` correspondiente.
- No crear tonos nuevos a mano: usa opacidad de Tailwind sobre el token (`bg-primary/90`, `/10`).
- Verde = éxito/dinero, rojo = destructivo, ámbar = aviso. No mezclar significados.

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
- **PaymentMethodButton** — efectivo/tarjeta/mixto (tamaño `xl`).
- **EmployeeAvatarButton** — selección de empleado para login por PIN.
- **StatCard** — tarjeta de KPI en informes.
- **KdsTicketCard** — comanda en la pantalla de cocina, con estado.

**Cada componente propio:**
1. Usa `cva` para variantes/tamaños y `cn` para combinar clases.
2. Solo tokens (colores/espaciados/radios de este documento).
3. `forwardRef` y props tipadas; `asChild` cuando aplique.
4. Textos vía i18n (nada de español fijo).
5. Vive en `packages/ui`, se exporta desde `src/index.ts`.

---

## 7. Cómo se conecta (wiring)

1. En el scaffolding (tarea 0.5): inicializar shadcn/ui en `apps/web` (crea `components.json`,
   estilo **new-york**, base color **slate**, radio **0.5rem**, fuente **Inter**).
2. **Reemplazar** las variables CSS que genere shadcn por las de `packages/ui/src/styles/tokens.css`
   (nuestra fuente de verdad) e importar ese archivo en el `globals.css` de la app.
3. Mapear los tokens en el tema de Tailwind (según la versión vigente de Tailwind/shadcn) para que
   `bg-primary`, `text-muted-foreground`, etc. resuelvan a `hsl(var(--token))`.
4. Registrar la fuente Inter y activar `tabular-nums` donde haya cifras.

> No hardcodear el mapeo aquí para no quedar desactualizado con la versión de Tailwind: se hace
> siguiendo la doc vigente de shadcn, pero **los valores** salen siempre de `tokens.css`.

---

## 8. Reglas de cumplimiento (para que salga perfecto a la primera)

**Obligatorio en cada componente/pantalla:**
- ❌ Nada de colores `#hex`/`rgb()` en componentes → ✅ solo tokens (`bg-primary`, `text-foreground`).
- ❌ Nada de espaciados arbitrarios (`p-[13px]`, `gap-[7px]`) → ✅ solo la escala de la Sección 3.
- ❌ Nada de tamaños de fuente sueltos (`text-[15px]`) → ✅ solo la escala tipográfica.
- ❌ Nada de `z-[9999]` → ✅ escala de z-index.
- ✅ Variantes con `cva`, combinación con `cn`. Nada de `style={{}}` salvo posición dinámica
  (p. ej. coordenadas de mesa en el plano).
- ✅ Objetivos táctiles ≥44px en el TPV.
- ✅ Textos vía i18n.
- ✅ Estados completos: hover, focus-visible (`ring`), disabled, loading (skeleton), vacío y error.

**Checklist antes de dar por hecha una pantalla:**
- [ ] ¿Todos los espaciados son de la escala de 4px?
- [ ] ¿Todos los colores son tokens?
- [ ] ¿Los precios usan `tabular-nums` y `formatCents`?
- [ ] ¿Objetivos táctiles ≥44px?
- [ ] ¿Reutiliza componentes de `@tpv/ui` en vez de duplicar?
- [ ] ¿Foco visible y accesible? ¿Contraste AA?
- [ ] ¿Sin textos fijos (todo i18n)?

**Recomendado:** montar **Storybook** en `packages/ui` para revisar cada componente aislado y
evitar incoherencias. (Opcional, pero ayuda mucho a la consistencia.)

---

## 9. Do / Don't (ejemplos rápidos)

```tsx
// ✅ BIEN: tokens + escala + cn + variantes
<Button variant="success" size="xl" className="w-full">Cobrar</Button>
<div className="rounded-lg border bg-card p-4 space-y-2"> ... </div>

// ❌ MAL: valores inventados, color fijo, espaciado a medida
<button style={{ background: '#3aa0f5', padding: '13px' }}>Cobrar</button>
<div className="rounded-[9px] p-[15px] text-[15px]"> ... </div>
```

*Este documento y `packages/ui` son la referencia. Cualquier componente o pantalla que no los
respete se considera incompleto (ver Definición de terminado en CLAUDE.md).*
