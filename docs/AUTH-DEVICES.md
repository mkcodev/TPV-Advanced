# Autenticación de dispositivos y empleados — next-TPV

Especificación del flujo de autenticación en dos niveles del TPV: registro de terminales y login de empleados por PIN.

---

## 1. Alta y registro de dispositivos

Un terminal (caja, tablet de camarero, KDS) debe **emparejarse** con un negocio antes de poder usarse.

### Flujo de emparejamiento

1. El administrador (rol `admin` u `owner`) accede al panel web y genera un **código de emparejamiento** de un solo uso (6–8 dígitos, caduca en 15 minutos).
2. En el terminal nuevo, se introduce el código de emparejamiento.
3. El servidor valida el código → crea una fila en `devices` con el `business_id` del admin → devuelve un **token de dispositivo** persistente.
4. El token se almacena de forma segura en el dispositivo (keychain en Electron, `localStorage` cifrado en PWA).
5. Todas las solicitudes del terminal incluyen el token de dispositivo en la cabecera. El servidor lo resuelve al `device_id` y `business_id` correspondientes.

**Reglas:**
- El token de dispositivo no expira automáticamente (vida útil del hardware), pero el admin puede revocarlo desde el panel en cualquier momento.
- Un código de emparejamiento solo puede usarse una vez.
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
| Anular línea ya enviada a cocina | manager | No (solo rol) |
| Aplicar descuento en comanda/línea | manager | No |
| Cerrar sesión de caja (arqueo Z) | manager | Sí |
| Acceder a configuración del negocio | admin | Sí |
| Revocar dispositivo | admin | Sí (desde panel web) |
| Ver informe de ventas por empleado | manager | No |

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
