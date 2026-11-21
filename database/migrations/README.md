# Migraciones ARCREDIX

- `0001_initial_schema.sql`: catálogo comercial, comercios, usuarios, proveedores, conexiones, cajas, QR, suscripciones y auditoría.
- `0002_operational_core.sql`: transacciones, eventos webhook idempotentes, invitaciones, outbox de notificaciones, eventos de suscripción y overrides de límites.
- `0003_tenant_integrity_and_billing.sql`: claves foráneas compuestas para aislamiento entre tenants, pagos de suscripciones y cola persistente de tareas programadas.
- `0004_migration_ledger.sql`: ledger `public.schema_migrations` y baseline verificado de 0001–0003.
- `0005_tenant_rls.sql`: roles, funciones de autorización y políticas RLS.
- `0006_client_access_identifiers.sql`: identificadores de acceso ARCREDIX, hash y almacenamiento cifrado.
- `0007_financial_integrations.sql`: proveedores de pago, secretos OAuth cifrados, Gmail push y funciones acotadas para procesar integraciones.
- `0008_integration_maintenance.sql`: rol restringido de webhooks y funciones de mantenimiento de integraciones.
- `0009_verified_auth_context.sql`: contexto de sujeto verificado por el servidor para RLS, sin depender de la inicialización JWK de `pg_session_jwt`.

## Reglas del runner

- Cada versión numérica debe ser única. No reutilizar números ni renombrar migraciones ya registradas.
- `npm run migrate` requiere `DATABASE_URL_UNPOOLED` con conexión directa (sin `-pooler`) y rol propietario.
- El runner calcula el Git blob SHA-1, detecta cambios en migraciones registradas y aplica cada migración junto con su registro en una transacción.
- Las migraciones históricas 0001–0003 no se ejecutan automáticamente si no están registradas.
- Probar primero en una branch temporal de Neon y revisar tablas, índices, funciones, roles, grants y políticas antes de aplicar a otra branch.
- No ejecutar DDL destructivo ni resetear datos.
