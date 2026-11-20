# Estado de implementación de ARCREDIX

Este documento distingue código existente, base de datos comprobada y trabajo pendiente. No marcar una función como terminada solo porque existe una ruta o una pantalla.

## Base técnica verificada

| Área | Estado | Evidencia |
|---|---|---|
| Next.js App Router + TypeScript | Parcial | Proyecto y scripts presentes; build todavía no verificado |
| Neon PostgreSQL | Configurado | Proyecto y rama principal inspeccionados |
| Neon Auth | Parcial | Login y recuperación implementados; flujo de correo real pendiente de prueba |
| Allowlist de superadmin | Implementada | Validación server-side por correo |
| Separación de tenant | Parcial | Dashboard consulta membresía activa; faltan endpoints y pruebas de aislamiento |
| Esquema inicial | Aplicado | Nueve tablas verificadas en Neon |
| Esquema operativo 0002 | Aplicado | Seis tablas nuevas e índices verificados |
| Panel superadmin | Parcial | Listado y cambio de estado de comercios |
| Alta integral de comercios | Pendiente | No existe flujo completo de alta e invitación |
| Usuarios y permisos | Parcial | Roles en esquema; administración e invitaciones pendientes |
| Planes y suscripciones | Parcial | Catálogo y estructura base; ciclo de vida y billing incompletos |
| Conexiones de pago y QR | Parcial | Estructura de datos; CRUD e integración real pendientes |
| Validación de pagos | Pendiente | No hay conciliación operativa con proveedor |
| Auditoría | Parcial | Cambio de estado de comercio registra auditoría |
| Notificaciones | Estructura aplicada | Outbox creado; worker y proveedores pendientes |
| Reportes y exportaciones | Pendiente | Sin implementación integral |
| Responsive | Parcial | Landing y paneles iniciales; revisión global pendiente |
| CI de GitHub | En preparación | Workflow de calidad pendiente de ejecución |
| UTF-8 | Control en preparación | Checker automatizado pendiente de ejecución |
| Build de producción | No verificado | No se autoriza ni se ejecuta deployment Vercel en esta etapa |

## Hitos de desarrollo

### Hito A — Base confiable
- [x] Inspeccionar el repositorio y esquema real.
- [x] Corregir documentación principal dañada por mojibake.
- [x] Versionar la migración operativa 0002.
- [x] Probar la migración en una rama temporal.
- [x] Aplicar la migración a Neon main.
- [ ] Ejecutar controles automáticos de UTF-8, TypeScript, ESLint y build mediante GitHub Actions.

### Hito B — Seguridad y acceso
- [ ] Completar autorización reutilizable para superadmin y miembros.
- [ ] Cubrir todos los endpoints con permisos y aislamiento tenant.
- [ ] Alta manual, invitaciones con token hash, expiración y revocación.
- [ ] Pruebas de acceso cruzado entre comercios.

### Hito C — Administración y suscripciones
- [ ] CRUD integral de comercios y miembros.
- [ ] Planes, límites, overrides y auditoría.
- [ ] Ciclo de vida mensual, anual y pago único.
- [ ] Vencimientos automáticos, gracia, suspensión y reactivación.

### Hito D — Pagos y conciliación
- [ ] Adaptadores reales y credenciales seguras.
- [ ] Webhooks con firma donde el producto lo permita.
- [ ] Consulta server-side del pago original.
- [ ] Idempotencia, conciliación y estados auditables.
- [ ] QR oficial estático/dinámico y asociación con cajas.

### Hito E — Operación y experiencia
- [ ] Outbox y workers de notificaciones.
- [ ] Reportes y exportaciones seguras.
- [ ] Revisión responsive y accesibilidad.
- [ ] Observabilidad, límites, backups y retención.

### Hito F — Release candidate
- [ ] Suite de pruebas automatizadas.
- [ ] TypeScript sin errores.
- [ ] ESLint sin errores.
- [ ] UTF-8 y mojibake sin hallazgos.
- [ ] Build limpio en CI.
- [ ] Sandbox de pagos validado.
- [ ] Revisión de seguridad y aislamiento.
- [ ] Checklist de variables de entorno y operaciones.
- [ ] Autorización expresa para publicar en Vercel.

## Bloqueos externos

La integración real de Mercado Pago, WhatsApp y correo productivo necesita credenciales, permisos y configuración de las cuentas propietarias. No se simulará su funcionamiento ni se marcarán como conectados hasta realizar pruebas reales.
