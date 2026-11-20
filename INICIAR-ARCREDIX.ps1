$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js no está instalado. Instalá Node.js 22 o superior y volvé a ejecutar este archivo."
}

Write-Host "Instalando dependencias de ARCREDIX..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { throw "Falló npm install. Revisá la conexión y los mensajes anteriores." }

Write-Host "Iniciando ARCREDIX en http://localhost:3000 ..." -ForegroundColor Green
npm run dev
