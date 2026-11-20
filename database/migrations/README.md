# Migraciones ARCREDIX

- `0001_initial_schema.sql`: catálogo comercial, comercios, usuarios, proveedores, conexiones, cajas, QR, suscripciones y auditoría.
- `0002_operational_core.sql`: transacciones, eventos webhook idempotentes, invitaciones, outbox de notificaciones, eventos de suscripción y overrides de límites.
- Ambas migraciones están versionadas en GitHub. No reescribir archivos de migración ya aplicados.
- La migración 0002 fue probada en una rama temporal de Neon y luego aplicada a la rama principal. Se verificaron tablas e índices.
- Para tráfico de aplicación usar `DATABASE_URL` pooled. Reservar `DATABASE_URL_UNPOOLED` para migraciones y tareas administrativas que necesiten conexión directa.
- Cada cambio futuro debe agregarse en un archivo numerado nuevo.
- Toda migración debe probarse en una rama temporal, revisar sus resultados y documentar el resultado antes de aplicarse a la rama principal.
- No ejecutar DDL destructivo sin autorización explícita.
