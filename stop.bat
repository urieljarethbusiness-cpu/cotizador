@echo off
title Cotizador - Deteniendo...
echo ============================================
echo    Cotizador - Deteniendo Servidor
echo ============================================
echo.

cd /d "%~dp0"

echo [1/2] Deteniendo servidor Next.js...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
    echo      Proceso %%a detenido.
)
echo      Servidor Next.js detenido.

echo.
echo [2/2] Deteniendo PostgreSQL en Docker...
docker compose -f "%~dp0docker-compose.yml" down
echo      PostgreSQL detenido.

echo.
echo ============================================
echo    Todos los servicios detenidos.
echo ============================================
echo.
pause
