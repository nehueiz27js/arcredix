# Arquitectura de ARCREDIX

## Principios

1. **Multi-tenant por comercio:** toda consulta de negocio debe quedar limitada por el `merchant_id` derivado de la sesión autenticada. Nunca confiar en un `merchant_id` enviado libremente por el navegador.
2. **Server-first:** acceso a Neon, secretos, autorización y proveedores de pago solo desde código de servidor.
3. **Separación de responsabilidades:** rutas HTTP validan entrada y autorización; servicios implementan casos de uso; repositorios encapsulan SQL; adaptadores conectan proveedores externos.
4. **Trazabilidad:** cambios administrativos, cambios de suscripción y eventos de pago deben dejar registros auditables.
5. **Idempotencia:** webhooks, pagos y notificaciones deben poder procesarse más de una vez sin duplicar efectos.
6. **Fail closed:** si no se puede validar sesión, permisos, firma o estado de proveedor, no se debe confirmar una operación.

## Estructura objetivo

```text
src/
  app/
    (public)/                 Landing, login y recuperación
    admin/                    Consola de superadministración
    dashboard/                Espacio privado del comercio
    api/
      admin/                  Endpoints exclusivos de plataforma
      merchant/               Endpoints limitados al tenant
      webhooks/                Entradas autenticadas de proveedores
  components/
    admin/                    Componentes del superadmin
    auth/                     Formularios y controles de sesión
    dashboard/                Componentes del comercio
    ui/                       Primitivos reutilizables
  config/                     Configuración tipada y catálogos
  domain/
    merchants/                 Tipos y reglas de comercios
    payments/                  Estados y reglas de pagos
    subscriptions/             Ciclo de vida de suscripciones
  hooks/                       Hooks de interfaz
  lib/
    auth/                      Sesión y autorización
    db/                        Cliente Neon y repositorios
    payments/                  Contratos y adaptadores
    validations/               Esquemas Zod
  services/
    admin/                     Casos de uso del superadmin
    merchants/                 Casos de uso del comercio
    payments/                  Conciliación y validación
    subscriptions/             Renovaciones y vencimientos
    notifications/             Outbox y entrega
  types/                       Tipos compartidos
database/
  migrations/
scripts/
docs/
```

La estructura se implementa de forma incremental: no crear módulos vacíos solo para aparentar cobertura. Cada carpeta debe contener código o documentación que explique su responsabilidad.

## Límites de confianza

- El cliente web no tiene acceso directo a la base de datos ni a secretos.
- El cliente presenta únicamente un identificador aleatorio ARCREDIX de 256 bits. El backend busca su hash, valida comercio y membresía, y realiza el inicio de sesión interno en Neon Auth; correo y contraseña no se exponen en la interfaz.
- `merchant_users` conserva el hash SHA-256 del identificador y una copia cifrada AES-256-GCM para que el superadmin pueda volver a consultarlo. La clave de cifrado se deriva de `NEON_AUTH_COOKIE_SECRET`; no se guarda en Neon.
- Neon Auth emite la sesión HttpOnly utilizada por las rutas y por RLS. ARCREDIX resuelve el rol y la pertenencia al comercio en `merchant_users`.
- El superadministrador conserva un acceso independiente con credenciales Neon Auth y se autoriza en servidor mediante allowlist privada. No se deriva de un campo enviado por el cliente.
- El acceso a datos del comercio se limita a la membresía activa y al estado activo del comercio.
- Las credenciales de proveedores deben residir en un almacén de secretos o mecanismo cifrado administrado. `credential_reference` es solo una referencia, no un token.
- Los webhooks se consideran no confiables hasta validar su firma y consultar el pago original en el proveedor.

## Roles de comercio

| Rol | Alcance |
|---|---|
| owner | Administración total del comercio y equipo |
| admin | Operación y configuración, sin transferir titularidad |
| manager | Operación, cajas, QR, reportes y equipo según permisos |
| operator | Operaciones de cobro y consulta operativa |
| viewer | Solo lectura |

Los permisos explícitos por usuario pueden restringir la matriz del rol. Una denegación explícita siempre prevalece.

## Dominios funcionales

### Plataforma
Comercios, altas manuales, usuarios, roles, planes, suscripciones, límites, auditoría y configuración.

### Comercio
Resumen, miembros, conexiones de pago, alias, QR oficiales, cajas, transacciones, conciliación e historial exportable.

### Pagos
Normalización de estados del proveedor, verificación de webhooks, consulta del recurso original, idempotencia, conciliación y auditoría.

### Suscripciones
Alta, períodos, renovación, gracia, vencimiento, suspensión, reactivación, extensiones y registro histórico.

### Notificaciones
Outbox persistente, consentimiento, plantillas, deduplicación, reintentos limitados y estados de entrega. No se envían mensajes sin proveedor configurado y autorización válida.

## Flujo de confirmación de pago

1. El comercio genera o registra una operación esperada con importe y referencia.
2. El proveedor procesa el pago.
3. ARCREDIX recibe un webhook o consulta programada.
4. Se valida la autenticidad del evento y se registra su identificador único.
5. El servidor consulta el recurso original al proveedor.
6. Se comparan importe, moneda, cuenta, referencia y estado.
7. La operación pasa a aprobada solo con evidencia verificable del proveedor.
8. Se registra el evento y se actualizan las vistas del comercio.

Leer un QR, cargar un comprobante o recibir una captura nunca debe marcar una operación como acreditada.

## Procesos asíncronos

Los vencimientos, recordatorios, reintentos de notificación y conciliaciones no pueden depender de que el usuario tenga el panel abierto. Se ejecutarán mediante tareas programadas seguras, con locks, idempotencia, límites de reintento y observabilidad.

## Acceso a base de datos y RLS

- El rol propietario `arcredix_owner` tiene `BYPASSRLS`; no debe usarse para consultas de usuario.
- Las consultas de aplicación se ejecutan con `arcredix_app` (`NOLOGIN`, `NOBYPASSRLS`) mediante `options=-c role=arcredix_app`.
- En rutas autenticadas, el servidor obtiene el JWT de Neon Auth y lo pasa al cliente `@neondatabase/serverless` mediante `authToken`.
- `pg_session_jwt` expone el sujeto validado a funciones SQL `SECURITY DEFINER` con `search_path` fijo. Las políticas consultan membresía activa, rol del comercio o registro de superadmins.
- Los planes y proveedores activos tienen lectura pública; operaciones de plataforma requieren la fila de superadmin activa.
- `schema_migrations` no tiene RLS, pero no se concede al rol de aplicación.
- Las políticas fueron probadas en una branch de Neon con dos tenants de prueba. Falta el smoke test local con el JWT real de Neon Auth antes de desplegar.

## Persistencia y migraciones

Las migraciones SQL versionadas son la fuente reproducible del esquema. `public.schema_migrations` registra versión, nombre, Git blob SHA-1, fecha y rol ejecutor. `npm run migrate` requiere `DATABASE_URL_UNPOOLED` (conexión directa, sin `-pooler`) y aplica cada archivo junto con su registro en una transacción.

Antes de una migración se debe probar en una rama temporal de Neon, revisar el resultado y luego aplicarla a la rama principal. No editar manualmente el esquema sin agregar su migración correspondiente.


## Endpoints administrativos disponibles

- `GET /api/admin/merchants`: cartera, filtros y estadísticas.
- `PATCH /api/admin/merchants`: cambio de estado con motivo y auditoría.
- `GET /api/admin/plans`: catálogo y cantidad de suscripciones actuales.
- `POST /api/admin/plans`: alta de plan.
- `PATCH /api/admin/plans`: edición de precio, límites, características y activación.
- `GET /api/admin/subscriptions`: listado filtrable de suscripciones.
- `PATCH /api/admin/subscriptions`: cambio de estado o extensión manual del período.

Las pantallas `/admin/planes` y `/admin/suscripciones` consumen esos endpoints. La administración de planes y suscripciones es parcial: no sustituye los flujos automáticos de renovación, facturación o integración con proveedores.
