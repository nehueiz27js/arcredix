# ARCREDIX

ARCREDIX es una plataforma SaaS de control operativo y prevención de estafas para comercios.

**Marca:** ARCREDIX  
**Slogan:** Validá tus cobros. Evitá estafas.  
**Stack:** Next.js App Router, React, TypeScript, Tailwind CSS y Neon PostgreSQL.  
**Repositorio:** https://github.com/nehueiz27js/arcredix

## Requisitos

- Node.js 22 o superior
- npm 10 o superior

## Desarrollo local

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Copiar `.env.example` a `.env.local` y completar las conexiones de Neon.

3. Iniciar:

   ```bash
   npm run dev
   ```

4. Abrir http://localhost:3000.

## Variables de entorno

- `DATABASE_URL`: conexión pooled de Neon para consultas de la aplicación.
- `DATABASE_URL_UNPOOLED`: conexión directa reservada para migraciones y tareas administrativas.
- `NEXT_PUBLIC_APP_URL`: URL pública de la aplicación.

No subir `.env.local`, contraseñas, tokens ni credenciales al repositorio.

## Neon y esquema

La base Neon `arcredix` ya está provisionada en la región São Paulo (`aws-sa-east-1`). El esquema actual contiene:

- `plans`
- `merchants`
- `merchant_users`
- `payment_providers`
- `payment_connections`
- `registers`
- `qr_codes`
- `subscriptions`
- `audit_logs`

La migración inicial documentada está en `database/migrations/0001_initial_schema.sql`. El catálogo confirmado es Starter (USD 15/mes, 3 conexiones), Growth (USD 29/mes, 5 conexiones) y Business (USD 55/mes, conexiones ilimitadas). Las cajas y los QR no consumen conexiones adicionales. La licencia independiente de pago único se referencia en USD 390.

Para tráfico de la aplicación usar la URL pooled. Las migraciones y operaciones que requieran estado de sesión deben usar la URL directa. Revisar siempre el diff antes de aplicar cambios sobre producción.

## Endpoints disponibles

- `GET /api/health`: comprueba conexión a Neon y presencia del catálogo.
- `GET /api/public/plans`: devuelve el catálogo activo de planes en USD.

## Reglas funcionales confirmadas

- La demostración interactiva usa pesos argentinos (ARS), incluidos los importes anunciados por voz.
- Los precios de planes y licencia se expresan en dólares estadounidenses (USD).
- Un comprobante o QR escaneado no demuestra acreditación.
- La confirmación real requiere una notificación auténtica o consulta autorizada del proveedor financiero.
- Una conexión representa una cuenta/proveedor. No equivale a una caja ni a un QR.
- Los QR deben ser emitidos por el proveedor y respetar sus condiciones de vigencia y revocación.
- ARCREDIX no procesa pagos ni custodia fondos.

## Validaciones

```bash
npm run typecheck
npm run lint
npm run build
```

## Estado de implementación

La landing, identidad, demostración ficticia, cliente Neon, endpoint de salud, catálogo público y migración inicial están en el repositorio.

La autenticación real, los paneles privados, los webhooks financieros, la conciliación real, OCR, facturación, notificaciones y automatizaciones todavía requieren implementación e integración verificable. No se debe habilitar acceso a información de comercios hasta completar autenticación y autorización por rol.
