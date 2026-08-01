@echo off
echo ========================================
echo   DízimoSC Client - Modo Desenvolvimento
echo ========================================
echo.
cd /d "%~dp0\.."

:: Verifica .env
if not exist ".env" (
    echo Criando .env a partir do exemplo...
    copy .env.example .env
    echo.
    echo IMPORTANTE: Edite o arquivo .env com suas configuracoes!
    echo.
)

:: Instala dependências se necessário
if not exist "node_modules" (
    echo Instalando dependencias...
    call npm install
)

echo Iniciando em modo desenvolvimento...
echo Pressione Ctrl+C para encerrar.
echo.
call npm run dev
