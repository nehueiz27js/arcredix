# Estado de implementación de ARCREDIX

Este documento distingue código existente, base de datos comprobada y trabajo pendiente. No marcar una función como terminada solo porque existe una ruta o una pantalla.

## Base técnica verificada

| Área | Estado | Evidencia |
|---|---|---|
| Next.js App Router + TypeScript | Build CI aprobado | GitHub Actions ejecutó `next build` correctamente en el commit de código `ea53e636c5cb4454e250d1d22cf6d277159dda24` |
| Neon PostgreSQL | Configurado | Proyecto y rama principal inspeccionados |
| Neon Auth | Parcial | Login y recuperación implementados; flujo de correo real pendiente de prueba |
| Allowlist de superadmin | Implementada | Validación server-side por correo |
| Autorización de tenant | Base implementada | Helper de membresía y permisos por rol; falta cubrir endpoints y pruebas de aislamiento |
| Esquema inicial | Aplicado | Nueve tablas iniciales verificadas en Neon |
| Esquema operativo 0002 | Aplicado | Seis tablas nuevas e índices verificados |
| Integridad y billing 0003 | Aplicado | FKs compuestas, `subscription_payments` y `scheduled_jobs` verificados |
| Panel superadmin | Parcial | Listado y cambio de estado de comercios |
| Alta integral de comercios | Pendiente | No existe flujo completo de alta e invitación |
| Usuarios y permisos | Parcial | Roles y helper de autorización; administración e invitaciones pendientes |
| Planes y suscripciones | Parcial | Catálogo y persistencia; ciclo de vida y billing incompletos |
| Conexiones de pago y QR | Parcial | Estructura de datos; CRUD e integración real pendientes |
| Firma webhook Mercado Pago | Helper y tests | Verificación HMAC y 4 pruebas unitarias; falta integración HTTP y consulta del pago original |
| Conciliación de pagos | Pendiente | No hay conciliación operativa con proveedor |
| Auditoría | Parcial | Cambio de estado de comercio registra auditoría |
| Notificaciones | Estructura aplicada | Outbox creado; worker y proveedores pendientes |
| Tareas programadas | Estructura aplicada | Cola persistente creada; worker y scheduler pendientes |
| Reportes y exportaciones | Pendiente | Sin implementación integral |
| Responsive | Parcial | Landing y paneles iniciales; revisión global pendiente |
| UTF-8 | Aprobado | CI inspeccionó 56 archivos de texto sin errores |
| Pruebas unitarias | Aprobadas | 4/4 pruebas de firma |
| TypeScript | Aprobado | `tsc --noEmit` en GitHub Actions |
| ESLint | Aprobado | `eslint .` en GitHub Actions |
| Build | Aprobado en CI | `next build` en GitHub Actions con variables de entorno ficticias de CI |
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

### Hito B — Seguridad y acceso
- [x] Crear autorización reutilizable para superadmin y miembros.
- [x] Aplicar permisos por rol con overrides deny-only.
- [x] Agregar restricciones compuestas para evitar referencias cruzadas entre tenants.
- [ ] Cubrir todos los endpoints con permisos y aislamiento tenant.
- [ ] Alta manual, invitaciones con token hash, expiración y revocación.
- [ ] Pruebas de acceso cruzado entre comercios.

### Hito C — Administración y suscripciones
- [ ] CRUD integral de comercios y miembros.
- [ ] Planes, límites, overrides y auditoría desde el panel.
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
- [ ] Suite de pruebas de negocio, autorización y aislamiento.
- [ ] Sandbox de pagos validado.
- [ ] Revisión de seguridad y aislamiento.
- [ ] Checklist de variables de entorno y operaciones.
- [ ] Autorización expresa para publicar en Vercel.

## Bloqueos externos

La integración real de Mercado Pago, WhatsApp y correo productivo necesita credenciales, permisos y configuración de las cuentas propietarias. No se simulará su funcionamiento ni se marcarán como conectados hasta realizar pruebas reales.
