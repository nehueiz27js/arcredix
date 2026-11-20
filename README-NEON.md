# ARCREDIX — Neon PostgreSQL

## Estado actual verificado

- Proyecto Neon: `arcredix`
- Región: `aws-sa-east-1` (São Paulo)
- PostgreSQL: 18
- Rama: `main`
- Base: `arcredix`
- Esquemas: `public` y `neon_auth`
- Esquema de negocio: 15 tablas tras aplicar la migración operativa 0002
- Neon Auth: tablas de autenticación presentes

## Conexiones

- `DATABASE_URL`: pooled; usar en Next.js para consultas normales.
- `DATABASE_URL_UNPOOLED`: conexión directa; reservar para migraciones y tareas administrativas.

No publicar ni copiar credenciales a GitHub. `.env.local` está excluido por `.gitignore`.

## Archivos de integración

- `src/lib/db/client.ts`: cliente Neon server-only con inicialización diferida y validación de URL.
- `src/app/api/health/route.ts`: prueba conectividad y presencia del catálogo.
- `src/app/api/public/plans/route.ts`: lectura pública de planes activos.
- `database/migrations/0001_initial_schema.sql`: esquema inicial y catálogo.
- `database/migrations/0002_operational_core.sql`: pagos, webhooks idempotentes, invitaciones, outbox, eventos de suscripción y límites.
- `.env.example`: nombres de variables sin secretos.

## Comprobación

Con `DATABASE_URL` configurada:

```bash
npm run dev
```

Consultar `http://localhost:3000/api/health`. La ruta devuelve estado de conectividad y catálogo, sin datos sensibles ni detalles internos de errores.

## Precauciones

- No usar la conexión pooled para migraciones.
- Probar migraciones en una rama temporal antes de aplicarlas a la rama principal.
- La conexión a Neon no implica que la autenticación o las integraciones financieras estén completas.
- No asumir disponibilidad de otros productos Neon en esta región sin verificar compatibilidad.
