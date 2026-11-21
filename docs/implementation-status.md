# Estado de implementación de ARCREDIX

Este documento distingue código existente, base de datos comprobada y trabajo pendiente. No marcar una función como terminada solo porque existe una ruta o una pantalla.

## Base técnica verificada

| Área | Estado | Evidencia |
|---|---|---|
| Next.js App Router + TypeScript | Build CI aprobado | `next build` correcto en el commit `95ef0ace0d30e94fcd259712fd29ea78f401e624` |
| Neon PostgreSQL | Configurado | Proyecto y rama principal inspeccionados |
| Neon Auth | Parcial | Login/recuperación y emisión server-side de JWT para RLS; flujo real de sesión+RLS pendiente de smoke test local |
| Allowlist de superadmin | Implementada | Validación server-side por correo |
| Autorización de tenant | Parcial con RLS | `arcredix_app` NOLOGIN/NOBYPASSRLS, JWT Neon Auth y políticas RLS aplicadas; aislamiento SQL probado en branch; smoke test con sesión real pendiente |
| Esquema inicial | Aplicado | Nueve tablas iniciales verificadas en Neon |
| Esquema operativo 0002 | Aplicado | Seis tablas nuevas e índices verificados |
| Integridad y billing 0003 | Aplicado | FKs compuestas, `subscription_payments` y `scheduled_jobs` verificados |
| Ledger de migraciones 0004 | Aplicado | `schema_migrations` registra 0001–0004 con Git blob SHA-1; runner `npm run migrate` implementado |
| RLS 0005 | Aplicado | 18 tablas con RLS ENABLE + FORCE; `schema_migrations` reservada al rol de migración; políticas de tenant y superadmin |
| Panel superadmin | Parcial | Comercios, planes y suscripciones tienen vistas administrativas |
| Comercios | Parcial | Listado, filtros y cambio de estado; alta integral y edición completa pendientes |
| Planes | Parcial | GET/POST/PATCH, alta, edición de precio/límite y activación desde el panel; precios anuales y pago único pendientes |
| Suscripciones | Parcial | Listado, cambio de estado y extensión manual de 30 días con auditoría; ciclo de vida automático y cambio de plan pendientes |
| Usuarios y permisos | Parcial | Roles y helper de autorización; administración e invitaciones pendientes |
| Conexiones de pago y QR | Parcial | Estructura de datos; CRUD e integración real pendientes |
| Firma webhook Mercado Pago | Helper y tests | Verificación HMAC y 4 pruebas unitarias; falta integración HTTP y consulta del pago original |
| Conciliación de pagos | Pendiente | No hay conciliación operativa con proveedor |
| Auditoría | Parcial | Cambios de comercio, planes y suscripciones generan registros |
| Notificaciones | Estructura aplicada | Outbox creado; worker y proveedores pendientes |
| Tareas programadas | Estructura aplicada | Cola persistente creada; worker y scheduler pendientes |
| Reportes y exportaciones | Pendiente | Sin implementación integral |
| Responsive | Parcial | Landing y paneles iniciales; revisión global pendiente |
| UTF-8 | Aprobado | CI inspeccionó 68 archivos de texto sin errores |
| Pruebas unitarias | Aprobadas | 8/8: 4 de firma y 4 del parser/checksum de migraciones |
| TypeScript | Aprobado | `tsc --noEmit` en GitHub Actions |
| ESLint | Aprobado | `eslint .` en GitHub Actions |
| Build | Aprobado en CI | `next build` en GitHub Actions con variables ficticias de CI |
| Integración real | Pendiente | No se probaron credenciales productivas ni sandbox de proveedores |
| Vercel | Sin deployment | No se ejecutó ningún deployment durante esta intervención |

## Hitos de desarrollo

### Hito A — Base confiable
- [x] Inspeccionar el repositorio y esquema real.
- [x] Corregir documentación principal dañada por mojibake.
- [x] Versionar y aplicar las migraciones operativas 0002 y 0003.
- [x] Probar migraciones en ramas temporales.
- [x] Aplicar migraciones a Neon main.
- [x] Ejecutar controles automáticos de UTF-8, pruebas, TypeScript, ESLint y build mediante GitHub Actions.
- [x] Aplicar y verificar ledger 0004 y RLS 0005 en Neon main; sin datos comerciales modificados.

### Hito B — Seguridad y acceso
- [x] Crear autorización reutilizable para superadmin y miembros.
- [x] Aplicar permisos por rol con overrides deny-only.
- [x] Agregar restricciones compuestas para evitar referencias cruzadas entre tenants.
- [x] Aplicar RLS ENABLE + FORCE en 18 tablas y rol de aplicación NOLOGIN/NOBYPASSRLS.
- [x] Probar políticas RLS en branch: dos tenants aislados, usuario sin membresía y superadmin.
- [ ] Smoke test de conexión de aplicación con sesión JWT real en copia local.
- [ ] Cubrir todos los endpoints con permisos y aislamiento tenant.
- [ ] Alta manual, invitaciones con token hash, expiración y revocación.

### Hito C — Administración y suscripciones
- [x] Listado y actualización de planes desde el superadmin.
- [x] Listado, cambio de estado y extensión manual de suscripciones con auditoría.
- [ ] Alta/edición integral de comercios y miembros.
- [ ] Precios anuales, licencia de pago único y cambios de plan.
- [ ] Ciclo de vida mensual, anual y pago único.
- [ ] Vencimientos automáticos, gracia, suspensión y reactivación.
- [x] Persistencia para pagos de suscripción y tareas programadas.
- [ ] Worker seguro para ejecutar tareas programadas.

### Hito D — Pagos y conciliación
- [x] Helper de validación de firma HMAC Mercado Pago con pruebas unitarias.
- [ ] Adaptadores reales y credenciales seguras.
- [ ] Webhooks HTTP con firma donde el producto lo permita.
- [ ] Consulta server-side del pago original.
- [ ] Idempotencia, conciliación y estados auditables.
- [ ] QR oficial estático/dinámico y asociación con cajas.

### Hito E — Operación y experiencia
- [x] Persistencia outbox y cola de trabajos.
- [ ] Workers de notificaciones y tareas.
- [ ] Reportes y exportaciones seguras.
- [ ] Revisión responsive y accesibilidad.
- [ ] Observabilidad, límites, backups y retención.

### Hito F — Release candidate
- [x] TypeScript sin errores en CI.
- [x] ESLint sin errores en CI.
- [x] UTF-8 y mojibake sin hallazgos en CI.
- [x] Build limpio en CI.
- [x] Pruebas unitarias iniciales.
- [ ] Suite de pruebas de negocio y autorización de endpoints.
- [x] Pruebas SQL de aislamiento RLS en branch de Neon.
- [ ] Sandbox de pagos validado.
- [ ] Revisión de seguridad y aislamiento.
- [ ] Checklist de variables de entorno y operaciones.
- [ ] Autorización expresa para publicar en Vercel.

## Bloqueos externos

La integración real de Mercado Pago, WhatsApp y correo productivo necesita credenciales, permisos y configuración de las cuentas propietarias. No se simulará su funcionamiento ni se marcarán como conectados hasta realizar pruebas reales.


## Integraciones financieras (implementación preparada)

| Área | Estado | Alcance real |
|---|---|---|
| Credenciales de proveedores | Código preparado | AES-256-GCM y tabla separada `payment_connection_secrets`; pendiente aplicar migración 0006 en Neon main |
| Gmail OAuth por comercio | Código preparado | OAuth offline, PKCE, `gmail.readonly`, refresh token cifrado y perfil de casilla |
| Gmail Push | Código preparado | Gmail Watch, Pub/Sub push con OIDC verificado por JWKS de Google y procesamiento de `history.list` |
| Remitentes bancarios | Código preparado | Lista exacta por comercio; mensajes no permitidos se ignoran |
| Avisos bancarios | Evidencia no verificada | Se guardan con estado `unknown`; nunca se aprueban por correo solamente; parser heurístico requiere pruebas por banco |
| Renovación Gmail Watch | Código preparado | Endpoint `/api/cron/gmail-watch`; requiere programar una ejecución diaria y configurar `ARCREDIX_CRON_SECRET` |
| Mercado Pago OAuth | Código preparado | Conexión individual de vendedores, credenciales cifradas y refresh de tokens |
| Mercado Pago webhook | Código preparado | Firma HMAC, identificación por `user_id`, consulta de pago original y conciliación de estado/importe/cuenta |
| Ualá Bis | No implementada | Catálogo informativo; no afirmar soporte para transferencias entrantes generales |
| Rol de webhooks | Código preparado | `arcredix_webhook` y `ARCREDIX_WEBHOOK_DATABASE_URL`; requiere aplicar migraciones 0006–0007 y configurar la URL privada |
| Pruebas externas | Pendientes | OAuth Google, Pub/Sub, Mercado Pago sandbox y flujo de caja todavía no ejecutados |

**No activar en producción** hasta aplicar y verificar migraciones, configurar credenciales externas, ejecutar pruebas sandbox y revisar la conciliación con caja.
