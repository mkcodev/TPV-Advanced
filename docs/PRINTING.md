# Especificación de impresión — next-TPV

Guía para implementar la impresión de tickets y comandas de cocina. La impresión ESC/POS real se implementa en la Fase 2 (Electron + `node-thermal-printer`). La Fase 1 usa una vista imprimible de navegador como sustituto provisional.

---

## 1. Hardware objetivo

| Parámetro | Valor |
|---|---|
| Ancho de papel principal | **80mm** (58mm como degradado — ajustar márgenes automáticamente) |
| Protocolo | **ESC/POS** (estándar; compatible con la mayoría de impresoras térmicas baratas) |
| Charset | **CP858** (incluye el símbolo €) o **UTF-8** si la impresora lo soporta. Verificar con cada modelo |
| Velocidad de comunicación | USB o red (TCP/IP) — sin restricción en el diseño |
| Cajón portamonedas | Pulso vía ESC/POS (`ESC p 0 25 250` o similar) al cierre de cobro en efectivo |

---

## 2. Ticket de cliente (factura simplificada)

### Campos obligatorios (RD 1619/2012 — verificar con gestor los requisitos exactos vigentes)

```
[Logo del negocio si cabe]
Nombre comercial del negocio
Razón social | NIF/CIF
Dirección fiscal
Teléfono (opcional pero recomendado)

--- Ticket nº <serie><número> ---
Fecha y hora de emisión

Empleado: <nombre>           Mesa: <nombre>

CANT  DESCRIPCIÓN              PRECIO
----  -----------------------  ------
  2   Caña                      2,40 €
  1   Ración de croquetas        8,50 €
      Extra: salsa brava        +0,50 €

-----------------------------------
BASE 10%       9,00 €   IVA  0,90 €
BASE 21%       2,00 €   IVA  0,42 €
-----------------------------------
TOTAL                         12,82 €

EFECTIVO ENTREGADO            15,00 €
CAMBIO                         2,18 €

[HUECO QR — ver nota Veri*factu]

VERI*FACTU    (solo en modo verifactu)
Gracias por su visita
```

> ⚠️ **Hueco QR Veri*factu:** el QR legal y la etiqueta `VERI*FACTU` se implementan en la Fase 2. El layout debe reservar el espacio (aprox. 30mm×30mm en la parte inferior del ticket). El formato exacto del contenido del QR sigue la **especificación técnica oficial de la AEAT vigente** — no inventarlo.

### Desglose de IVA

Mostrar una línea por cada tipo de IVA presente en el ticket (ver política de redondeo por bloques en `docs/DATABASE-SCHEMA.md` "Notas de implementación"). Si solo hay un tipo de IVA, agrupar en una sola línea.

---

## 3. Comanda de cocina / barra

Diseñada para ser leída rápidamente desde lejos. Sin importes.

```
========= COCINA / BARRA =========
Mesa: 5 (Terraza)       Nº comanda: 42
Empleado: Ana           HH:MM

  x2  CROQUETAS
         → Sin gluten
  x1  ENTRECOT
         → Poco hecho
         → Sin pimienta

Nota de mesa: alérgico frutos secos
==================================
```

### Enrutado de impresión

La categoría del producto determina la impresora destino (`product_categories.print_destination`):

| Valor | Destino |
|---|---|
| `'kitchen'` | Impresora / pantalla KDS de cocina |
| `'bar'` | Impresora de barra (bebidas, cafés) |
| `'none'` | No se imprime comanda (ej. productos de tarifa como cobro de servicio) |

Cuando una comanda tiene productos de distintos destinos, se generan impresiones separadas: una para cocina y una para barra. El terminal puede tener varias impresoras configuradas (una por destino).

---

## 4. Comportamiento con impresora offline o en error

> **Regla de oro: un fallo de impresora nunca bloquea la venta.**

| Situación | Comportamiento |
|---|---|
| Impresora desconectada al intentar imprimir | Mostrar aviso prominente; el ticket queda en cola |
| Cola de tickets pendientes | Se imprimen automáticamente al reconectar la impresora |
| Reimpresión manual | Siempre disponible desde el histórico; **se registra en `system_events`** (la reimpresión es un evento auditado) |
| Fallo persistente durante el servicio | La caja sigue vendiendo y cobrando; la impresión se resuelve después |

---

## 5. Fase 1 — Vista imprimible de navegador (provisional)

Hasta que se integre ESC/POS en Electron (Fase 2), la impresión se hace con `window.print()` sobre una vista CSS especial:

- Clase `print:hidden` en todo lo que no debe salir.
- Fuente monoespaciada (Courier/monospace) para imitar el ticket térmico.
- Ancho fijo de 72 caracteres (equivalente a 80mm a 12cpi).
- El hueco del QR se muestra como un recuadro con el texto `[QR Veri*factu — disponible en Fase 2]`.

---

## 6. Fase 2 — Integración ESC/POS en Electron

- Usar `node-thermal-printer` (o biblioteca equivalente — verificar mantenimiento activo antes de instalar).
- La configuración de impresoras (IP, tipo, ancho) se guarda por dispositivo en la BD.
- ESC/POS sustituye la impresión de navegador de la Fase 1; no se mantienen los dos caminos en producción.
- Antes de añadir la dependencia, solicitar aprobación del mantenedor (regla del CLAUDE.md).

---

*Para el enrutado de impresión a nivel de categoría, ver columna `print_destination` en `docs/DATABASE-SCHEMA.md` módulo 2.*
