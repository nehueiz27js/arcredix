# Migraciones ARCREDIX

- `0001_initial_schema.sql`: esquema inicial, índices y catálogo base.
- El archivo es idempotente para poder contrastarlo con el esquema que ya fue provisionado en Neon.
- No ejecutar contra producción sin revisar primero el diff. La base actual ya contiene estas nueve tablas y los seeds iniciales.
- Para tráfico de aplicación usar `DATABASE_URL` pooled. Reservar `DATABASE_URL_UNPOOLED` para migraciones y tareas administrativas que necesiten conexión directa.
- Cada cambio futuro debe agregarse en un archivo numerado nuevo; no reescribir una migración ya aplicada.
