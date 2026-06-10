@echo off
title Cotizador E3 - Iniciando...
echo ============================================
echo    Cotizador E3 - Iniciando Servidor
echo ============================================
echo.

cd /d "%~dp0"

echo [1/3] Verificando PostgreSQL en Docker...
docker ps --filter "name=cotizador-e3-db" --format "{{.Names}}" 2>nul | findstr cotizador-e3-db >nul 2>&1
if %errorlevel% neq 0 (
    echo      Iniciando contenedor PostgreSQL...
    docker compose -f "%~dp0docker-compose.yml" up -d
    echo      Esperando que PostgreSQL este listo...
    timeout /t 4 /nobreak >nul
) else (
    echo      PostgreSQL ya esta corriendo.
)

echo.
echo [2/3] Verificando base de datos...
call npx prisma migrate deploy 2>nul
if %errorlevel% neq 0 (
    echo      Aplicando migracion...
    call npx prisma migrate dev --name init
)

echo.
echo [3/3] Iniciando servidor Next.js...
echo.
echo ============================================
echo    Servidor listo en http://localhost:3000
echo    Presiona Ctrl+C para detener
echo ============================================
echo.
call npm run dev
