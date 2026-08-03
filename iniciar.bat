@echo off
title SGP - Sistema de Gerenciamento de Pacientes
color 0A

echo ============================================
echo   SGP - Sistema de Gerenciamento de Pacientes
echo ============================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado!
    echo Baixe em: https://nodejs.org/pt-br/download/
    pause
    exit /b 1
)

echo [OK] Node.js encontrado
node --version
echo.

if not exist "node_modules" (
    echo [INFO] Instalando dependencias...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao instalar dependencias!
        pause
        exit /b 1
    )
    echo [OK] Dependencias instaladas!
    echo.
) else (
    echo [OK] Dependencias ja instaladas
    echo.
)

if not exist "server\uploads" mkdir "server\uploads"
if not exist "dados" mkdir "dados"
if not exist "backups" mkdir "backups"

echo ============================================
echo   Iniciando servidor...
echo ============================================
echo.
echo O navegador sera aberto automaticamente.
echo Para parar, pressione Ctrl+C nesta janela.
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3300"

node server/index.js

pause