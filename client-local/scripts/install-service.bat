@echo off
echo ========================================
echo   DízimoSC Client - Instalar Serviço
echo ========================================
echo.

:: Verifica se está rodando como admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Execute como Administrador!
    echo Clique com botao direito e selecione "Executar como administrador"
    pause
    exit /b 1
)

cd /d "%~dp0\.."

:: Verifica se Node.js está instalado
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao encontrado! Instale em https://nodejs.org
    pause
    exit /b 1
)

:: Instala dependências se necessário
if not exist "node_modules" (
    echo Instalando dependencias...
    call npm install
)

:: Compila TypeScript
echo Compilando...
call npm run build

:: Instala como serviço Windows
echo Instalando servico Windows...
node scripts/install-service.js

echo.
echo Servico instalado com sucesso!
echo O DízimoSC Client iniciará automaticamente com o Windows.
pause
