# DízimoSC — Guia de Deploy em Modo Kiosk (Chrome)

Este guia explica como configurar um PC Windows para rodar o totem DízimoSC em tela cheia, sem bordas, com o client-local v2.0 iniciando automaticamente.

---

## 1. Pré-requisitos

| Requisito | Versão/Detalhe |
|-----------|---------------|
| **Windows** | 10 ou 11 (64-bit) |
| **Google Chrome** | Última versão estável |
| **Node.js** | 20+ LTS |
| **Impressora térmica** | 80mm, USB/Serial/Rede |
| **PINPad** | Com Connect TEF (opcional) |

---

## 2. Instalar o Client Local

### Opção A — Setup Wizard (recomendado)

```bash
cd C:\DizimoSC\client-local

# Executa o assistente interativo
scripts\setup.bat
```

O wizard irá:
1. Verificar Node.js e instalar dependências
2. Abrir `http://localhost:3847/setup` no navegador
3. Guiar a configuração de impressora, TEF e token

Após salvar no wizard, prossiga para o **Passo 3** (serviço).

### Opção B — Configuração Manual

```bash
cd C:\DizimoSC\client-local

# Instale dependências
npm install

# Copie e configure o .env
copy .env.example .env
notepad .env
```

### Variáveis do `.env`:

```env
# Servidor
PORT=3847

# Segurança
CORS_ORIGIN=https://dizimosc.lovable.app
API_TOKEN=cole-o-token-gerado-no-painel-admin

# Impressora (escolha um tipo)
PRINTER_TYPE=usb
PRINTER_VID=0x04b8
PRINTER_PID=0x0202
# PRINTER_TYPE=serial
# PRINTER_SERIAL_PORT=COM3
# PRINTER_SERIAL_BAUD=9600
# PRINTER_TYPE=network
# PRINTER_NETWORK_IP=192.168.1.100
# PRINTER_NETWORK_PORT=9100

# TEF (opcional)
TEF_ENABLED=true
TEF_MIDDLEWARE_URL=http://localhost:8090
TEF_TERMINAL_ID=DIZSC001
TEF_TIMEOUT_SECONDS=120

# Logs
LOG_LEVEL=info
LOG_DIR=./logs
LOG_MAX_FILES=30
```

### 🔑 Token de API (obrigatório)

1. Acesse **Painel Admin → Diagnóstico → Tokens do Client Local**
2. Clique **"Gerar Novo Token"** e informe o nome da máquina
3. Copie o token (64 caracteres hex) e cole no `.env` → `API_TOKEN`

> ⚠️ Tokens diferentes = **401 Unauthorized** em todas as requisições.

---

## 3. Instalar como Serviço Windows

```bash
# Execute como Administrador
scripts\install-service.bat

# O serviço "DízimoSC Client" será criado com inicialização automática
```

Para verificar se está rodando:
```bash
# Acesse no navegador:
http://localhost:3847/api/health
```

Para remover o serviço:
```bash
node scripts/uninstall-service.js
```

---

## 4. Verificar o Client (novo na v2.0)

Após instalar o serviço, valide os novos endpoints:

| Endpoint | O que verificar |
|----------|----------------|
| `GET /api/health` | `status: "ok"`, impressora e TEF conectados |
| `GET /api/metrics` | Uptime, memória e contadores de requisição |
| `GET /api/print/queue` | Fila vazia (`pending: 0`, `processing: false`) |
| `POST /api/print/test` | Impressora imprime página de teste |

---

## 5. Criar Script de Inicialização do Kiosk

Crie o arquivo `C:\DizimoSC\iniciar-kiosk.bat`:

```bat
@echo off
title DízimoSC Kiosk

REM Aguarda o serviço do client-local subir
timeout /t 5 /nobreak >nul

REM Fecha qualquer Chrome anterior
taskkill /F /IM chrome.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM Inicia Chrome em modo kiosk
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --kiosk ^
  --disable-infobars ^
  --disable-session-crashed-bubble ^
  --noerrdialogs ^
  --disable-translate ^
  --no-first-run ^
  --fast ^
  --fast-start ^
  --disable-features=TranslateUI ^
  --overscroll-history-navigation=0 ^
  --autoplay-policy=no-user-gesture-required ^
  "https://dizimosc.lovable.app/totem"
```

> **Nota:** Substitua a URL pelo domínio correto do seu sistema.

### Flags importantes:
| Flag | Função |
|------|--------|
| `--kiosk` | Tela cheia sem bordas, sem barra de endereço |
| `--disable-infobars` | Remove barras de informação |
| `--noerrdialogs` | Suprime popups de erro |
| `--disable-session-crashed-bubble` | Remove aviso de "Chrome não fechou corretamente" |
| `--overscroll-history-navigation=0` | Impede voltar com gesto de swipe |

---

## 6. Inicialização Automática com Windows

### Opção A: Pasta Startup (mais simples)

1. Pressione `Win + R`, digite `shell:startup` e Enter
2. Copie (ou crie um atalho de) `iniciar-kiosk.bat` para esta pasta

### Opção B: Agendador de Tarefas (mais controle)

1. Abra o **Agendador de Tarefas** (`taskschd.msc`)
2. Crie uma nova tarefa:
   - **Disparador:** Ao fazer logon
   - **Ação:** Iniciar programa → `C:\DizimoSC\iniciar-kiosk.bat`
   - **Configurações:** Marque "Executar com privilégios mais altos" se necessário

---

## 7. Bloquear Atalhos do Windows (Opcional)

### Usando conta de usuário restrito:
1. Crie um usuário local padrão (sem admin): `DizimoTotem`
2. Configure logon automático para esse usuário
3. Coloque o `iniciar-kiosk.bat` na pasta Startup desse perfil

### Usando GPO (Group Policy):
```
gpedit.msc → Configuração do Usuário → Modelos Administrativos → Sistema
→ "Não executar aplicativos Windows especificados"
→ Adicione: taskmgr.exe, cmd.exe, powershell.exe
```

### Desabilitar atalhos de teclado:
Considere usar **AutoHotkey** para bloquear:
- `Alt+F4` (fechar Chrome)
- `Alt+Tab` (trocar janela)
- `Win` (menu iniciar)
- `Ctrl+Alt+Del` (gerenciador de tarefas)

---

## 8. Monitoramento e Saúde

### Painel Admin (remoto)

O painel **Diagnóstico** (`/admin/diagnostico`) mostra:
- ✅ Status do Client Local
- ✅ Status da Impressora Térmica
- ✅ Status do PINPad/TEF
- ✅ Latência do banco de dados
- 🔄 Auto-refresh a cada 10 segundos

### Endpoints Locais (v2.0)

| Endpoint | Informação |
|----------|-----------|
| `/api/health` | Status de todos os dispositivos |
| `/api/metrics` | CPU, memória, uptime, latência média |
| `/api/print/queue` | Jobs pendentes, em processamento e concluídos |
| `/api/config` | Página HTML com configuração atual (tokens mascarados) |

### Ações de Recuperação

| Ação | Endpoint |
|------|----------|
| Reiniciar impressora | `POST /api/restart/printer` |
| Limpar fila de impressão | Reinicie o serviço Windows |

---

## 9. Sobre a Aba "Maquininha TEF"

A aba de configuração TEF nas Configurações do admin **permanece visível** para ajustes, mas quando o client-local está ativo, exibe o badge **"Gerenciado pelo Client Local"** indicando que as transações TEF passam pelo módulo local em vez do gateway cloud.

---

## Resumo da Arquitetura

```
┌────────────────────────────────────────────┐
│  Tela do Totem (Chrome --kiosk)            │
│  https://dizimosc.lovable.app/totem        │
│                                            │
│  ┌──────────┐  ┌────────────────────────┐  │
│  │ Frontend │──│ localhost:3847          │  │
│  │ (React)  │  │ client-local (Node.js) │  │
│  └──────────┘  └───────┬────────────────┘  │
│                        │                   │
│               ┌────────┴────────┐          │
│               │  Impressora USB │          │
│               │  PINPad (TEF)   │          │
│               └─────────────────┘          │
└────────────────────────────────────────────┘
                    │
                    │ HTTPS
                    ▼
          ┌──────────────────┐
          │  Lovable Cloud   │
          └──────────────────┘
```
