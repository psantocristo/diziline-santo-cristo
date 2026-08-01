@echo off
chcp 65001 >nul 2>&1
title DízimoSC — Assistente de Configuração

echo ═══════════════════════════════════════
echo   DízimoSC — Assistente de Configuração
echo ═══════════════════════════════════════
echo.

REM Verifica Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Node.js não encontrado!
    echo Instale em: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER% encontrado

REM Vai para a pasta do client-local
cd /d "%~dp0.."

REM Instala dependências se necessário
if not exist "node_modules" (
    echo.
    echo Instalando dependências...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERRO] Falha ao instalar dependências
        pause
        exit /b 1
    )
    echo [OK] Dependências instaladas
)

echo.
echo Iniciando servidor em modo configuração...
echo.

REM Inicia em modo setup
set MODE=setup
start "" http://localhost:3847/setup

REM Roda com ts-node ou tsx
npx tsx src/index.ts

pause
