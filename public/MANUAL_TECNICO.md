# 📖 Manual Técnico de Configuração — Sistema de Dízimos e Contribuições

**Versão:** 2.0  
**Última atualização:** Fevereiro 2026  
**Plataforma:** Lovable Cloud (React + Supabase Edge Functions)

---

## Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Requisitos de Infraestrutura](#2-requisitos-de-infraestrutura)
3. [Deploy e Hospedagem (Netlify)](#3-deploy-e-hospedagem-netlify)
4. [Banco de Dados — Tabelas Principais](#4-banco-de-dados--tabelas-principais)
5. [Autenticação e Controle de Acesso (RBAC)](#5-autenticação-e-controle-de-acesso-rbac)
6. [Configuração da Paróquia](#6-configuração-da-paróquia)
7. [Identidade Visual e Temas](#7-identidade-visual-e-temas)
8. [Gateway de Pagamento — e.Rede (Itaú)](#8-gateway-de-pagamento--erede-itaú)
9. [Integração TEF — Maquininha Física](#9-integração-tef--maquininha-física)
10. [Integração SendGrid — E-mails de Agradecimento](#10-integração-sendgrid--e-mails-de-agradecimento)
11. [Totem de Autoatendimento](#11-totem-de-autoatendimento)
12. [Edge Functions (Backend)](#12-edge-functions-backend)
13. [Variáveis de Ambiente e Secrets](#13-variáveis-de-ambiente-e-secrets)
14. [Segurança — RLS e Políticas](#14-segurança--rls-e-políticas)
15. [Backup e Restauração](#15-backup-e-restauração)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                     │
│   Totem  │  Painel Admin  │  Área Paroquiano  │  Kiosk  │
└─────────────┬───────────────────────────────────────────┘
              │ HTTPS
┌─────────────▼───────────────────────────────────────────┐
│              LOVABLE CLOUD (Supabase)                    │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Auth     │  │ PostgreSQL   │  │ Edge Functions     │  │
│  │ (JWT)    │  │ (RLS)        │  │ (Deno Runtime)     │  │
│  └──────────┘  └──────────────┘  └─────────┬─────────┘  │
│                                            │             │
│  ┌──────────┐                    ┌─────────▼─────────┐  │
│  │ Storage  │                    │ APIs Externas      │  │
│  │ (logos)  │                    │ • e.Rede (Itaú)    │  │
│  └──────────┘                    │ • SendGrid         │  │
│                                  │ • Connect TEF      │  │
│                                  └───────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Stack Tecnológica

| Camada        | Tecnologia                              |
|---------------|-----------------------------------------|
| Frontend      | React 18, TypeScript, Tailwind CSS, Vite |
| UI Components | shadcn/ui (Radix UI)                     |
| Estado        | React Query (TanStack)                   |
| Backend       | Supabase (PostgreSQL + Edge Functions)   |
| Auth          | Supabase Auth (JWT)                      |
| Pagamentos    | e.Rede (Itaú) via OAuth 2.0             |
| TEF           | Connect TEF (middleware REST)            |
| E-mail        | SendGrid API v3                          |
| Hospedagem    | Netlify (frontend) + Lovable Cloud       |

---

## 2. Requisitos de Infraestrutura

### Mínimos

- **Navegador:** Chrome 90+ ou Edge 90+ (Totem recomenda Chrome em modo kiosk)
- **Impressora térmica:** 80mm com suporte ESC/POS (para comprovantes do totem)
- **Conexão internet:** 5 Mbps estável (totem necessita conexão permanente)
- **Conta SendGrid:** Plano Free (100 e-mails/dia) ou superior
- **Credencial e.Rede:** PV (Point of Value) ativo no Itaú Rede

### Para Totem Físico

- Tablet/PC com tela touch (mínimo 10")
- Chrome em modo kiosk: `--kiosk --disable-pinch --overscroll-history-navigation=0`
- Impressora térmica USB conectada ao dispositivo

---

## 3. Deploy e Hospedagem (Netlify)

### 3.1 Build

```bash
npm run build
# ou
bun run build
```

O output será gerado em `dist/`.

### 3.2 Configuração do Netlify

1. Conecte o repositório GitHub ao Netlify
2. Configure:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Node version:** 18+

3. Crie o arquivo `public/_redirects` (já incluído):
```
/*    /index.html   200
```

### 3.3 Variáveis de Ambiente no Netlify

Acesse **Site settings → Environment variables** e adicione:

| Variável                          | Descrição                              | Exemplo                                         |
|-----------------------------------|----------------------------------------|--------------------------------------------------|
| `VITE_SUPABASE_URL`              | URL do projeto Supabase                | `https://ulqxcfpfjglomsamnycf.supabase.co`      |
| `VITE_SUPABASE_PUBLISHABLE_KEY`  | Chave anon (pública) do Supabase       | `eyJhbGciOiJIUzI1NiIs...`                       |

> ⚠️ **Nunca** adicione chaves `service_role` no frontend. Elas ficam nas Edge Functions.

### 3.4 Domínio Personalizado

No Netlify: **Domain settings → Add custom domain**

Exemplo: `dizimos.paroquiasscc.com.br`

---

## 4. Banco de Dados — Tabelas Principais

### Diagrama Relacional

```
configuracoes_paroquia (1 registro)
├── nome, cnpj, telefone, endereco, site
├── chave_pix, pin_totem
├── logo_url, logo_termico_url
├── cor_primaria, cor_secundaria, slogan
│
configuracoes_gateway (1 registro)
├── modo (simulacao | sandbox | producao)
├── client_id, client_secret (OAuth e.Rede)
├── merchant_id (PV), webhook_secret
├── pix_expiracao_minutos, parcelamento_max
│
configuracoes_tef (1 registro)
├── middleware_url, middleware_token
├── terminal_id, modo, timeout_segundos
│
paroquianos ──────────┐
├── nome_completo      │
├── cpf, email, tel    │
├── comunidade_id ─────┼──► comunidades
├── status             │
├── valor_sugerido     │
│                      │
pagamentos ◄───────────┘
├── tipo (dizimo|oferta|campanha|eventual)
├── valor, metodo (pix|credito|debito)
├── status (criado|aguardando|pago|cancelado|expirado|estornado)
├── paroquiano_id ──► paroquianos
├── campanha_id ────► campanhas
├── origem (web|totem|admin|kiosk)
├── gateway_id, gateway_payload
├── pix_qrcode, pix_copia_cola
│
campanhas
├── nome, descricao, meta_financeira
├── data_inicio, data_fim, total_arrecadado
│
mensagens_personalizadas
├── tipo, titulo, mensagem, versiculo
│
comprovantes ──► pagamentos
│
logs_auditoria
│
logs_webhook ──► pagamentos
│
profiles ──► auth.users (via trigger)
│
user_roles ──► auth.users
├── role (super_admin|admin|dizimista|totem)
│
servos ──► auth.users
├── nome, cpf, ativo
│
totens ──► auth.users
├── nome, cor, ativo
│
categorias_pagamento
```

### Enums do Sistema

| Enum                | Valores                                                    |
|---------------------|------------------------------------------------------------|
| `app_role`          | `super_admin`, `admin`, `dizimista`, `totem`               |
| `contribuicao_tipo` | `dizimo`, `oferta`, `campanha`, `eventual`                 |
| `pagamento_metodo`  | `pix`, `credito`, `debito`                                 |
| `pagamento_status`  | `criado`, `aguardando_pagamento`, `pago`, `cancelado`, `expirado`, `estornado` |
| `paroquiano_status` | `ativo`, `inativo`, `suspenso`, `inadimplente`             |

---

## 5. Autenticação e Controle de Acesso (RBAC)

### Papéis (Roles)

| Role          | Acesso                                               |
|---------------|------------------------------------------------------|
| `super_admin` | Tudo: gateway, servos, configurações, dados sensíveis |
| `admin`       | Painel administrativo (exceto gateway e servos)       |
| `dizimista`   | Área do paroquiano (histórico, contribuir, comprovantes) |
| `totem`       | Acesso apenas ao fluxo do totem (sem painel)          |

### Fluxo de Autenticação

1. Usuário faz login com e-mail/senha
2. Trigger `handle_new_user()` cria perfil e atribui role `dizimista` automaticamente
3. O `AuthContext` busca a role via tabela `user_roles`
4. Rotas protegidas verificam `isAdmin()` ou `isSuperAdmin()`

### Cadastro de Colaboradores (Servos)

Via **Painel Admin → Configurações → Colaboradores**:
1. Preencha nome, e-mail, CPF e senha
2. A Edge Function `create-servo` cria o usuário no Auth e insere na tabela `servos` com role `admin`
3. Para desativar: use o toggle na listagem (revoga role `admin` via `toggle-servo`)

---

## 6. Configuração da Paróquia

Acesse **Painel Admin → Configurações → Dados da Paróquia**.

| Campo         | Descrição                              | Exemplo                         |
|---------------|----------------------------------------|---------------------------------|
| Nome          | Nome oficial da paróquia               | Paróquia Senhor Santo Cristo    |
| CNPJ          | CNPJ da instituição                    | 12.345.678/0001-90              |
| Telefone      | Contato principal                      | (48) 99999-0000                 |
| Endereço      | Endereço completo                      | Rua da Igreja, 100 - Centro     |
| Site          | URL do site da paróquia               | https://paroquiasscc.com.br     |
| Chave PIX     | Chave PIX para recebimento             | 12345678000190                  |
| PIN do Totem  | Código numérico (até 8 dígitos)        | 1234                            |

---

## 7. Identidade Visual e Temas

Acesse **Painel Admin → Configurações → Identidade Visual**.

### Cores (formato HSL)

| Campo           | Descrição                | Formato           | Exemplo         |
|-----------------|--------------------------|--------------------|-----------------| 
| Cor Primária    | Cor principal do sistema | `H S% L%`         | `40 55% 54%`    |
| Cor Secundária  | Cor de destaque          | `H S% L%`         | `350 60% 28%`   |

> As cores são aplicadas dinamicamente via CSS variables (`--primary`, `--secondary`) em todo o sistema, incluindo totem e e-mails.

### Logos

| Logo             | Uso                                     | Formato       | Tamanho Máximo |
|------------------|-----------------------------------------|---------------|----------------|
| Logo Principal   | Totem, e-mails, painel admin           | PNG/JPG/SVG   | 200 KB         |
| Logo Térmico     | Comprovantes da impressora térmica      | PNG (P&B)     | 2 MB           |

O logo térmico é armazenado no Storage bucket `logos-termicos`.

### Slogan

Texto opcional exibido abaixo do logo no totem. Exemplo: *"Servindo a comunidade com amor"*

---

## 8. Gateway de Pagamento — e.Rede (Itaú)

### 8.1 Pré-requisitos

1. **Cadastro no Portal de Desenvolvedores Rede:** [https://www.userede.com.br/desenvolvedores](https://www.userede.com.br/desenvolvedores)
2. **PV (Point of Value):** Número de afiliação ativo
3. **Credenciais OAuth 2.0:** Client ID e Client Secret gerados no portal

### 8.2 Configuração no Sistema

Acesse **Painel Admin → Configurações → Gateway de Pagamento** (apenas Super Admin).

| Campo                 | Descrição                                 | Obrigatório |
|-----------------------|-------------------------------------------|-------------|
| Modo                  | `simulacao`, `sandbox` ou `producao`      | ✅           |
| Client ID (PV)        | ID da aplicação OAuth                     | ✅ (prod)    |
| Client Secret         | Secret da aplicação OAuth                 | ✅ (prod)    |
| Merchant ID           | Número PV (afiliação) da Rede             | ✅ (prod)    |
| PIX Expiração (min)   | Tempo de expiração do QR Code PIX         | Padrão: 10   |
| Parcelamento Máx      | Número máximo de parcelas                 | Padrão: 12   |
| Webhook Secret        | Secret para validação de webhooks         | Opcional     |

### 8.3 Modos de Operação

| Modo        | Descrição                                                  |
|-------------|-------------------------------------------------------------|
| `simulacao` | Sem comunicação com API. Pagamentos aprovados automaticamente. Ideal para testes iniciais. |
| `sandbox`   | Comunica com sandbox da Rede. Use cartões de teste.         |
| `producao`  | Transações reais. **⚠️ Dinheiro real será cobrado.**        |

### 8.4 URLs da API e.Rede

| Ambiente  | OAuth URL                                                       | API URL                                              |
|-----------|-----------------------------------------------------------------|------------------------------------------------------|
| Sandbox   | `https://rl7-sandbox-api.useredecloud.com.br/oauth2/token`     | `https://sandbox-erede.useredecloud.com.br`          |
| Produção  | `https://api.userede.com.br/redelabs/oauth2/token`             | `https://api.userede.com.br/erede`                   |

### 8.5 Fluxo PIX

```
1. Totem → Edge Function (rede-gateway-totem)
2. Edge Function → OAuth Token (e.Rede)
3. Edge Function → POST /v2/transactions (kind: "pix")
4. API retorna QR Code + Copia e Cola
5. Totem exibe QR Code → Polling de status
6. Pagamento confirmado → status = "pago"
```

### 8.6 Fluxo Cartão (Crédito/Débito)

```
1. Totem coleta dados do cartão
2. Edge Function → OAuth Token (e.Rede)
3. Edge Function → POST /v2/transactions (kind: "credit"|"debit")
4. API processa e retorna aprovação/recusa
5. Se aprovado → status = "pago"
```

### 8.7 Cartões de Teste (Sandbox)

| Bandeira    | Número               | Validade | CVV  |
|-------------|----------------------|----------|------|
| Visa        | 4000 0000 0000 0001  | 12/30    | 123  |
| Mastercard  | 5500 0000 0000 0004  | 12/30    | 123  |

### 8.8 Webhook

URL de callback: Exibida no painel de configurações. Registre-a no portal da Rede.

```
https://<SUPABASE_URL>/functions/v1/rede-gateway
```

Os logs de webhook são exibidos em **Configurações → Logs de Webhook**.

---

## 9. Integração TEF — Maquininha Física

### 9.1 O que é

A integração TEF (Transferência Eletrônica de Fundos) permite usar maquininhas de cartão físicas (Rede Itaú) via middleware **Connect TEF**.

### 9.2 Pré-requisitos

1. Maquininha Rede Itaú (POS)
2. Middleware Connect TEF instalado na rede local
3. Comunicação HTTP entre o servidor/totem e o middleware

### 9.3 Configuração

Acesse **Painel Admin → Configurações → Integração Maquininha (TEF)**.

| Campo              | Descrição                                    | Exemplo                            |
|--------------------|----------------------------------------------|-------------------------------------|
| URL do Middleware  | Endpoint REST do Connect TEF                 | `http://192.168.1.100:8080`         |
| Token              | API Key ou token de autenticação             | `sk_tef_abc123...`                  |
| Terminal ID        | Identificador da maquininha                  | `TERM001`                           |
| Modo               | `simulacao`, `sandbox` ou `producao`         | `simulacao`                         |
| Timeout (seg)      | Tempo máximo de espera pela transação        | `60`                                |
| Ativo              | Liga/desliga a integração                    | `true`                              |

### 9.4 Modos de Operação

| Modo        | Comportamento                                                                  |
|-------------|--------------------------------------------------------------------------------|
| `simulacao` | Nenhuma conexão real. Pagamentos são aprovados automaticamente após ~5 segundos |
| `sandbox`   | Conecta ao middleware em modo de teste                                          |
| `producao`  | Transações reais na maquininha física                                          |

### 9.5 Teste de Conexão

Use o botão **"Testar Conexão"** no painel para verificar a comunicação com o middleware. O resultado (conectado/erro/desconectado) é exibido na badge de status.

---

## 10. Integração SendGrid — E-mails de Agradecimento

### 10.1 Visão Geral

Após cada contribuição confirmada, o sistema envia automaticamente um e-mail de agradecimento ao paroquiano (se ele tiver e-mail cadastrado).

### 10.2 Pré-requisitos

1. Conta SendGrid: [https://sendgrid.com](https://sendgrid.com)
2. API Key com permissão `Mail Send`
3. Remetente verificado (Single Sender ou Domain Authentication)

### 10.3 Configuração de Secrets

As credenciais devem ser configuradas como **secrets nas Edge Functions** (via Lovable Cloud ou Supabase CLI):

| Secret                | Descrição                         | Exemplo                   |
|-----------------------|-----------------------------------|---------------------------|
| `SENDGRID_API_KEY`    | Chave de API do SendGrid          | `SG.xxxxxxxx...`          |
| `SENDGRID_FROM_EMAIL` | E-mail remetente (verificado)     | `noreply@paroquia.com.br` |

**Como adicionar via CLI:**

```bash
supabase secrets set SENDGRID_API_KEY=SG.sua_chave_aqui
supabase secrets set SENDGRID_FROM_EMAIL=noreply@paroquia.com.br
```

### 10.4 Template do E-mail

O template HTML é gerado pela Edge Function `enviar-email-agradecimento` e inclui:

- **Header:** Logo da paróquia + nome (cor primária como background)
- **Corpo:** Saudação personalizada, resumo da contribuição (tipo, valor, método, data, ID)
- **Citação bíblica:** 2 Coríntios 9,7
- **Footer:** Nome da paróquia, CNPJ, site + aviso "não responda"

> O template utiliza automaticamente a **identidade visual** configurada (logo, cores).

### 10.5 Fluxo

```
1. Pagamento confirmado (status = "pago")
2. Tela de confirmação invoca Edge Function "enviar-email-agradecimento"
3. Edge Function busca e-mail do paroquiano no banco
4. Se e-mail encontrado → monta HTML personalizado → envia via SendGrid
5. Se sem e-mail → retorna silenciosamente (sem erro)
```

---

## 11. Totem de Autoatendimento

### 11.1 Acesso

URL: `https://<seu-dominio>/totem`

O totem é protegido por PIN numérico (configurado em **Dados da Paróquia → PIN do Totem**).

### 11.2 Fluxo de Uso

```
1. Tela inicial → Selecionar tipo (Dízimo, Oferta, Campanha, Doação)
2. Identificação:
   - Dízimo: busca por matrícula ou nome (obrigatório)
   - Outros: nome opcional
3. Mês de referência (apenas dízimo)
4. Valor (com sugestão para dizimistas cadastrados)
5. Método de pagamento (PIX, Cartão, Maquininha)
6. Processamento do pagamento
7. Tela de confirmação:
   - Dízimo: comprovante impresso automaticamente
   - Outros: botão para imprimir comprovante
   - E-mail de agradecimento enviado automaticamente
8. Auto-reset em 30 segundos
```

### 11.3 Configuração do Dispositivo

**Chrome em modo Kiosk (recomendado):**

```bash
# Windows
chrome.exe --kiosk --disable-pinch --overscroll-history-navigation=0 "https://dizimos.paroquia.com.br/totem"

# Linux
google-chrome --kiosk --disable-pinch --overscroll-history-navigation=0 "https://dizimos.paroquia.com.br/totem"
```

**Flags recomendadas:**

| Flag                              | Descrição                         |
|-----------------------------------|-----------------------------------|
| `--kiosk`                         | Tela cheia sem barra de endereço |
| `--disable-pinch`                 | Desabilita zoom por pinch        |
| `--overscroll-history-navigation=0` | Desabilita gesto de "voltar"   |
| `--disable-session-crashed-bubble` | Remove aviso de crash            |
| `--noerrdialogs`                  | Suprime diálogos de erro         |

### 11.4 Impressora Térmica

- O comprovante é gerado via HTML em uma janela popup (`window.open`)
- Formato: 80mm de largura, fonte Courier New monospace
- A impressora deve ser configurada como padrão no SO
- Logo térmico (P&B) é usado quando disponível

### 11.5 Timeout e Inatividade

- **Timeout de sessão:** 120 segundos de inatividade → sessão encerrada
- **Auto-reset confirmação:** 30 segundos → volta para tela inicial
- **Expiração PIX:** Configurável (padrão 10 minutos)

---

## 12. Edge Functions (Backend)

### Lista Completa

| Função                         | Descrição                                      | JWT   |
|--------------------------------|-------------------------------------------------|-------|
| `rede-gateway`                | Gateway e.Rede para web + webhook              | Não   |
| `rede-gateway-totem`          | Gateway e.Rede específico para totem           | Não   |
| `tef-gateway`                 | Gateway Connect TEF (maquininha)               | Não   |
| `totem-buscar-paroquiano`     | Busca paroquiano por matrícula/nome            | Não   |
| `totem-pin`                   | Validação do PIN de acesso ao totem            | Não   |
| `totem-pix-status`            | Polling do status do pagamento PIX             | Não   |
| `create-servo`                | Cadastro de colaborador (servo) com auth       | Não   |
| `toggle-servo`                | Ativa/desativa colaborador                     | Não   |
| `create-totem`                | Cadastro de dispositivo totem                  | Não   |
| `create-paroquiano`           | Cadastro de paroquiano com user auth           | Não   |
| `enviar-email-agradecimento`  | Envio de e-mail de agradecimento (SendGrid)    | Não   |

> **Nota:** `verify_jwt = false` significa que a validação JWT é feita dentro da função quando necessário, não pelo gateway.

### Estrutura de Arquivos

```
supabase/
├── config.toml                          # Configuração das functions
└── functions/
    ├── rede-gateway/index.ts
    ├── rede-gateway-totem/index.ts
    ├── tef-gateway/index.ts
    ├── totem-buscar-paroquiano/index.ts
    ├── totem-pin/index.ts
    ├── totem-pix-status/index.ts
    ├── create-servo/index.ts
    ├── toggle-servo/index.ts
    ├── create-totem/index.ts
    ├── create-paroquiano/index.ts
    └── enviar-email-agradecimento/index.ts
```

---

## 13. Variáveis de Ambiente e Secrets

### Frontend (.env — gerenciado automaticamente)

| Variável                          | Descrição                      |
|-----------------------------------|--------------------------------|
| `VITE_SUPABASE_URL`              | URL do projeto Supabase        |
| `VITE_SUPABASE_PUBLISHABLE_KEY`  | Chave anon (pública)           |
| `VITE_SUPABASE_PROJECT_ID`       | ID do projeto                  |

### Edge Functions (Secrets — configurar manualmente)

| Secret                      | Descrição                           | Onde configurar             |
|-----------------------------|-------------------------------------|-----------------------------|
| `SUPABASE_URL`              | URL do Supabase (automático)       | Automático                  |
| `SUPABASE_ANON_KEY`         | Chave anon (automático)            | Automático                  |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (automático)      | Automático                  |
| `SENDGRID_API_KEY`          | API Key do SendGrid                | Lovable Cloud / CLI         |
| `SENDGRID_FROM_EMAIL`       | E-mail remetente verificado        | Lovable Cloud / CLI         |

> As credenciais do gateway (e.Rede) e TEF são armazenadas no banco de dados (tabelas `configuracoes_gateway` e `configuracoes_tef`), **não** em secrets.

---

## 14. Segurança — RLS e Políticas

### Row Level Security (RLS)

Todas as tabelas possuem RLS ativado. As políticas garantem:

- **Paroquianos:** Podem ver apenas seus próprios dados
- **Admins:** Acesso total via função `has_role()`
- **Totem:** Acesso restrito a operações de leitura de paroquianos e inserção de pagamentos
- **Pagamentos:** Visíveis apenas ao dono ou admin
- **Configurações:** Apenas admins podem ler/modificar
- **Service Role:** Edge Functions usam `SUPABASE_SERVICE_ROLE_KEY` para bypass de RLS quando necessário

### Boas Práticas

1. **Nunca** exponha a `service_role_key` no frontend
2. Sempre use a chave `anon` no cliente
3. Dados sensíveis (CPF, cartão) são processados server-side nas Edge Functions
4. Números de cartão **nunca** são armazenados — passam direto para a API da Rede
5. Logs de auditoria registram ações administrativas

---

## 15. Backup e Restauração

### Backup do Schema

O schema SQL está disponível em: `public/backup_schema.sql`

### Exportar Dados

Use o painel do Lovable Cloud ou Supabase CLI:

```bash
# Exportar schema
supabase db dump > backup_schema.sql

# Exportar dados específicos
supabase db dump --data-only --table pagamentos > pagamentos_backup.sql
```

### Restaurar

```bash
psql -h <host> -U postgres -d postgres < backup_schema.sql
```

---

## 16. Troubleshooting

### Problema: "Configurações do gateway não encontradas"

**Causa:** Tabela `configuracoes_gateway` vazia.  
**Solução:** Acesse o painel admin → Configurações → Gateway e salve a configuração (mesmo em modo simulação).

### Problema: "Falha OAuth" ao processar pagamento

**Causa:** Client ID ou Client Secret inválidos.  
**Solução:**
1. Verifique as credenciais no portal e.Rede
2. Confirme que o modo correto está selecionado (sandbox vs produção)
3. Verifique se o PV está ativo

### Problema: QR Code PIX não aparece

**Causa:** Resposta da API sem campo `pix.qrCode`.  
**Solução:**
1. Verifique logs do Edge Function
2. Confirme que o PV tem PIX habilitado
3. Teste em modo simulação primeiro

### Problema: Comprovante não imprime

**Causa:** Popup bloqueado pelo navegador.  
**Solução:**
1. Permita popups para o domínio do sistema
2. Em modo kiosk, popups são permitidos automaticamente
3. Verifique se a impressora está configurada como padrão

### Problema: E-mail de agradecimento não enviado

**Causa:** Possíveis causas:
1. Paroquiano sem e-mail cadastrado → verifique o cadastro
2. Secret `SENDGRID_API_KEY` não configurada → adicione via CLI
3. Remetente não verificado no SendGrid → verifique Domain/Sender Authentication
4. Limite diário do plano Free excedido (100/dia)

**Diagnóstico:** Verifique os logs da Edge Function no Lovable Cloud.

### Problema: PIN do totem não funciona

**Causa:** PIN não configurado ou formato inválido.  
**Solução:** Acesse Configurações → Dados da Paróquia → PIN do Totem (apenas números, até 8 dígitos).

### Problema: Maquininha não responde

**Causa:** Middleware Connect TEF offline ou URL incorreta.  
**Solução:**
1. Use "Testar Conexão" no painel TEF
2. Verifique se o middleware está rodando
3. Confirme a URL e porta do middleware
4. Verifique se o modo não está em "simulação"

### Problema: Cores do tema não aplicadas

**Causa:** Formato de cor inválido.  
**Solução:** Use formato HSL sem `hsl()`: `40 55% 54%` (não `hsl(40, 55%, 54%)`)

---

## Contato Técnico

Para suporte técnico, consulte:
- **Documentação Lovable:** [https://docs.lovable.dev](https://docs.lovable.dev)
- **API e.Rede:** [https://www.userede.com.br/desenvolvedores](https://www.userede.com.br/desenvolvedores)
- **SendGrid Docs:** [https://docs.sendgrid.com](https://docs.sendgrid.com)
- **Connect TEF:** Consulte a documentação fornecida pelo provedor

---

*Este manual é gerado automaticamente e deve ser atualizado conforme novas funcionalidades forem adicionadas ao sistema.*

---

## 17. Matriz de Provedores × Métodos de Pagamento

| Provedor / Adquirente   | PIX (online) | Cartão (online) | Maquininha TEF (presencial) | Webhook  | Reconciliação cron |
|-------------------------|:---:|:---:|:---:|:---:|:---:|
| **e.Rede (Itaú)**       | ✅ | ✅ | — (usar Connect TEF) | nativo Rede | não necessária (status push) |
| **Sicredi / Sipag**     | ✅ | ✅ | ✅ (`sipag`)        | ✅ HMAC      | ✅ a cada 2 min     |
| **Pagar.me v5**         | ✅ | ✅ | ✅ via Stone (`pagarme_stone`) | ✅ HMAC | ✅ a cada 2 min |
| **PayGo / SiTef**       | — | — | ✅ (`paygo`)        | —           | n/a (TEF síncrono) |
| **Connect TEF (Rede)**  | — | — | ✅ (`connect_tef`, padrão) | — | n/a |

**Notas:**
- Online (PIX/Cartão) e TEF (maquininha) são canais independentes — podem usar provedores diferentes em paralelo.
- Em caso de falha do provedor online principal, o sistema tenta automaticamente o `provedor_fallback` configurado em `configuracoes_gateway`.
- O cron de reconciliação consulta status dos PIX `aguardando_pagamento` há mais de 30 segundos e atualiza o banco quando o webhook é perdido.
- Idempotência: cada transação usa `idempotency_key` (índice único parcial) — retentativas com a mesma chave não geram cobrança duplicada.
- Rate-limit ativo nas funções públicas: `totem-pix-status` (120/min), `totem-buscar-paroquiano` (30/min), `register-dizimista` (5/h).

