# ARCREDIX

Landing inicial de ARCREDIX, plataforma SaaS de control y validación operativa de transferencias para comercios.

## Requisitos
- Node.js 22 o superior
- npm 10 o superior

## Desarrollo local

```bash
npm install
npm run dev
```

Abrir http://localhost:3000.

## Validaciones

```bash
npm run typecheck
npm run lint
npm run build
```

## Estado del proyecto

Esta primera entrega incluye la landing pública responsive, identidad vectorial SVG, simulador interactivo de caja con voz del navegador, explicación del flujo, funcionalidades, precios de referencia y preguntas frecuentes.

Todavía no incluye autenticación, conexión bancaria, OCR real, Neon ni paneles operativos. El simulador es ilustrativo y no confirma pagos reales. La integración financiera deberá implementarse por proveedor/canal, con credenciales seguras y pruebas específicas.

## Variables de entorno
Copiar `.env.example` a `.env.local` cuando se integre la infraestructura.

## Windows / PowerShell

Extraer la carpeta `ARCREDIX` en `C:\Proyectos\ARCREDIX`, abrir PowerShell en esa carpeta y ejecutar:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\INICIAR-ARCREDIX.ps1
```

También se puede ejecutar `npm install` y luego `npm run dev` manualmente.
