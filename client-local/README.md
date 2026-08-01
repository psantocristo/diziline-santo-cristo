# 🖥️ DízimoSC Client Local v2.1 — Módulo Windows

Módulo local para Windows que roda como serviço HTTP na máquina do totem/balcão,
fazendo a ponte entre o sistema web (navegador) e os periféricos físicos:

- 🖨️ **Impressora Térmica 80mm** (ESC/POS via USB/Serial/Rede)
- 💳 **PINPad / TEF multi-provedor** — Connect TEF/SiTef (Rede), Sipag Integrado (Sicredi), Pagar.me Stone Connect, PayGo PGWebLib

---

## 📐 Arquitetura

```
┌─────────────────────┐        HTTP localhost        ┌──────────────────────┐
│   Navegador (Totem)  │  ◄──────────────────────►   │  DízimoSC Client     │
│   React App          │       :3847/api/*           │  (Node.js / Express) │
└─────────────────────┘                              └──────┬───────┬───────┘
                                                            │       │
                                                     USB/COM│       │TCP/Pipe
                                                            ▼       ▼
                                                     ┌──────┐  ┌────────┐
                                                     │Térmica│  │ PINPad │
                                                     │80mm   │  │  TEF   │
                                                     └──────┘  └────────┘
```

O client roda em `http://localhost:3847` e expõe endpoints REST que o frontend
consome via `fetch()`. O navegador fala com o client local, que por sua vez
se comunica com os dispositivos via drivers nativos.

### Novidades da v2.1

| Recurso | Descrição |
|---------|-----------|
| **Multi-provedor TEF** | Alterna entre Connect TEF, Sipag, Pagar.me Stone e PayGo via `TEF_PROVIDER` |
| **Adapter pattern** | `src/services/tef-adapters.ts` normaliza payloads de cada middleware |
| **URLs independentes** | Cada provedor tem sua porta padrão (`TEF_SIPAG_URL`, `TEF_PAGARME_STONE_URL`, `TEF_PAYGO_URL`) |
| **Selector no wizard** | `/setup` exibe dropdown e ajusta a URL conforme provedor escolhido |
| **`tef_provider` no /health** | Diagnóstico mostra qual middleware está ativo |

### Recursos da v2.0

| Recurso | Descrição |
|---------|-----------|
| **Fila de Impressão** | Jobs sequenciais com retry automático (até 2x) e timeout de 15s |
| **Pool de Conexão** | Conexão persistente com a impressora, reconexão via backoff exponencial |
| **Validação Zod** | Todos os payloads de entrada validados com schemas tipados |
| **Rate Limiting** | Proteção contra flood por IP (impressão e TEF) |
| **Métricas** | Endpoint `/api/metrics` com uptime, latência, uso de memória |
| **Graceful Shutdown** | Drena fila e fecha impressora ao encerrar o serviço |
| **Middleware de Erro** | Tratamento centralizado de erros com logging estruturado |

---

## 🔌 Provedores TEF suportados

| Provedor (`TEF_PROVIDER`) | Middleware esperado | Porta padrão | Gateway online associado |
|---------------------------|---------------------|--------------|--------------------------|
| `connect_tef` | Connect TEF / SiTef (Software Express) | 8090 | Rede / e.Rede |
| `sipag` | Sipag Integrado SDK Local (Sicredi) | 60906 | Sicredi (Sipag) |
| `pagarme_stone` | Stone Connect Service | 9000 | Pagar.me v5 / Stone |
| `paygo` | PayGo PGWebLib | 9999 | Genérico (PayGo) |

> ℹ️ Os endpoints e payloads de cada provedor estão isolados em
> `src/services/tef-adapters.ts`. A troca de provedor é feita apenas pelo
> `.env` (`TEF_PROVIDER=...`) ou pelo wizard `/setup` — nenhuma outra
> alteração de código é necessária.

---

## 🗂️ Estrutura do Projeto

```
client-local/
├── README.md                  ← Este arquivo
├── package.json               ← Dependências Node.js
├── tsconfig.json              ← Config TypeScript
├── .env.example               ← Variáveis de ambiente (modelo)
├── src/
│   ├── index.ts               ← Entry point — servidor Express
│   ├── config.ts              ← Leitura centralizada do .env
│   ├── schemas.ts             ← Schemas Zod para validação de input
│   ├── routes/
│   │   ├── printer.ts         ← POST /api/print — impressão térmica
│   │   ├── pinpad.ts          ← POST /api/tef/* — transações TEF
│   │   ├── health.ts          ← GET  /api/health — status dos dispositivos
│   │   ├── system.ts          ← GET  /api/metrics, POST /api/restart/*
│   │   ├── config-page.ts     ← GET  /api/config — página de status (read-only)
│   │   ├── setup-page.ts      ← GET  /setup — wizard de configuração inicial
│   │   └── setup-api.ts       ← POST /api/setup/* — endpoints do wizard
│   ├── middleware/
│   │   ├── error-handler.ts   ← Middleware centralizado de tratamento de erros
│   │   ├── metrics-middleware.ts ← Coleta de métricas por requisição
│   │   ├── rate-limiter.ts    ← Rate limiting por IP
│   │   └── validate.ts        ← Middleware de validação Zod
│   ├── services/
│   │   ├── printer-connection.ts ← Pool de conexão persistente com a impressora
│   │   ├── print-queue.ts     ← Fila sequencial de impressão com retry
│   │   ├── printer-comprovante.ts ← Impressão de comprovantes de pagamento
│   │   ├── printer-pix.ts     ← Impressão de QR Code Pix
│   │   ├── printer-pedido.ts  ← Impressão de pedidos da loja
│   │   ├── printer-test.ts    ← Impressão de página de teste
│   │   ├── thermal-printer.ts ← Re-export (compatibilidade retroativa)
│   │   ├── tef-client.ts      ← Integração Connect TEF / SiTef
│   │   └── metrics.ts         ← Serviço de coleta de métricas do sistema
│   ├── utils/
│   │   ├── escpos-commands.ts ← Comandos ESC/POS para térmica
│   │   └── logger.ts          ← Logging local com rotação (winston)
│   └── types/
│       └── index.ts           ← Tipos compartilhados
├── scripts/
│   ├── setup.bat              ← Assistente de Configuração Inicial
│   ├── install-service.bat    ← Instala como serviço Windows
│   ├── install-service.js     ← Script node-windows para registro
│   ├── uninstall-service.js   ← Script para remover serviço Windows
│   └── start-dev.bat          ← Inicia em modo desenvolvimento
└── assets/
    └── logo-pb.png            ← Logo P&B para impressão térmica
```

---

## 🚀 Instalação Rápida (Setup Wizard)

A forma mais fácil de configurar o client local é usar o **Assistente de Configuração**:

### Passo 1 — Baixar e preparar

```bash
# Copie a pasta client-local para a máquina Windows
# Recomendado: C:\DizimoSC\client-local

cd C:\DizimoSC\client-local
```

### Passo 2 — Executar o assistente

```bash
# Dê duplo-clique ou execute no terminal:
scripts\setup.bat
```

O script irá:
1. ✅ Verificar se o Node.js 20+ está instalado
2. ✅ Instalar dependências automaticamente (`npm install`)
3. ✅ Abrir o navegador com o wizard interativo em `http://localhost:3847/setup`

### Passo 3 — Configurar no wizard

No wizard interativo, configure:
- ✅ Porta do servidor e URL do sistema
- ✅ **Token de API** (gerado no painel admin → Diagnóstico)
- ✅ Tipo e conexão da impressora térmica (USB/Serial/Rede)
- ✅ PINPad/TEF com teste de conexão
- ✅ Nível e retenção de logs
- ✅ **Salvar** — gera o arquivo `.env` automaticamente

### Passo 4 — Instalar como serviço

```bash
# Execute como Administrador:
scripts\install-service.bat

# O serviço "DízimoSC Client" será criado com inicialização automática
```

> ✅ Pronto! O client local está rodando como serviço Windows.

---

## 🔧 Instalação Manual (alternativa)

### Pré-requisitos

| Requisito | Versão |
|-----------|--------|
| **Windows** | 10 ou 11 (64-bit) |
| **Node.js** | 20+ (LTS recomendado) |
| **Impressora térmica** | 80mm, USB/Serial/Rede (ex: Elgin i9, Epson TM-T20) |
| **PINPad** | Com middleware Connect TEF (opcional) |

### Passo 1 — Instalar dependências

```bash
cd C:\DizimoSC\client-local
npm install
```

### Passo 2 — Configurar .env

```bash
copy .env.example .env
notepad .env
```

```env
# ===== Servidor =====
PORT=3847

# ===== Impressora Térmica =====
PRINTER_TYPE=usb              # usb | serial | network

# USB (usar Device Manager para VID/PID)
PRINTER_VID=0x04b8
PRINTER_PID=0x0202

# Serial (descomente se PRINTER_TYPE=serial)
# PRINTER_SERIAL_PORT=COM3
# PRINTER_SERIAL_BAUD=9600

# Rede (descomente se PRINTER_TYPE=network)
# PRINTER_NETWORK_IP=192.168.1.100
# PRINTER_NETWORK_PORT=9100

# ===== TEF / PINPad =====
TEF_ENABLED=true
TEF_MIDDLEWARE_URL=http://localhost:8090
TEF_TERMINAL_ID=DIZSC001
TEF_TIMEOUT_SECONDS=120

# ===== Segurança =====
CORS_ORIGIN=https://dizimosc.lovable.app
API_TOKEN=cole-o-token-gerado-no-painel-admin

# ===== Logs =====
LOG_LEVEL=info                # debug | info | warn | error
LOG_DIR=./logs
LOG_MAX_FILES=30              # dias de retenção
```

### 🔑 Passo 2b — Token de API (obrigatório)

O token protege o client contra acessos não autorizados. Deve ser **idêntico** em dois lugares:

| Local | Onde configurar |
|-------|----------------|
| **Client local** | Arquivo `.env` → campo `API_TOKEN` |
| **Sistema web** | Painel Admin → Diagnóstico → **Tokens do Client Local** |

#### Como gerar o token:

1. Acesse o painel admin do DízimoSC → **Diagnóstico**
2. Na seção **"Tokens do Client Local"**, clique **"Gerar Novo Token"**
3. Informe o nome da máquina (ex: "Totem Entrada")
4. Copie o token gerado (64 caracteres hexadecimais)
5. Cole no `.env` do client local ou use o Setup Wizard

> ⚠️ Se os tokens não forem iguais, todas as requisições serão rejeitadas com **401 Unauthorized**.

### Passo 3 — Testar em desenvolvimento

```bash
npm run dev
```

Acesse `http://localhost:3847/api/health` — deve retornar:

```json
{
  "status": "ok",
  "version": "2.0.0",
  "devices": {
    "printer": { "connected": true, "model": "Elgin i9" },
    "pinpad": { "connected": true, "terminal": "DIZSC001" }
  },
  "uptime": 3600
}
```

### Passo 4 — Instalar como serviço Windows

```bash
# Execute como Administrador
scripts\install-service.bat
```

Registra como serviço Windows com inicialização automática.

Para remover:
```bash
node scripts/uninstall-service.js
```

---

## 📡 API Endpoints

Todos os endpoints (exceto `/setup`) exigem o header `X-Client-Token`.

### Saúde e Monitoramento

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/health` | Status de todos os dispositivos |
| `GET` | `/api/metrics` | Métricas do sistema (CPU, memória, uptime, latência) |
| `GET` | `/api/config` | Página HTML com status da configuração |

### Impressão

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/print` | Imprime comprovante na térmica 80mm |
| `POST` | `/api/print/test` | Imprime página de teste |
| `GET`  | `/api/print/queue` | Status da fila de impressão |
| `POST` | `/api/restart/printer` | Reinicia conexão com a impressora |

### TEF / PINPad

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/tef/pay` | Inicia transação TEF |
| `GET`  | `/api/tef/status/:txId` | Consulta status da transação |
| `POST` | `/api/tef/confirm/:txId` | Confirma transação aprovada |
| `POST` | `/api/tef/undo/:txId` | Desfaz transação |
| `POST` | `/api/tef/pay/sse` | Transação via Server-Sent Events |
| `POST` | `/api/tef/cancel` | Cancela transação em andamento |

### Exemplos de Payload

#### `POST /api/print`
```json
{
  "type": "comprovante",
  "data": {
    "valor": 150.00,
    "tipo": "dizimo",
    "metodo": "pix",
    "nomeContribuinte": "João Silva",
    "mesReferencia": "2026-03-01",
    "dataHora": "2026-03-02T10:30:00"
  }
}
```

#### `POST /api/tef/pay`
```json
{
  "pagamentoId": "abc123",
  "valor": 150.00,
  "tipo": "credito",
  "parcelas": 3
}
```

#### `GET /api/metrics` (resposta)
```json
{
  "uptime": 3600,
  "memory": { "rss": 45, "heapUsed": 22, "heapTotal": 35 },
  "requests": { "total": 150, "errors": 2, "avgLatency": 45 },
  "printer": { "jobsCompleted": 28, "jobsFailed": 1, "queueLength": 0 },
  "version": "2.0.0"
}
```

---

## 🔒 Segurança

| Medida | Descrição |
|--------|-----------|
| **CORS restrito** | Apenas a URL configurada em `CORS_ORIGIN` pode acessar |
| **Token de API** | Header `X-Client-Token` obrigatório (gerenciado no painel admin) |
| **Somente localhost** | Servidor escuta apenas em `127.0.0.1` |
| **Validação Zod** | Todos os payloads validados com schemas tipados |
| **Rate Limiting** | Limite por IP: 30 req/min (impressão), 10 req/min (TEF) |
| **Sem dados sensíveis** | Números de cartão nunca trafegam pelo client |
| **Tokens rotativos** | Tokens podem ser desativados/excluídos a qualquer momento |
| **Modo Setup isolado** | Rotas do wizard só acessíveis com `MODE=setup` (sem token) |
| **Graceful Shutdown** | Fila drenada e impressora fechada ao encerrar o serviço |

---

## 🖨️ Impressão Térmica

### Fila de Impressão (v2.0)

A fila garante que apenas um job acesse a impressora por vez:

```
Job 1 → [Fila] → Imprimindo → ✅ Concluído
Job 2 → [Fila] → Aguardando → Imprimindo → ✅ Concluído
Job 3 → [Fila] → Aguardando → Aguardando → Imprimindo → ❌ Falha → Retry 1 → ✅
```

| Configuração | Valor |
|--------------|-------|
| Max retries | 2 tentativas |
| Timeout por job | 15 segundos |
| Reconexão automática | Backoff exponencial (5s → 10s → 20s → 40s → 60s) |

### Comandos ESC/POS

| Recurso | Comando ESC/POS |
|---------|----------------|
| Negrito | `\x1B\x45\x01` |
| Centralizar | `\x1B\x61\x01` |
| Fonte grande | `\x1D\x21\x11` |
| Corte parcial | `\x1D\x56\x01` |
| Imagem bitmap | `\x1D\x76\x30` |
| QR Code nativo | `\x1D\x28\x6B` |

### Tipos de impressão suportados

| Tipo | Arquivo | Descrição |
|------|---------|-----------|
| `comprovante` | `printer-comprovante.ts` | Comprovante de dízimo/oferta |
| `pix` | `printer-pix.ts` | QR Code Pix para pagamento |
| `pedido` | `printer-pedido.ts` | Pedido da loja paroquial |
| `teste` | `printer-test.ts` | Página de teste da impressora |

---

## 💳 TEF / PINPad

Comunicação com o middleware Connect TEF via HTTP local:

```
Frontend → Client Local → Connect TEF → Adquirente (Rede) → Bandeira
```

### Fluxo de transação

1. Frontend chama `POST /api/tef/pay` → recebe `transaction_id`
2. Client envia comando ao Connect TEF
3. PINPad exibe "Insira o cartão"
4. Cliente insere/aproxima cartão e digita senha
5. Connect TEF processa com a adquirente
6. Frontend faz polling via `GET /api/tef/status/:txId`
7. Quando aprovado, confirma via `POST /api/tef/confirm/:txId`
8. Client imprime comprovante automaticamente (via fila)

---

## 📦 Empacotamento

### Executável standalone (recomendado)
```bash
npm run build
npm run package
# Gera: dist/DizimoSC-Client.exe (Node.js embutido)
```

### Serviço Windows
```bash
npm run install-service
# Registra "DízimoSC Client" como serviço automático

npm run uninstall-service
# Remove o serviço
```

---

## 🛠️ Tecnologias

| Tecnologia | Uso |
|-----------|-----|
| **Node.js 20+** | Runtime |
| **Express** | Servidor HTTP |
| **Zod** | Validação de schemas |
| **escpos** | Comunicação ESC/POS |
| **usb / serialport** | Acesso a periféricos |
| **node-windows** | Serviço Windows |
| **pkg** | Empacotamento .exe |
| **winston** | Logging com rotação |
| **sharp** | Processamento de imagem para bitmap |
| **dotenv** | Configuração via .env |

---

## 🐛 Troubleshooting

| Problema | Solução |
|----------|---------|
| `401 Unauthorized` em todas as rotas | Verifique se o `API_TOKEN` no `.env` é idêntico ao token no painel admin |
| Impressora não conecta | Verifique VID/PID no Device Manager; tente `POST /api/restart/printer` |
| Fila de impressão travada | Acesse `GET /api/print/queue` para ver status; reinicie o serviço se necessário |
| Serviço não inicia | Execute `scripts\install-service.bat` como Administrador |
| TEF timeout | Aumente `TEF_TIMEOUT_SECONDS` no `.env`; verifique se Connect TEF está rodando |
| Muitos logs | Ajuste `LOG_LEVEL=warn` e reduza `LOG_MAX_FILES` no `.env` |
| Erro CORS | Confirme que `CORS_ORIGIN` no `.env` corresponde à URL exata do sistema |
