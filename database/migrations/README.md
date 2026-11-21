# Migraciones ARCREDIX

- `0001_initial_schema.sql`: catálogo comercial, comercios, usuarios, proveedores, conexiones, cajas, QR, suscripciones y auditoría.
- `0002_operational_core.sql`: transacciones, eventos webhook idempotentes, invitaciones, outbox de notificaciones, eventos de suscripción y overrides de límites.
- `0003_tenant_integrity_and_billing.sql`: claves foráneas compuestas para aislamiento entre tenants, pagos de suscripciones cobradas por ARCREDIX y cola persistente de tareas programadas.
- Las tres migraciones están versionadas en GitHub. No reescribir archivos de migración ya aplicados.
- Las migraciones 0002 y 0003 fueron probadas en ramas temporales de Neon y luego aplicadas a la rama principal. Se verificaron tablas, índices y restricciones.
- Para tráfico de aplicación usar `DATABASE_URL` pooled. Reservar `DATABASE_URL_UNPOOLED` para migraciones y tareas administrativas que necesiten conexión directa.
- Cada cambio futuro debe agregarse en un archivo numerado nuevo.
- `0004_migration_ledger.sql` incorpora el ledger `public.schema_migrations` y registra como baseline las migraciones 0001–0003 solo después de verificar las tablas y restricciones existentes.
- Ejecutar `npm run migrate` desde un entorno seguro con `DATABASE_URL_UNPOOLED` configurada (conexión directa, sin `-pooler`). El runner calcula el Git blob SHA-1 de cada archivo, detecta cambios en migraciones registradas y aplica cada migración junto con su registro en una transacción.
- El runner no modifica la rama principal de Neon por sí mismo en CI; se ejecuta explícitamente contra la base elegida. No usar la URL pooled para DDL.
- Toda migración debe probarse en una rama temporal, revisar sus resultados y documentar el resultado antes de aplicarse a la rama principal.
- No ejecutar DDL destructivo sin autorización explícita.


## Migraciones de integraciones financieras

- `0006_financial_integrations.sql`: catálogo de proveedores, secretos OAuth cifrados, Gmail push y funciones acotadas para registrar evidencia/consultar conexiones desde callbacks autenticados.
- `0007_integration_maintenance.sql`: rol de base de datos restringido para webhooks y función de renovación de Gmail Watch y actualización segura de credenciales.
- Ejecutar `npm run migrate` solo después de revisar las migraciones y configurar `DATABASE_URL_UNPOOLED` con el usuario propietario.
