# ARCREDIX — base de conexión con Neon

## Archivos incluidos
- `src/lib/db/client.ts`: cliente PostgreSQL server-only con inicialización diferida.
- `src/app/api/health/route.ts`: endpoint de diagnóstico que ejecuta `SELECT 1`.
- `.env.example`: plantilla sin credenciales.

## Aplicación
1. Copiar los archivos del ZIP sobre la raíz de `C:\arcredix`.
2. Desde PowerShell, en `C:\arcredix`, ejecutar:

   ```powershell
   npm install @neondatabase/serverless server-only
   ```

3. Crear `.env.local` copiando `.env.example`.
4. Completar `DATABASE_URL` con la cadena pooled de Neon. No usar una URL pública ni subir este archivo a Git.
5. Ejecutar:

   ```powershell
   npm run typecheck
   npm run lint
   npm run build
   npm run dev
   ```

6. Abrir `http://localhost:3000/api/health`. La respuesta esperada cuando la conexión está configurada es `status: "ok"` y `database: "connected"`.

## Seguridad
- El cliente de Neon solo puede importarse desde módulos del servidor.
- El endpoint no devuelve la cadena de conexión ni el detalle interno del error.
- Este endpoint comprueba conectividad; no reemplaza autenticación ni autorización.
- No se habilitan todavía registros, sesiones ni acceso a datos de comercios.
