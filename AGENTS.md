# AGENTS.md — ARCREDIX

## Reglas obligatorias
- GitHub `admin-client-login-access` es la rama de trabajo autorizada. No cambiar de rama, hacer merge ni modificar `main` sin autorización expresa.
- No borrar ni resetear datos, tablas, comercios, suscripciones, pagos ni historial.
- No exponer secretos, tokens, identificadores de acceso ni credenciales en logs o respuestas públicas.
- No ejecutar DDL destructivo. Toda modificación de esquema requiere una migración SQL nueva, aditiva y versionada.
- No usar `arcredix_owner` para consultas de negocio. Cambiar a `arcredix_app` dentro de cada transacción autenticada. Verificar el JWT EdDSA en servidor y establecer `arc.auth_subject` dentro de la transacción. Los webhooks usan `arcredix_webhook`.
- Toda consulta de tenant deriva el comercio de la sesión autenticada; nunca confiar en IDs enviados por el navegador.
- El identificador de acceso ARCREDIX tiene 256 bits, se muestra una sola vez al crear y se conserva hash SHA-256 + copia AES-256-GCM recuperable desde Superadmin.
- Las credenciales de Mercado Pago se cifran en servidor. Webhooks se validan y contrastan con la API del proveedor antes de confirmar pagos.
- Separar páginas, componentes, validaciones, servicios y acceso a datos. Evitar lógica de dominio dentro de componentes visuales o route handlers.
- No reemplazar dependencias o proveedores de autenticación sin verificar compatibilidad oficial y migración de usuarios.
- No afirmar que una función está lista sin ejecutar su prueba correspondiente.
- Ejecutar `npm run check:encoding`, `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` antes de considerar un cambio validado.
- Los commits deben agrupar cambios coherentes y describirlos. No desplegar producción sin una prueba funcional completa y autorización.
