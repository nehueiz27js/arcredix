# ARCREDIX — Neon PostgreSQL

## Estado actual verificado

- Proyecto Neon: `arcredix`
- Región: `aws-sa-east-1` (São Paulo)
- PostgreSQL: 18
- Rama: `main`
- Base: `arcredix`
- Esquema público: nueve tablas operativas
- Pooling: habilitado

## Conexiones

- `DATABASE_URL`: pooled; usar en Next.js/Vercel para consultas normales.
- `DATABASE_URL_UNPOOLED`: conexión directa; reservar para migraciones, dumps y operaciones que requieran estado de sesión.

No publicar ni copiar credenciales a GitHub. `.env.local` está excluido por `.gitignore`.

## Archivos de integración

- `src/lib/db/client.ts`: cliente Neon server-only con inicialización diferida y validación de URL.
- `src/app/api/health/route.ts`: prueba conectividad y presencia del catálogo.
- `src/app/api/public/plans/route.ts`: lectura pública de planes activos.
- `database/migrations/0001_initial_schema.sql`: esquema inicial idempotente y seeds del catálogo.
- `.env.example`: nombres de variables sin secretos.

## Comprobación

Con `DATABASE_URL` configurada:

```bash
npm run dev
```

Consultar `http://localhost:3000/api/health`. Respuesta esperada:

```json
{
  "status": "ok",
  "database": "connected",
  "catalog": "ready"
}
```

La ruta no devuelve datos sensibles ni detalles internos de errores.

## Precauciones

- No usar la conexión pooled para migraciones.
- Revisar los cambios SQL antes de ejecutarlos en la base principal.
- La conexión a Neon no implica que la autenticación o las integraciones financieras estén implementadas.
- La región actual es adecuada para PostgreSQL. No asumir disponibilidad de otros productos Neon (Auth administrado, Functions, Realtime u Object Storage) en esta región sin verificar compatibilidad.
