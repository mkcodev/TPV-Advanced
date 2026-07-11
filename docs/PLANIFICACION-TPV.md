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

### Calendario de obligación (a verificar con gestor/AEAT vigente antes de lanzar)

> ⚠️ **Los plazos se han retrasado varias veces** (el RDL 15/2025 fue el último aplazamiento). Las fechas siguientes son las vigentes a julio 2026, pero debes verificarlas con tu gestor o en la sede electrónica de la AEAT antes de cualquier decisión operativa.

- **1 enero 2027** — Sociedades sometidas al Impuesto sobre Sociedades (S.L., S.A., etc.).
- **1 julio 2027** — Autónomos y resto de obligados tributarios (IRPF).
- **Excluidos de Veri*factu:** Los contribuyentes ya obligados al **Suministro Inmediato de Información (SII)** (grandes empresas con facturación >6M€, grupos de IVA e inscritos en el REDEME) tienen un sistema propio y **no aplican Veri*factu**.

#### Ventana de pruebas voluntaria 2026

Durante 2026 el uso de Veri*factu es **opcional** pero existe un **entorno de pruebas de la AEAT** al que se pueden enviar registros reales. Es la ventana ideal para validar el módulo legal sin riesgo antes de la obligación. **Plan:** usar esta ventana en la Fase 2 para confirmar que la integración funciona correctamente. Verificar instrucciones del entorno de pruebas con la AEAT antes de comenzar.

#### El RD 1619/2012 aplica HOY (aunque Veri*factu sea futuro)

> ⚠️ Aunque la obligación de Veri*factu llegue en 2027, el **Reglamento de facturación (RD 1619/2012)** aplica ya hoy: la **Fase 1 con ventas reales** debe emitir tickets con numeración correlativa correcta, conservarlos y respetar los campos legales mínimos. Verificar los requisitos concretos con tu gestor antes de la primera venta real.

### Qué debe cumplir OBLIGATORIAMENTE tu software (SIF — Sistema Informático de Facturación)

1. **Registro de facturación por cada ticket/factura** emitido, generado de forma automática e inmediata.
2. **Encadenamiento por hash**: cada registro incluye un hash que lo enlaza con el anterior, de modo que no se pueda modificar ni borrar nada retroactivamente sin que se note. (Integridad + inalterabilidad + trazabilidad.)
3. **Código QR** visible en cada ticket/factura simplificada, para que Hacienda (y el cliente) pueda verificar su autenticidad.
4. La leyenda **"VERI*FACTU"** en el ticket cuando operes en modo de envío a la AEAT.
5. **Conservación, accesibilidad y legibilidad** de todos los registros.
6. **Declaración responsable del fabricante**: como desarrollador del software, TÚ declaras (bajo responsabilidad legal) que cumple el reglamento. No hay un "sello de Hacienda" que aprueba; es autodeclaración con responsabilidad. Esto es serio: si vendes software no conforme, la multa al fabricante llega hasta **150.000 €**; al hostelero que usa software no conforme, hasta **50.000 €**. **Consulta con asesoría jurídica especializada antes de vender a terceros.**
7. **Registro de eventos** (log interno de acciones del sistema: inicios, anulaciones, etc.).
8. **Prohibido el software de "doble uso"** (que permita ocultar ventas). Nada de borrar tickets sin dejar rastro.

### Dos modalidades — decide cuál soportas (idealmente ambas)

- **Modo VERI*FACTU (recomendado):** cada registro se envía **en tiempo real a la AEAT**. Ventaja: no tienes que conservar copias adicionales, menos responsabilidad de custodia. Requiere conexión y consumir el servicio web de la Agencia Tributaria. **Prerrequisito:** certificado digital del obligado tributario (o apoderamiento ante la AEAT) — verificar el procedimiento con tu gestor antes de la Fase 2.
- **Modo NO VERI*FACTU:** los registros se guardan localmente con hash encadenado **+ firma electrónica**, y se conservan disponibles para inspección. Más libertad operativa (no necesita estar online), pero más responsabilidad y requisitos técnicos (firma digital).

### Otras obligaciones legales que afectan al TPV

- **IVA correcto por producto**: hostelería suele ser 10% (comida y bebida servida), pero hay casos al 21%. El sistema debe permitir asignar tipo de IVA por producto y desglosarlo. **Los precios al público siempre se muestran con IVA incluido** (normativa de consumo); el desglose en el ticket es informativo. Verificar con gestor.
- **Factura simplificada (ticket)** con los datos mínimos legales: NIF y datos del emisor, número correlativo, fecha, desglose de IVA, total.
- **Factura completa a petición** del cliente (con sus datos fiscales) — el sistema debe poder emitirla y también las **facturas rectificativas** (tipos R1–R5 AEAT, verificar con gestor/AEAT vigente).
- **Alérgenos:** el Reglamento UE 1169/2011 obliga a informar los 14 alérgenos en hostelería — ver sección de catálogo en DATABASE-SCHEMA.md.
- **Registro de jornada:** el RD-ley 8/2019 obliga al registro horario de todos los empleados. El módulo de fichaje está planificado para la **Fase 3**; los requisitos exactos (inmutabilidad, conservación 4 años, accesibilidad a inspección) deben verificarse con el gestor antes de implementar.
- **RGPD / LOPD**: ver subsección abajo.

### RGPD operativo

Si guardas datos de empleados (nombre, foto, horarios, ventas) y de clientes (facturas con NIF), el RGPD exige:

- **Base legal** por tipo de dato: contrato laboral para empleados; obligación legal para facturas; consentimiento o interés legítimo para clientes de fidelización.
- **Seguridad**: acceso limitado por rol; cifrado en tránsito y reposo; contraseñas/PINs nunca en claro.
- **Retención**: facturas y registros contables mínimo 4 años (verificar con gestor); datos de empleados lo que marque el convenio.
- **Para el SaaS**: antes de dar de alta a clientes empresariales, firmar un **contrato de encargado de tratamiento (DPA)**. Esto es un entregable obligatorio de la **Fase 3**. Consultar con asesoría jurídica especializada.

> **Conclusión legal:** el módulo de facturación (hash + QR + envío AEAT + registro inalterable) es el **corazón regulatorio** del producto. Planifícalo con Opus como una pieza aislada y bien testeada. No lo trates como un "extra al final".

---

## 2. 🎯 Funcionalidades CLAVE (MVP — lo mínimo para que el bar funcione)

Esto es lo que necesitas para que tu padre pueda usarlo de verdad:

**Venta / comanda**
- Catálogo de productos con **foto, nombre, precio y categoría** (cafés, cañas, raciones, etc.).
- **Tocar producto → se añade a la comanda → total en vivo**. Cantidades, modificar, eliminar líneas.
- Modificadores/notas por línea ("sin hielo", "poco hecho", "para llevar").
- Diferentes **tipos de IVA** por producto.
- **Alérgenos** por producto (obligatorio UE 1169/2011).

**Mesas y salas**
- **Aparcar comandas por mesa**: abrir mesa, ir añadiendo, dejarla abierta y volver.
- Gestión de **zonas: salón, terraza, barra**, con plano/lista de mesas y su estado (libre, ocupada, por cobrar).
- **Juntar/dividir cuentas** (dividir la cuenta entre comensales es muy pedido en bares).
- Transferir una comanda de una mesa a otra.

**Cobro**
- Métodos de pago: efectivo, tarjeta, Bizum, mixto. Cálculo de cambio.
- **Impresión de ticket** (factura simplificada con QR Veri*factu).
- (Fase 2) Integración con datáfono/TPV bancario.

**Usuarios**
- **Login por establecimiento** y luego **código PIN por empleado** (verificado en servidor).
- Roles: **Admin** (dueño/encargado) y **Trabajador**.
- Perfil de empleado con **nombre y foto**.
- **Registro de ventas por empleado** (quién ha cobrado qué).

**Impresión**
- Ticket de cliente (con QR legal).
- **Comanda a cocina/barra** (impresora de cocina o pantalla KDS) — que el camarero mande la comanda y salga en la barra/cocina. Ver `docs/PRINTING.md`.

**Datos / caja**
- **Cierre de caja / arqueo diario** (Z): total del día, por método de pago, por empleado. Incluye movimientos manuales de caja (pay-in/pay-out).
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
- **Registro de jornada / fichaje** de empleados (entrada/salida) — obligatorio (RD-ley 8/2019, verificar con gestor) — **Fase 3**.
- **Propinas**: registro y reparto por empleado.
- **Multi-local**: un mismo dueño con varios bares, informes agregados.

**Backlog de alto valor detectado en revisión (ordenado por facilidad de implementación)**

| Feature | Por qué diferencia | Fase orientativa |
|---|---|---|
| **Bizum** como método de pago | España-específico; los TPV grandes lo ignoran | 1 |
| **Modo barra rápida** | Venta sin mesa (type `counter`); es el 60% de las operaciones de un bar | 1 |
| **"Marchar" cursos a cocina** | `order_items.course` ya existe; falta la acción en TPV/KDS | 2 |
| **Cierre ciego de caja** | El empleado cuenta sin ver el esperado → anti-fraude | 2 |
| **Export mensual para gestoría** (CSV/Excel Z + facturas) | Todo bar envía papeles a su asesoría mensualmente; un botón vende el producto solo | 3 |
| **Informe diario por email al dueño** | Resumen Z automático cada noche; retención del SaaS | 3 |
| **Fiado / cuenta de habitual** | El "apúntamelo" del bar de barrio; ningún competidor moderno lo tiene digno | 3 |
| **Reparto de propinas por empleado** | `tip_cents` ya existe; solo falta el informe | 3 |
| **Datáfono integrado** (SumUp/Adyen/Redsys) | Elimina el error de teclear el importe dos veces | 3+ |
| **Carta QR multi-idioma** | i18n ya planificado; turismo costera/ciudad | 4 |

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

Criterios que pediste: **gastar menos tokens** (código conciso, un solo lenguaje de arriba a abajo, framework popular que Claude domina), que **Claude lo maneje muy bien**, y **máxima velocidad/fluidez**.

### Reparto de UI entre plataformas

> **Importante:** no todas las plataformas comparten lo mismo.

| Plataforma | Qué comparte con la web |
|---|---|
| **apps/web** | Todo (TPV + admin + landing) |
| **apps/desktop** (Electron) | **100% de la UI web** — Electron es solo una cáscara; no se reescribe nada |
| **apps/mobile** (app camareros) | **Solo lógica**: `@tpv/core`, `@tpv/api`, `@tpv/validators`. La UI es React DOM y React Native no la puede usar directamente |

#### Estrategia PWA-first para la app de camareros

La app de camareros se implementa **primero como PWA** (una ruta `/waiter` dentro de `apps/web`, instalable en Android/iOS con `manifest.json`). Esto reutiliza el 100% de la UI web y el design system, sin fricción de tiendas de apps ni segunda base de código.

**Expo (React Native)** queda diferido para la Fase 4, solo si surge una necesidad nativa real (impresión Bluetooth, NFC, hardware específico). Hasta entonces, la PWA cubre todos los casos de uso.

### Recomendación principal: TypeScript de punta a punta

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| **Frontend TPV + admin** | **Next.js** (App Router) + **React** | Claude lo domina; App Router, SSR, excelente para la web |
| **UI / estilos** | **Tailwind CSS** + **shadcn/ui** | Estándar, poquísimo código, Claude lo genera perfecto |
| **App móvil camareros** | **PWA** (ruta `/waiter` en apps/web) primero; Expo diferido | Reutiliza toda la UI web; Expo solo si hay necesidad nativa |
| **App escritorio (la caja)** | **Electron** (cáscara sobre la UI web) | Sin reescribir la interfaz |
| **Backend / API** | **Next.js API routes** + **tRPC** | Mismo lenguaje, tipado extremo a extremo |
| **Base de datos** | **PostgreSQL** vía **Supabase** | Robusta, auth + tiempo real + storage listos |
| **Tiempo real** | **Supabase Realtime** | Para la sincronización caja↔camareros↔cocina |
| **Offline** | **SQLite** local en Electron + capa de sincronización | Para que no se caiga si falla el WiFi |
| **Estado TPV (cliente)** | **Zustand** (comanda activa, cola offline) | Global, ligero, fácil de testear |
| **i18n** | **next-intl** | App Router-nativo; mensajes compartibles entre paquetes |
| **ORM** | **Drizzle ORM** | Tipado, migraciones fáciles, Claude lo escribe bien |
| **Impresión** | **ESC/POS** desde Electron | Compatible con impresoras térmicas baratas |
| **Observabilidad** | **Sentry** (al desplegar en real) | Soporte sin telemetría de errores = ciego |

---

## 5. 🏗️ Arquitectura (decisiones tomadas)

- **Multi-tenant desde el diseño**: cada registro de la BD lleva un `business_id`. Aunque solo esté el bar de tu padre, esto permite vender a otros sin reescribir. Aislar datos por negocio con Row Level Security de Supabase.
- **Doble defensa multi-tenant**: (1) middleware tRPC `businessProcedure` que inyecta `business_id` desde la sesión (el `business_id` nunca se acepta como parámetro de entrada de un endpoint); (2) RLS con `auth.jwt()` para superficies con acceso directo a Supabase (Realtime, carta pública, PWA). Ver detalles en `docs/DATABASE-SCHEMA.md` "Notas de implementación".
- **Autenticación de dispositivos y empleados**: ver `docs/AUTH-DEVICES.md`. Resumen: dispositivo se empareja desde el admin → token persistente; empleado = PIN verificado en servidor, nunca en cliente.
- **Servidor autoritativo de totales**: el cliente calcula totales para la UI optimista (feedback instantáneo), pero el servidor **siempre recalcula** con `@tpv/core` antes de persistir, cobrar o facturar.
- **Emisor legal único por negocio**: solo el nodo emisor designado del negocio (la caja Electron si existe; el backend cloud si no) escribe en `billing_records`. El resto de dispositivos solicita la emisión. Esto evita el fork de la cadena de hash encadenada. Ver `docs/DATABASE-SCHEMA.md` módulo 6.
- **Offline-first (solo caja/escritorio)**: la caja sigue funcionando sin internet; las operaciones se encolan y se sincronizan al volver la conexión. Ver la estrategia de sync en `docs/DATABASE-SCHEMA.md`. Las tablets/PWA de camareros funcionan en modo degradado (solo lectura) si se pierde la conexión.

### Matriz de fallos de red (lo que se garantiza por Fase)

| Escenario | Fase 1 | Fase 2 (objetivo) |
|---|---|---|
| Internet caído, LAN viva | Sin garantía | Caja autónoma total (vende, imprime, encola) |
| WiFi local caído | Sin garantía | Caja autónoma; tablets en modo degradado |
| Solo la caja funciona | Sin garantía | Caja sigue; sincronizan al reconectar |

> No prometer más de lo que se construirá. La autonomía offline es solo de la caja en Fase 2; la autonomía de tablets es un objetivo posterior si lo demanda un cliente.

- **Módulo de facturación aislado**: el hash encadenado + QR + envío AEAT como una pieza separada, testeada a fondo. Funciones puras en `packages/core/billing`; IO (BD, AEAT, red) en `packages/api`/`db`.
- **Tiempo real**: canal por `business_id` (privado, autorizado) para que todos los dispositivos vean lo mismo al instante. Payloads mínimos (ids + versión); el cliente refetchea.
- **Roles y permisos**: definir desde el principio qué puede hacer Admin/Manager vs Worker. Ver `docs/AUTH-DEVICES.md`.

---

## 6. 🗺️ Roadmap por fases (para no ahogarte ni gastar tokens de más)

**Fase 0 — Cimientos (planificar con Opus)**
Esquema de base de datos, roles, arquitectura multi-tenant y offline, y el diseño del módulo de facturación legal. **Todo esto se DECIDE antes de programar.**

**Fase 1 — MVP usable en el bar**
Catálogo con fotos + alérgenos, comanda táctil, mesas/zonas, cobro (efectivo/tarjeta/Bizum/mixto), ticket impreso, login por PIN, cierre de caja, modo barra rápida.
→ **Ponerlo en el bar de tu padre y usarlo de verdad.**
> ⚠️ Con ventas reales aplica ya el RD 1619/2012 — tickets correlativos y conservación. Verificar con gestor antes de la primera venta.

**Fase 2 — Legal + móvil**
Veri*factu completo (hash, QR, envío AEAT — **usar la ventana de pruebas AEAT 2026**), comanda desde PWA de camareros en tiempo real, impresora de cocina / KDS, "marchar" cursos, offline robusto en la caja, cierre ciego de caja.

**Fase 3 — Producto vendible**
Panel de admin, informes/analítica, inventario, registro de jornada (RD-ley 8/2019 — verificar con gestor), export para gestoría, suscripciones, onboarding, multi-local, DPA para clientes SaaS.

**Fase 4 — Diferenciadores**
Carta QR, pago desde mesa por el cliente, fidelización/fiado, reservas, delivery, datáfono integrado, Expo nativa (si hay necesidad probada).

> No intentes hacer todo a la vez. Cada fase que funciona en el bar real es una validación que vale oro.

---

## 7. 🤖 Cómo planificar con Opus y ejecutar con Sonnet (flujo y "indicaciones previas")

### El principio: separar PENSAR de TECLEAR
- **Opus** (caro, más listo): decisiones de arquitectura, esquema de base de datos, el módulo legal, y **escribir un plan detallado** y documentos de especificación. Úsalo poco pero para lo importante.
- **Sonnet** (barato, rápido): ejecutar ese plan, escribir el código rutinario, componentes de UI, tests. Aquí gastas la mayoría del trabajo pero a menor coste.

### Reglas para gastar menos tokens
- **Trabaja por tareas pequeñas y cerradas**, no "hazme el TPV entero".
- **Un plan aprobado antes de picar código**: Opus planifica, tú revisas, Sonnet ejecuta.
- **Reutiliza el `CLAUDE.md`** para no re-explicar el contexto cada vez.
- **Tests para el módulo legal**: que un fallo se detecte solo, sin rondas de depuración manual.

### Flujo de trabajo recomendado
1. Sesión con **Opus en modo plan**: "diseña el esquema de BD y la arquitectura para X" → revisas y apruebas.
2. Guardas el plan en el repo.
3. Sesiones con **Sonnet**: "implementa la tarea N del plan" → revisas → siguiente.
4. Vuelves a **Opus** solo cuando toque una decisión gorda nueva o el módulo legal.

---

## 8. 💰 Negocio y hardware (para venderlo)

- **Hardware barato**: apunta a que funcione en **tablets Android normales** + impresora térmica ESC/POS + cajón portamonedas estándar. No ates a los clientes a hardware propietario caro — ese es justo el dolor del mercado que puedes atacar.
- **Modelo de precio**: cuota mensual por local (SaaS), sin permanencias abusivas.
- **Responsabilidad legal del fabricante**: al vender, tú eres el "fabricante del SIF" y firmas la declaración responsable. Antes de vender a terceros, conviene **asesoría fiscal/legal** para cubrir esto bien (y para los contratos RGPD con los clientes).
- **Empieza con tu padre** como cliente cero y caso de éxito. Un bar real usándolo a diario es tu mejor argumento de venta y tu mejor banco de pruebas.

---

## 9. ✅ Checklist antes de escribir la primera línea de código

- [ ] Confirmar región y normativa (España común → **Veri*factu**). ✔ decidido.
- [ ] Confirmar objetivo (bar + SaaS). ✔ decidido.
- [ ] Aprobar el **stack** (React + TS + Supabase + Tailwind). ✔ decidido.
- [ ] Aprobar el **esquema de base de datos** (con Opus).
- [ ] Definir el **diseño del módulo de facturación legal** (hash + QR + AEAT).
- [ ] Crear el **`CLAUDE.md`** con convenciones y estructura. ✔ existe.
- [ ] Desglosar la **Fase 1 (MVP)** en tareas concretas.
- [ ] (Recomendado) Consulta con **asesor fiscal** sobre Veri*factu y la declaración responsable.
- [ ] (Prerrequisito Fase 2) **Certificado digital del obligado** (o apoderamiento ante la AEAT) para el envío de registros Veri*factu — verificar el procedimiento con gestor.

---

*Siguiente paso sugerido: Fase 0 — materializar el esquema en Drizzle, configurar Supabase y arrancar la app web.*
