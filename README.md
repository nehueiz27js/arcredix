# ARCREDIX

ARCREDIX es una plataforma SaaS de control operativo y prevención de estafas para comercios.

**Marca:** ARCREDIX  
**Slogan:** Validá tus cobros. Evitá estafas.  
**Stack:** Next.js App Router, React, TypeScript, Tailwind CSS y Neon PostgreSQL.  
**Repositorio:** https://github.com/nehueiz27js/arcredix

## Requisitos

- Node.js 22 o superior.
- npm 10 o superior.

## Desarrollo local

1. Instalar dependencias:

   ```bash
   npm ci
   ```

2. Copiar `.env.example` a `.env.local` y completar las variables privadas.
3. Iniciar:

   ```bash
   npm run dev
   ```

4. Abrir http://localhost:3000.

## Comandos de calidad

```bash
npm run check:encoding
npm run typecheck
npm run lint
npm run build
```

La verificación de codificación detecta archivos de texto que no sean UTF-8 válido y patrones habituales de texto dañado por conversiones incorrectas. El workflow de GitHub ejecuta estas comprobaciones en cada push y pull request.

## Variables de entorno

- `DATABASE_URL`: conexión pooled de Neon para consultas de la aplicación.
- `NEON_AUTH_BASE_URL`: endpoint de Neon Auth.
- `NEON_AUTH_COOKIE_SECRET`: secreto aleatorio de al menos 32 caracteres.
- `NEXT_PUBLIC_APP_URL`: URL pública de la aplicación.
- `ARCREDIX_SUPERADMIN_EMAILS`: lista privada, separada por comas, de correos autorizados como superadministradores.

No subir `.env.local`, contraseñas, tokens ni credenciales al repositorio.

## Base de datos

La base Neon `arcredix` está provisionada en `aws-sa-east-1`.

Migraciones versionadas:

- `database/migrations/0001_initial_schema.sql`: catálogo comercial, comercios, usuarios, conexiones, cajas, QR, suscripciones y auditoría.
- `database/migrations/0002_operational_core.sql`: transacciones, eventos webhook idempotentes, invitaciones seguras, outbox de notificaciones, historial de suscripciones y límites particulares.

Las migraciones deben probarse en una rama temporal de Neon antes de aplicarse a la rama principal. No ejecutar DDL destructivo sin autorización explícita.

## Catálogo comercial confirmado

| Plan | Precio | Conexiones |
|---|---:|---:|
| Starter | USD 15/mes | 3 |
| Growth | USD 29/mes | 5 |
| Business | USD 55/mes | Ilimitadas |
| Licencia de pago único | USD 390 | Según condiciones comerciales |

Una cuenta de proveedor conectada a cinco cajas cuenta como una conexión. Las cajas y los QR no consumen conexiones.

## Seguridad de pagos

Un comprobante o QR leído no demuestra que el dinero esté acreditado. La confirmación de una operación requiere consultar una fuente confiable del proveedor o recibir y validar una notificación auténtica, y luego conciliar el pago con la operación esperada.

ARCREDIX no debe almacenar tokens de proveedores en texto plano ni registrar secretos en logs. La integración de producción requiere credenciales propias, configuración de webhooks y pruebas controladas.

## Documentación técnica

- [Arquitectura](docs/architecture.md)
- [Seguridad e integraciones](docs/security-and-integrations.md)
- [Estado de implementación](docs/implementation-status.md)
- [Migraciones](database/migrations/README.md)

## Estrategia de publicación

GitHub `main` es la fuente principal del código. La copia local se sincroniza con `git pull --ff-only`. Vercel se utilizará para producción únicamente después de completar las pruebas y contar con autorización expresa.
