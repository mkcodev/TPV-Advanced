# Autenticación de dispositivos y empleados — next-TPV

Especificación del flujo de autenticación en dos niveles del TPV: registro de terminales y login de empleados por PIN.

---

## 1. Alta y registro de dispositivos

Un terminal (caja, tablet de camarero, KDS) debe **emparejarse** con un negocio antes de poder usarse.

### Flujo de emparejamiento

1. El administrador (owner/admin del **panel web**; un terminal no puede) abre `/admin/devices` y genera un **código de emparejamiento** de un solo uso (8 dígitos, caduca en 15 minutos). El panel muestra el código con cuenta atrás.
2. En el terminal nuevo, se introduce el código de emparejamiento.
3. El servidor valida el código → crea una fila en `devices` con el `business_id` del admin → devuelve un **token de dispositivo** persistente.
4. El token se almacena de forma segura en el dispositivo (keychain en Electron, `localStorage` cifrado en PWA).
5. Todas las solicitudes del terminal incluyen el token de dispositivo en la cabecera. El servidor lo resuelve al `device_id` y `business_id` correspondientes.

**Reglas:**
- El token de dispositivo no expira automáticamente (vida útil del hardware), pero el admin puede revocarlo desde el panel en cualquier momento.
- Un código de emparejamiento solo puede usarse una vez: el canje es un `UPDATE ... WHERE id = (SELECT ... LIMIT 1 FOR UPDATE SKIP LOCKED)`, atómico y de una sola fila.
- Al generar un código se comprueba que no coincida con otro activo (de cualquier negocio): `pairDevice` busca el código sin negocio, así que serían ambiguos. Se regenera hasta 3 veces. (Comprobar+insertar no es atómico; con 10^8 códigos el riesgo es despreciable. Un índice único parcial lo cerraría del todo si hiciera falta.)
- Revocar (`/admin/devices`) anula el hash del token y desactiva el terminal; la siguiente petición del terminal cae en `anonymous` y el TPV vuelve a la pantalla de vincular. No cierra la sesión de caja que tuviera abierta: el panel avisa.
- El modo "pegar token" de la pantalla de vincular solo existe en desarrollo (`NODE_ENV === 'development'`).
- El `business_id` **nunca** se acepta como parámetro del cliente; siempre se deriva del token del dispositivo.

---

## 2. Login de empleado por PIN

Una vez el dispositivo está emparejado, el empleado se autentica con su PIN.

### Flujo

1. La pantalla de selección de empleado muestra los avatares de los empleados activos del negocio (obtenidos del servidor al arrancar o al cambiar de turno).
2. El empleado toca su avatar → aparece el teclado numérico de PIN.
3. El PIN se envía al servidor **en texto plano por HTTPS** (nunca se hashea en cliente); el servidor lo valida contra `employees.pin_hash` con argon2/bcrypt.
4. Si es correcto: la sesión de empleado queda activa en el dispositivo (en memoria o en un estado efímero con TTL corto).
5. Toda acción posterior lleva el `employee_id` y el `device_id` identificados.

> **Por qué verificar en servidor y no en cliente:** hashear en cliente no aporta seguridad real (el hash se puede reutilizar) y dificulta el lockout centralizado. La conexión es HTTPS y la red local es de confianza.

### Gestión de empleados y unicidad del PIN

- Los empleados se crean, editan, desactivan y cambian de PIN **solo desde el panel** (`/admin/employees`, `panelAdminProcedure`: owner/admin de la organización). Un terminal nunca gestiona personal, ni siquiera con un empleado de rol `admin`.
- **Nunca se borran:** hay ventas y `system_events` que los referencian. Desactivar saca al empleado del selector y corta su sesión PIN en la siguiente petición (el resolver exige empleado activo y del mismo negocio).
- **No se impone PIN único por negocio.** El login es "elige empleado + PIN": el PIN solo se valida contra el hash de ese empleado. Además el hash lleva sal, así que no existe un índice UNIQUE posible; comprobarlo exigiría verificar el PIN contra todos los hashes del negocio.
- Cambiar el PIN resetea `failed_pin_attempts` y `locked_until` (también sirve para desbloquear).
- Si no queda ningún manager/admin activo, el panel avisa: nadie podría autorizar anulaciones.

### Lockout tras intentos fallidos

```
Intento fallido → incrementar employees.failed_pin_attempts
≥ 5 intentos fallidos → escribir employees.locked_until = NOW() + INTERVAL '15 minutes'
Al verificar PIN → si locked_until > NOW() → rechazar con mensaje "cuenta bloqueada hasta HH:MM"
Login exitoso → resetear failed_pin_attempts = 0, locked_until = NULL
```

El umbral (5 intentos, 15 minutos) es configurable en configuración del negocio.

### Rate limiting

Además del lockout por `employee_id`, el endpoint de verificación de PIN debe limitar intentos por IP + `device_id`: máximo 20 intentos por minuto. El contador se guarda en BD (sin dependencia de Redis u otro sistema externo en Fase 1); en Fase 3 evaluar Redis si el volumen lo justifica.

---

## 3. Acciones sensibles — re-verificación de rol

Determinadas acciones requieren que el empleado tenga rol `manager` o `admin`, y en algunos casos re-verifican el PIN en el momento de la acción (no solo al inicio de turno).

| Acción | Rol mínimo | Re-verifica PIN |
|---|---|---|
| Anular una línea ya guardada (pendiente o enviada) | manager | **Sí, en el momento**: el encargado teclea su PIN (o ya está logueado como encargado y se autoriza él mismo) |
| Aplicar descuento en comanda/línea | manager | No |
| Cerrar sesión de caja (arqueo Z) | manager | Sí |
| Acceder a configuración del negocio | admin | Sí |
| Revocar dispositivo | admin | Sí (desde panel web) |
| Ver informe de ventas por empleado | manager | No |

> **Anulación de líneas (`orders.voidLine`).** Una línea queda *fijada* en cuanto se guarda la comanda o se envía a cocina, tenga o no destino de impresión (las cañas de barra también). El `upsert` ya no puede borrarla ni bajarla; solo `voidLine`. El servidor exige motivo y aprobador manager/admin (mismo negocio, activo). El PIN del aprobador pasa por `verifyEmployeePin`, que comparte rate-limit, lockout y contador de fallos con el login, y se verifica **antes** de abrir la transacción para que el contador de intentos sobreviva a un error. `order_events` registra `item_voided` con `employee_id` = quien lo pidió y `approvedBy` + `reason` en el payload; la línea queda `cancelled` con `voided_by` = aprobador (CHECK `order_items_voided_check`).

> Esta matriz es la mínima recomendada; el negocio puede endurecerla desde el panel. La verificación se hace **en el servidor** (middleware del router tRPC), nunca ocultando solo el botón en el cliente.

---

## 4. Auto-bloqueo de sesión de empleado

Si el terminal lleva X minutos sin actividad, la sesión del empleado se cierra automáticamente y vuelve a la pantalla de selección de avatares. El tiempo de inactividad es configurable por negocio (default: 5 minutos). No afecta las comandas abiertas.

---

## 5. Consideraciones de seguridad

- **PIN mínimo de 4 dígitos** — aceptable para un entorno de confianza (staff del bar). Para el panel admin (email + contraseña) se aplica la política de contraseñas de Supabase Auth.
- El `pin_hash` nunca se envía al cliente, ni siquiera al listar empleados.
- Las sesiones de empleado no tienen token propio; se mantienen en estado efímero en el terminal. Al revocar el dispositivo, todas las sesiones de ese terminal quedan invalidadas.
- Los eventos de login, lockout y revocación se registran en `system_events`.

---

*Para el modelo de datos completo de `employees` y `devices`, ver `docs/DATABASE-SCHEMA.md` módulo 1.*
