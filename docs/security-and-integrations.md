# Seguridad e integraciones

## Reglas obligatorias

- No guardar tokens, claves privadas ni secretos de webhook en tablas de negocio en texto plano.
- No incluir secretos en respuestas HTTP, errores visibles, telemetría o auditoría.
- Validar con Zod los cuerpos, parámetros y filtros recibidos.
- Aplicar autorización en cada endpoint del servidor; ocultar botones no es autorización.
- Derivar el comercio desde la sesión y la membresía activa, nunca desde un identificador arbitrario del cliente.
- Usar consultas parametrizadas.
- Limitar tamaño de payload, paginar listados y limitar exportaciones.
- Registrar actor, entidad, acción, fecha y motivo en operaciones administrativas sensibles.
- No registrar cuerpos completos de webhooks; almacenar identificador, hash, estado y metadatos no sensibles.
- Usar claves de idempotencia en operaciones externas y restricciones únicas en la base.
- Las tareas programadas deben autenticar su invocación y ser idempotentes.

## Row-Level Security (RLS)\n\nLa migración `0005_tenant_rls.sql` está aplicada en Neon main. RLS está habilitado y forzado en 18 tablas públicas; `schema_migrations` queda fuera de RLS y sin privilegios para `arcredix_app`.\n\n- `arcredix_app` es un rol `NOLOGIN` y `NOBYPASSRLS`; `arcredix_owner` es el rol de migración/administración y tiene `BYPASSRLS`.\n- El cliente de aplicación debe establecer `role=arcredix_app` en el inicio de conexión y enviar el JWT autenticado mediante `authToken`. No usar el cliente propietario para rutas de usuario.\n- `auth.user_id()` se encapsula en funciones `SECURITY DEFINER` con `search_path` fijo; las políticas comprueban membresía activa y superadmin.\n- La lectura pública se limita a planes/proveedores activos. Los datos de comercios, conexiones, cajas, QR, suscripciones, transacciones y auditoría tienen políticas de tenant.\n- Las pruebas de aislamiento se ejecutaron en una branch de Neon con sujetos de prueba. La autenticación RLS con sesión real en la aplicación local y la validación de conexión startup-role siguen pendientes; no desplegar hasta completar ese smoke test.\n\n## Mercado Pago

La integración de Mercado Pago debe implementarse como adaptador de proveedor y no mezclarse con las reglas de dominio.

Documentación oficial consultada:

- Webhooks y validación de firma: https://www.mercadopago.com.ar/developers/es/docs/qr-code/additional-content/your-integrations/notifications/webhooks
- Notificaciones y eventos: https://www.mercadopago.com.ar/developers/es/docs/mp-delivery/additional-content/your-integrations/notifications
- API de órdenes: https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro/create-order/post

### Validación de notificaciones

Para los productos que admiten firma, Mercado Pago envía `x-signature` y `x-request-id`. La validación HMAC-SHA256 utiliza el identificador de recurso de la URL, el request ID y el timestamp en el manifest documentado por el proveedor. La comparación debe realizarse en tiempo constante.

La validación de firma no sustituye la consulta del pago original. Después de validar el evento, ARCREDIX debe consultar el recurso con el access token de la cuenta correspondiente y verificar importe, moneda, estado, referencia y cuenta receptora.

**Excepción importante:** la documentación de Mercado Pago indica que ciertos flujos de Código QR no admiten validación de origen mediante `x-signature` en webhooks configurados desde Tus Integraciones. El mecanismo debe evaluarse según el producto QR exacto. No asumir que todos los webhooks QR están firmados.

### Credenciales

Pendiente de configurar mediante el propietario de la cuenta:

- Aplicación de Mercado Pago de ARCREDIX para cobrar suscripciones propias.
- Aplicación o mecanismo autorizado para conectar cuentas de comercios.
- Access tokens de prueba y productivos.
- Secretos de webhook por aplicación/cuenta.
- Redirect URIs y permisos OAuth, si corresponde.
- URL HTTPS final para notificaciones.

No reutilizar credenciales de la cuenta de un comercio para cobrar la suscripción de ARCREDIX. Son integraciones y responsabilidades distintas.

## QR y comprobantes

- Usar payloads y recursos QR emitidos por el proveedor.
- No fabricar URLs de pago ni representar un QR de demostración como QR real.
- Distinguir QR estático compartido de QR dinámico por operación.
- Un comprobante subido por un usuario solo es evidencia declarativa; no prueba acreditación.
- Registrar qué fuente confirmó el pago y cuándo.

## WhatsApp y correo

- Requerir consentimiento y registrar su origen/fecha.
- Utilizar WhatsApp Business Platform o proveedor autorizado.
- Respetar plantillas aprobadas y ventanas de conversación aplicables.
- Persistir cada envío en `notification_outbox`.
- Evitar duplicados con `idempotency_key`.
- Limitar reintentos y conservar identificador del proveedor y estado final.
- SMTP compartido de desarrollo no se considera canal de producción validado.

## Protección de datos

- Recopilar solo datos necesarios para la operación.
- Definir retención y eliminación para datos de pagos, logs, invitaciones y notificaciones.
- Exportaciones y reportes deben respetar el tenant y los permisos.
- Las credenciales y datos de autenticación nunca deben aparecer en paneles administrativos.
- La auditoría no debe guardar datos sensibles innecesarios en `before_data` o `after_data`.

## Controles previos a producción

- Revisión de autorización por endpoint y por tenant.
- Pruebas de aislamiento entre comercios.
- Pruebas de firmas válidas, inválidas, repetidas y eventos fuera de orden.
- Pruebas de conciliación con importes/monedas/referencias incorrectos.
- Pruebas de renovación, vencimiento, gracia y suspensión.
- Verificación de consentimiento, deduplicación y reintentos de notificaciones.
- Revisión de secretos, variables de entorno, logs y backups.
- Prueba integral con credenciales de sandbox antes de cualquier cuenta productiva.
