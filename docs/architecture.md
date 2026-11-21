# Arquitectura de ARCREDIX

## Principios

1. **Multi-tenant por comercio:** toda consulta de negocio queda limitada por el `merchant_id` derivado de la sesión autenticada. Nunca confiar en un `merchant_id` enviado libremente por el navegador.
2. **Server-first:** acceso a Neon, secretos, autorización y proveedores de pago solo desde código de servidor.
3. **Separación de responsabilidades:** rutas HTTP validan entrada y autorización; servicios implementan casos de uso; repositorios encapsulan SQL; adaptadores conectan proveedores externos.
4. **Trazabilidad:** cambios administrativos, cambios de suscripción y eventos de pago dejan registros auditables.
5. **Idempotencia:** webhooks, pagos y notificaciones se procesan más de una vez sin duplicar efectos.
6. **Fail closed:** si no se puede validar sesión, permisos, firma o estado de proveedor, no se confirma una operación.

## Límites de confianza

- El navegador solo recibe un identificador ARCREDIX aleatorio de 256 bits (43 caracteres base64url). No recibe email ni contraseña.
- El backend calcula SHA-256, valida membresía y estado del comercio, y realiza el inicio de sesión interno con Neon Auth.
- `merchant_users` conserva el hash SHA-256 y una copia AES-256-GCM del identificador para recuperación administrativa. La clave se deriva de `NEON_AUTH_COOKIE_SECRET`; rotar esa clave requiere un procedimiento de re-cifrado.
- Neon Auth emite la sesión HttpOnly. El servidor obtiene el JWT mediante `auth.token()`, verifica EdDSA contra el JWKS de la misma instancia, valida issuer y expiración y solo entonces crea el contexto SQL.
- Cada consulta autenticada abre una transacción, ejecuta `SET LOCAL ROLE arcredix_app` y establece `request.jwt.claims` con los claims ya verificados. Nunca se configura `role` en el startup packet.
- El rol `arcredix_app` es `NOLOGIN NOBYPASSRLS`; la conexión directa del servidor usa el usuario propietario únicamente para cambiar localmente al rol de aplicación. El secreto de conexión no se expone al navegador.
- El superadministrador conserva acceso independiente por Neon Auth y allowlist validada en servidor.
- Los webhooks usan el rol `arcredix_webhook`, sin sesión de usuario y con permisos limitados a funciones `SECURITY DEFINER` expresamente concedidas.
- Las credenciales de proveedores se cifran AES-256-GCM con `ARCREDIX_CREDENTIALS_ENCRYPTION_KEY`. No se devuelven al navegador.
- Los webhooks se consideran no confiables hasta validar firma y consultar el pago original en el proveedor.

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

- **Plataforma:** comercios, usuarios, roles, planes, suscripciones, límites, auditoría y configuración.
- **Comercio:** resumen, miembros, conexiones de pago, alias, QR, cajas, transacciones, conciliación e historial.
- **Pagos:** normalización de estados, verificación de webhooks, consulta del recurso original, idempotencia y conciliación.
- **Suscripciones:** alta, períodos, renovación, gracia, vencimiento, suspensión, reactivación y registro histórico.
- **Notificaciones:** outbox persistente, consentimiento, plantillas, deduplicación y reintentos limitados.

## Flujo de confirmación de pago

1. El comercio genera o registra una operación esperada con importe y referencia.
2. El proveedor procesa el pago.
3. ARCREDIX recibe el webhook o consulta programada.
4. Se valida la firma y se registra el evento único.
5. El servidor consulta el recurso original al proveedor.
6. Se comparan importe, moneda, cuenta, referencia y estado.
7. Solo una respuesta verificable del proveedor puede marcar el pago como aprobado.
8. Se registra el evento y se actualizan las vistas del comercio.

Leer un QR, cargar un comprobante o recibir una captura nunca marca una operación como acreditada.

## Persistencia y migraciones

Las migraciones SQL versionadas son la fuente reproducible del esquema. `public.schema_migrations` registra versión, nombre, Git blob SHA-1, fecha y rol ejecutor. `npm run migrate` requiere `DATABASE_URL_UNPOOLED` directa y aplica cada archivo junto con su registro en una transacción.

Cada migración tiene una versión numérica única. Las migraciones históricas no se reescriben ni se vuelven a ejecutar sobre una base existente. Los cambios se agregan con versiones nuevas, se prueban en una branch Neon y luego se aplican a la branch objetivo. No se ejecuta DDL destructivo.

## Estructura de módulos

```
src/
  app/                 páginas, layouts y route handlers delgados
  components/          interfaz por dominio
  config/              configuración tipada
  domain/              reglas y tipos de negocio
  hooks/               estado de interfaz reutilizable
  lib/
    auth/              sesión, tokens y autorización
    db/                conexión y acceso a datos
    payments/          cifrado y adaptadores de proveedores
    validations/       esquemas Zod
  services/             casos de uso por dominio
  types/                contratos compartidos
database/
  migrations/           cambios versionados y reproducibles
scripts/
  tests/                pruebas automatizadas
docs/
```

Los módulos se incorporan con funcionalidad real; no crear carpetas vacías para simular avance.
