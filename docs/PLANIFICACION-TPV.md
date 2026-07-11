# Planificación TPV / POS para hostelería — Documento maestro

> Proyecto: software TPV para el bar (uso real) + producto vendible a otros bares (SaaS).
> Objetivo de este documento: tener **toda la información y decisiones tomadas ANTES de escribir código**, para planificar con Opus y ejecutar con Sonnet gastando los mínimos tokens posibles.
> Fecha: julio 2026.

---

## 0. Veredicto rápido: ¿qué tan ambicioso es esto?

Es **ambicioso pero perfectamente viable**, sobre todo con la ventaja de que ya tienes un local real donde probarlo (el mejor activo posible: feedback diario gratis).

Realidad sin adornos:
- Un TPV **básico y usable** para el bar de tu padre: alcanzable en **semanas**.
- Un TPV **legalmente conforme (Veri*factu), fiable, con tiempo real móvil↔caja, e impresión de tickets**: **2–4 meses** de trabajo serio.
- Un **producto vendible (SaaS multi-negocio) que compita con los buenos del mercado**: **6–12 meses** hasta algo sólido, y luego mantenimiento continuo.

La razón por la que "los TPV son una mierda y caros" es que el mercado está lleno de software antiguo y de empresas que cobran por hardware propietario. Hay hueco real para algo moderno, rápido y honesto en precio. Lo difícil no es la parte de "tocar producto → sale precio → total"; eso es lo fácil. Lo difícil y lo que **te obliga la ley** es la facturación antifraude, la fiabilidad (que no se caiga en hora punta), el funcionamiento **offline**, y el soporte.

**Estrategia recomendada:** construir para tu padre primero (un solo local), pero con la arquitectura ya preparada para multi-negocio. Así validas con uso real antes de intentar vender.

---

## 1. ⚖️ Requisitos LEGALES obligatorios (España, régimen común) — LO MÁS IMPORTANTE

Esto **no es opcional** y condiciona el diseño de todo el sistema. En España (excepto País Vasco, que usa TicketBAI, y Navarra, con su sistema foral) aplica **Veri*factu**, regulado por el **Real Decreto 1007/2023** dentro de la Ley Antifraude (Ley 11/2021).

### Calendario de obligación (a fecha de 2026)
- **1 enero 2026** — sociedades con facturación > 6 millones €.
- **1 enero 2027** — resto de sociedades (S.L., S.A.).
- **1 julio 2027** — autónomos y pequeños negocios que tributan por IRPF (probablemente el caso del bar de tu padre).

> Los plazos se han retrasado varias veces; **verifica la fecha vigente en la AEAT antes de lanzar**. Aun así, diséñalo conforme desde el día 1: es más caro añadirlo después.

### Qué debe cumplir OBLIGATORIAMENTE tu software (SIF — Sistema Informático de Facturación)
1. **Registro de facturación por cada ticket/factura** emitido, generado de forma automática e inmediata.
2. **Encadenamiento por hash**: cada registro incluye un hash que lo enlaza con el anterior, de modo que no se pueda modificar ni borrar nada retroactivamente sin que se note. (Integridad + inalterabilidad + trazabilidad.)
3. **Código QR** visible en cada ticket/factura simplificada, para que Hacienda (y el cliente) pueda verificar su autenticidad.
4. La leyenda **"VERI*FACTU"** en el ticket cuando operes en modo de envío a la AEAT.
5. **Conservación, accesibilidad y legibilidad** de todos los registros.
6. **Declaración responsable del fabricante**: como desarrollador del software, TÚ declaras (bajo responsabilidad legal) que cumple el reglamento. No hay un "sello de Hacienda" que aprueba; es autodeclaración con responsabilidad. Esto es serio: si vendes software no conforme, la multa al fabricante llega hasta **150.000 €**; al hostelero que usa software no conforme, hasta **50.000 €**.
7. **Registro de eventos** (log interno de acciones del sistema: inicios, anulaciones, etc.).
8. **Prohibido el software de "doble uso"** (que permita ocultar ventas). Nada de borrar tickets sin dejar rastro.

### Dos modalidades — decide cuál soportas (idealmente ambas)
- **Modo VERI*FACTU (recomendado):** cada registro se envía **en tiempo real a la AEAT**. Ventaja: no tienes que conservar copias adicionales, menos responsabilidad de custodia. Requiere conexión y consumir el servicio web de la Agencia Tributaria.
- **Modo NO VERI*FACTU:** los registros se guardan localmente con hash encadenado **+ firma electrónica**, y se conservan disponibles para inspección. Más libertad operativa (no necesita estar online), pero más responsabilidad y requisitos técnicos (firma digital).

### Otras obligaciones legales que afectan al TPV
- **IVA correcto por producto**: hostelería suele ser 10% (comida y bebida servida), pero hay casos al 21%. El sistema debe permitir asignar tipo de IVA por producto y desglosarlo.
- **Factura simplificada (ticket)** con los datos mínimos legales: NIF y datos del emisor, número correlativo, fecha, desglose de IVA, total.
- **Factura completa a petición** del cliente (con sus datos fiscales) — el sistema debe poder emitirla.
- **RGPD / LOPD**: si guardas datos de empleados (nombre, foto, ventas) y de clientes (facturas con NIF), necesitas cumplir protección de datos: consentimiento, seguridad, y para el SaaS un contrato de encargado de tratamiento con tus clientes.
- **Copia de seguridad / conservación** de la información contable durante los años que exige Hacienda (4 años como norma general, conviene más).

> **Conclusión legal:** el módulo de facturación (hash + QR + envío AEAT + registro inalterable) es el **corazón regulatorio** del producto. Planifícalo con Opus como una pieza aislada y bien testeada. No lo trates como un "extra al final".

---

## 2. 🎯 Funcionalidades CLAVE (MVP — lo mínimo para que el bar funcione)

Esto es lo que necesitas para que tu padre pueda usarlo de verdad:

**Venta / comanda**
- Catálogo de productos con **foto, nombre, precio y categoría** (cafés, cañas, raciones, etc.).
- **Tocar producto → se añade a la comanda → total en vivo**. Cantidades, modificar, eliminar líneas.
- Modificadores/notas por línea ("sin hielo", "poco hecho", "para llevar").
- Diferentes **tipos de IVA** por producto.

**Mesas y salas**
- **Aparcar comandas por mesa**: abrir mesa, ir añadiendo, dejarla abierta y volver.
- Gestión de **zonas: salón, terraza, barra**, con plano/lista de mesas y su estado (libre, ocupada, por cobrar).
- **Juntar/dividir cuentas** (dividir la cuenta entre comensales es muy pedido en bares).
- Transferir una comanda de una mesa a otra.

**Cobro**
- Métodos de pago: efectivo, tarjeta, mixto. Cálculo de cambio.
- **Impresión de ticket** (factura simplificada con QR Veri*factu).
- (Fase 2) Integración con datáfono/TPV bancario.

**Usuarios**
- **Login por establecimiento** y luego **código PIN por empleado**.
- Roles: **Admin** (dueño/encargado) y **Trabajador**.
- Perfil de empleado con **nombre y foto**.
- **Registro de ventas por empleado** (quién ha cobrado qué).

**Impresión**
- Ticket de cliente (con QR legal).
- **Comanda a cocina/barra** (impresora de cocina o pantalla KDS) — que el camarero mande la comanda y salga en la barra/cocina.

**Datos / caja**
- **Cierre de caja / arqueo diario** (Z): total del día, por método de pago, por empleado.
- Histórico de tickets.

---

## 3. 🏆 Funcionalidades para ser "el mejor del mercado" y vendible (SaaS)

Lo que separa un TPV casero de un producto que puedes vender:

**Lo que más te llama — conexión móvil/tablet (tu ventaja competitiva)**
- **Comanda desde el móvil del camarero en tiempo real**: el camarero toma nota en la terraza y aparece al instante en cocina/barra y en la caja. Esto es EXACTAMENTE lo que hace bueno a un TPV moderno.
- **Sincronización en tiempo real** entre todos los dispositivos (varias tablets, la caja, la cocina) — si dos camareros tocan la misma mesa, no se pisan.
- **Modo offline**: si se cae el WiFi, el TPV sigue funcionando y sincroniza cuando vuelve. **Imprescindible** en hostelería real; muchos TPV fallan aquí y por eso los odian.

**Gestión avanzada**
- **Panel de administración** (web): productos, precios, empleados, informes, todo editable sin tocar la caja.
- **Informes y analítica**: ventas por hora/día/producto/empleado, productos más vendidos, ticket medio, comparativas. Detectar la hora punta, el producto estrella.
- **Gestión de stock/inventario**: descuento automático de existencias, avisos de bajo stock, escandallos (coste por plato).
- **Horarios / fichaje** de empleados (entrada/salida) y propinas.
- **Multi-local**: un mismo dueño con varios bares, informes agregados.

**Experiencia de cliente (diferenciadores de venta)**
- **Carta digital con QR** para que el cliente vea la carta con fotos en su móvil.
- **Pedido y pago desde la mesa por el cliente** (QR en mesa → pide y paga solo). Muy vendible.
- **Programa de fidelización** / puntos / promociones y happy hours.
- **Reservas** de mesa.
- Integración con **plataformas de delivery** (Glovo, Uber Eats, Just Eat) que vuelquen pedidos al TPV.

**Confianza y operativa del SaaS**
- **Multi-tenant**: cada bar es un "inquilino" aislado con sus datos.
- **Panel de facturación/suscripción** (cobrar la cuota mensual a tus clientes).
- **Backups automáticos** en la nube.
- **Onboarding fácil**: que un bar se dé de alta y empiece a vender en minutos.
- **Soporte** (chat/teléfono) — en hostelería el soporte rápido es medio producto.
- Funciona en **hardware barato** (tablets Android normales) — clave para competir en precio.

---

## 4. 🛠️ Stack tecnológico recomendado

Criterios que pediste: **gastar menos tokens** (código conciso, un solo lenguaje de arriba a abajo, framework popular que Claude domina), que **Claude lo maneje muy bien**, y **máxima velocidad/fluidez**. Estas tres cosas apuntan al mismo sitio.

### Recomendación principal: **TypeScript de punta a punta**

Un solo lenguaje (TypeScript) para web, móvil y backend = menos contexto, menos tokens, menos errores de "cambio de idioma mental" tanto para ti como para el modelo. Es el ecosistema que Claude conoce mejor y con más ejemplos.

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| **Frontend TPV (la caja)** | **React** + **Vite** + **TypeScript** | Lo que Claude maneja mejor del mundo. Rapidísimo en desarrollo. La carpeta se llama `next-TPV`, así que también encaja **Next.js** si quieres web + panel juntos. |
| **UI / estilos** | **Tailwind CSS** + shadcn/ui | Estándar, poquísimo código, Claude lo genera perfecto. Botones grandes tipo TPV fáciles. |
| **App móvil camareros** | **React Native (Expo)** o **PWA** | Reutilizas React y TypeScript. Expo si quieres app nativa en Android/iOS; PWA si quieres empezar rápido sin tiendas de apps. |
| **Backend / API** | **Node.js** con **tRPC** o **Next.js API routes** | Mismo lenguaje, tipado extremo a extremo. Menos código de "pegamento". |
| **Base de datos** | **PostgreSQL** (vía **Supabase**) | Robusta, gratis para empezar, y Supabase te da **auth + tiempo real + storage de fotos** listos. |
| **Tiempo real** | **Supabase Realtime** o **WebSockets** | Para la sincronización caja↔móvil↔cocina instantánea. |
| **Offline** | Base de datos local (**SQLite / IndexedDB**) + sincronización | Para que no se caiga si falla el WiFi. Es la parte técnica más delicada. |
| **ORM** | **Prisma** o **Drizzle** | Esquema de BD tipado, migraciones fáciles, Claude lo escribe muy bien. |
| **Impresión** | **ESC/POS** (protocolo estándar de impresoras de tickets) vía librería Node | Compatible con casi todas las impresoras térmicas baratas. |

### Por qué esta pila y no otras
- **¿Por qué no un lenguaje "más rápido" (Go, Rust, C++)?** Para un TPV, el cuello de botella **no es la CPU del servidor**; es la red, la sincronización y la UI. TypeScript/React es más que suficientemente rápido y te ahorra muchísimos tokens y tiempo. La fluidez que nota el usuario depende del **frontend** (React optimizado, tiempo real, offline), no del lenguaje del backend.
- **Supabase** te ahorra construir tú mismo autenticación, tiempo real, almacenamiento de fotos y base de datos — semanas de trabajo (y tokens) menos.
- **Un solo lenguaje** = el contexto que le das a Claude es coherente, reutilizable y compacto → **menos tokens por tarea**.
- Todo son tecnologías **enormemente populares** → Claude tiene el máximo de ejemplos y comete menos errores → menos idas y venidas → menos tokens.

### Alternativa si priorizas máxima velocidad de UI nativa
**Flutter (Dart)**: una sola base de código para Android, iOS y escritorio, rendimiento nativo excelente y muy fluido para pantallas táctiles. **Contra:** Claude lo maneja bien pero tiene menos ejemplos que React → algo más de tokens y correcciones. Solo lo elegiría si la fluidez táctil nativa fuese la prioridad absoluta sobre todo lo demás.

> **Decisión sugerida:** React + TypeScript + Supabase + Tailwind. Es el punto óptimo entre "Claude lo borda", "pocos tokens" y "suficientemente rápido y fluido".

---

## 5. 🏗️ Arquitectura (decisiones a tomar antes de programar)

- **Multi-tenant desde el diseño**: cada registro de la BD lleva un `business_id`. Aunque solo esté el bar de tu padre, esto permite vender a otros sin reescribir. Aislar datos por negocio (Row Level Security de Supabase).
- **Local-first / offline-first**: la caja guarda datos en local y sincroniza. No debe depender de que internet vaya bien. Esta decisión hay que tomarla al principio porque condiciona toda la estructura de datos.
- **Módulo de facturación aislado**: el hash encadenado + QR + envío AEAT como una pieza separada, testeada a fondo y con sus propios registros. Es la parte con implicaciones legales; debe ser la mejor testeada del proyecto.
- **Tiempo real**: canal por mesa/negocio para que todos los dispositivos vean lo mismo al instante.
- **Roles y permisos**: definir desde el principio qué puede hacer Admin vs Trabajador.

---

## 6. 🗺️ Roadmap por fases (para no ahogarte ni gastar tokens de más)

**Fase 0 — Cimientos (planificar con Opus)**
Esquema de base de datos, roles, arquitectura multi-tenant y offline, y el diseño del módulo de facturación legal. **Todo esto se DECIDE antes de programar.**

**Fase 1 — MVP usable en el bar**
Catálogo con fotos, comanda táctil, mesas/zonas, cobro, ticket impreso, login por PIN, cierre de caja. → **Ponerlo en el bar de tu padre y usarlo de verdad.**

**Fase 2 — Legal + móvil**
Veri*factu completo (hash, QR, envío AEAT), comanda desde móvil en tiempo real, impresora de cocina, offline robusto.

**Fase 3 — Producto vendible**
Panel de admin, informes/analítica, inventario, multi-local, suscripciones, onboarding.

**Fase 4 — Diferenciadores**
Carta QR, pago desde mesa por el cliente, fidelización, reservas, delivery.

> No intentes hacer todo a la vez. Cada fase que funciona en el bar real es una validación que vale oro.

---

## 7. 🤖 Cómo planificar con Opus y ejecutar con Sonnet (flujo y "indicaciones previas")

Esto es lo que pediste: cómo prepararlo para que **todo funcione de la mejor manera** gastando pocos tokens. La idea de "planificar con Opus, ejecutar con Sonnet" es correcta y así se hace bien:

### El principio: separar PENSAR de TECLEAR
- **Opus** (caro, más listo): decisiones de arquitectura, esquema de base de datos, el módulo legal, y **escribir un plan detallado** y documentos de especificación. Úsalo poco pero para lo importante.
- **Sonnet** (barato, rápido): ejecutar ese plan, escribir el código rutinario, componentes de UI, tests. Aquí gastas la mayoría del trabajo pero a menor coste.

### Antes de crear el proyecto, deja escrito (esto ahorra MUCHOS tokens luego):
1. **Este documento** (visión, funcionalidades, legal, stack) — ya lo tienes.
2. Un archivo **`CLAUDE.md`** en la raíz del proyecto con: el stack elegido, convenciones de código, estructura de carpetas, y "reglas" (ej. "usa TypeScript estricto", "componentes en /src/components", "nada de librerías nuevas sin justificar"). Claude lo lee automáticamente en cada sesión → no tienes que repetir el contexto → menos tokens.
3. Un **esquema de base de datos** aprobado (tablas: negocios, usuarios, productos, categorías, mesas, comandas, líneas de comanda, tickets, registros de facturación...).
4. Un **plan por fases con tareas concretas** (como el roadmap de arriba, pero desglosado en tareas pequeñas).

### Reglas para gastar menos tokens
- **Trabaja por tareas pequeñas y cerradas**, no "hazme el TPV entero". Cada tarea = un archivo o una función concreta.
- **Un plan aprobado antes de picar código**: Opus planifica, tú revisas, Sonnet ejecuta. Rehacer código es lo que más tokens quema.
- **Reutiliza el `CLAUDE.md`** para no re-explicar el contexto cada vez.
- **Un solo lenguaje (TypeScript)** en todo el stack → contexto coherente y reutilizable.
- **Tecnologías populares** (React, Postgres) → menos correcciones.
- **Tests para el módulo legal**: que un fallo se detecte solo, sin rondas de depuración manual.
- Pide a Claude que **modifique archivos existentes** en vez de reescribirlos enteros cuando el cambio es pequeño.

### Flujo de trabajo recomendado
1. Sesión con **Opus en modo plan**: "diseña el esquema de BD y la arquitectura para X" → revisas y apruebas.
2. Guardas el plan en el repo.
3. Sesiones con **Sonnet**: "implementa la tarea N del plan" → revisas → siguiente.
4. Vuelves a **Opus** solo cuando toque una decisión gorda nueva o el módulo legal.

---

## 8. 💰 Negocio y hardware (para venderlo)

- **Hardware barato**: apunta a que funcione en **tablets Android normales** + impresora térmica ESC/POS + cajón portamonedas estándar. No ates a los clientes a hardware propietario caro — ese es justo el dolor del mercado que puedes atacar.
- **Modelo de precio**: cuota mensual por local (SaaS), sin permanencias abusivas. Los competidores caros y con contratos largos son tu oportunidad.
- **Responsabilidad legal del fabricante**: al vender, tú eres el "fabricante del SIF" y firmas la declaración responsable. Antes de vender a terceros, conviene **asesoría fiscal/legal** para cubrir esto bien (y para los contratos RGPD con los clientes).
- **Empieza con tu padre** como cliente cero y caso de éxito. Un bar real usándolo a diario es tu mejor argumento de venta y tu mejor banco de pruebas.

---

## 9. ✅ Checklist antes de escribir la primera línea de código

- [ ] Confirmar región y normativa (España común → **Veri*factu**). ✔ decidido.
- [ ] Confirmar objetivo (bar + SaaS). ✔ decidido.
- [ ] Aprobar el **stack** (React + TS + Supabase + Tailwind).
- [ ] Aprobar el **esquema de base de datos** (con Opus).
- [ ] Definir el **diseño del módulo de facturación legal** (hash + QR + AEAT).
- [ ] Crear el **`CLAUDE.md`** con convenciones y estructura.
- [ ] Desglosar la **Fase 1 (MVP)** en tareas concretas.
- [ ] (Recomendado) Consulta con **asesor fiscal** sobre Veri*factu y la declaración responsable.

---

*Siguiente paso sugerido: cuando quieras, hacemos con Opus el esquema de base de datos y el `CLAUDE.md`, y montamos el esqueleto del proyecto en esta carpeta.*
