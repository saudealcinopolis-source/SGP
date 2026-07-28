@echo off
title SGP - Backup do Banco de Dados
color 0B

echo ============================================
echo   SGP - Backup do Banco de Dados
echo ============================================
echo.

if not exist "dados\sgp.db" (
    echo [ERRO] Banco de dados nao encontrado!
    pause
    exit /b 1
)

if not exist "backups" mkdir "backups"

set TIMESTAMP=%date:~-4%-%date:~3,2%-%date:~0,2%_%time:~0,2%-%time:~3,2%-%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

copy "dados\sgp.db" "backups\sgp_backup_%TIMESTAMP%.db"

if %errorlevel% equ 0 (
    echo [OK] Backup criado: backups\sgp_backup_%TIMESTAMP%.db
) else (
    echo [ERRO] Falha ao criar backup!
)

echo.
pause