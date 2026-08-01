# 🚀 DízimoSC — Guia de Instalação Externa

Este guia explica como instalar o sistema DízimoSC usando um **Supabase externo** + **Netlify** (ou outro hosting), a partir de um repositório GitHub.

---

## Índice

1. [Pré-requisitos](#1-pré-requisitos)
2. [Clonar o Repositório](#2-clonar-o-repositório)
3. [Criar Projeto Supabase](#3-criar-projeto-supabase)
4. [Executar o Schema SQL](#4-executar-o-schema-sql)
5. [Criar o Super Admin](#5-criar-o-super-admin)
6. [Configurar Variáveis de Ambiente](#6-configurar-variáveis-de-ambiente)
7. [Deploy do Frontend (Netlify)](#7-deploy-do-frontend-netlify)
8. [Deploy das Edge Functions](#8-deploy-das-edge-functions)
9. [Configurar Secrets das Edge Functions](#9-configurar-secrets-das-edge-functions)
10. [Verificação Pós-Deploy](#10-verificação-pós-deploy)
11. [Client Local (Totem)](#11-client-local-totem)
12. [Troubleshooting](#troubleshooting)

---

## 1. Pré-requisitos

| Requisito | Versão |
|-----------|--------|
| **Node.js** | 20+ LTS |
| **npm** | 10+ |
| **Supabase CLI** | 2.x+ (`npm i -g supabase`) |
| **Conta Supabase** | [supabase.com](https://supabase.com) (plano Free é suficiente) |
| **Conta Netlify** | [netlify.com](https://netlify.com) (plano Free) |
| **Git** | Para clonar o repositório |

---

## 2. Clonar o Repositório

```bash
git clone https://github.com/SEU_USUARIO/dizimosc.git
cd dizimosc
npm install
```

---

## 3. Criar Projeto Supabase

### Opção A — Supabase Cloud (recomendado)

1. Acesse [app.supabase.com](https://app.supabase.com)
2. Clique **"New Project"**
3. Escolha organização, nome e região (preferencialmente `South America (São Paulo)`)
4. Anote:
   - **Project Ref:** o código único (ex: `abcdefghijk`)
   - **Project URL:** `https://abcdefghijk.supabase.co`
   - **Anon Key:** Encontrada em **Settings → API → anon public**
   - **Service Role Key:** Encontrada em **Settings → API → service_role** ⚠️ nunca exponha no frontend

### Opção B — Supabase Self-hosted (Docker)

```bash
git clone https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
# Edite .env com suas configurações
docker compose up -d
```

> Consulte: [docs.supabase.com/docs/guides/self-hosting](https://supabase.com/docs/guides/self-hosting)

---

## 4. Executar o Schema SQL

O arquivo `public/backup_schema.sql` contém **toda** a estrutura do banco e é **idempotente** (pode ser executado múltiplas vezes sem erros).

### Via Dashboard Supabase

1. Acesse **SQL Editor** no Supabase Dashboard
2. Cole o conteúdo de `public/backup_schema.sql`
3. Clique **Run**
4. Verifique que não houve erros

### Via Supabase CLI

```bash
supabase link --project-ref SEU_PROJECT_REF
supabase db execute --file public/backup_schema.sql
```

### O que o script cria

| Recurso | Quantidade |
|---------|-----------|
| Enums | 5 |
| Tabelas | 23 |
| Funções | 14+ |
| Triggers | 18+ |
| Políticas RLS | 70+ |
| Índices | 35+ |
| Storage Buckets | 4 |

---

## 5. Criar o Super Admin

### Passo 1 — Registrar via Dashboard

1. No Supabase Dashboard, vá em **Authentication → Users → Add User**
2. Insira e-mail e senha do administrador
3. Marque **Auto Confirm User** se desejar login imediato

### Passo 2 — Promover a Super Admin

No SQL Editor, execute:

```sql
-- Substitua pelo user_id real (encontrado em Authentication → Users)
UPDATE public.user_roles
SET role = 'super_admin'
WHERE user_id = 'SEU_USER_ID_AQUI';
```

> O trigger `handle_new_user` cria automaticamente o perfil e atribui role `dizimista`. Você só precisa atualizar para `super_admin`.

---

## 6. Configurar Variáveis de Ambiente

### Frontend (.env)

Copie o arquivo de exemplo e preencha:

```bash
cp .env.example .env
```

Edite o `.env`:

```env
VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_anon_key_aqui
VITE_SUPABASE_PROJECT_ID=SEU_PROJECT_REF
```

### Testar localmente

```bash
npm run dev
# Acesse http://localhost:8080
```

---

## 7. Deploy do Frontend (Netlify)

### Via Netlify UI (recomendado)

1. Conecte o repositório ao Netlify
2. As configurações de build já estão no `netlify.toml`:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
3. Adicione as variáveis de ambiente em **Site settings → Environment variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
4. O `netlify.toml` e `public/_redirects` já estão configurados para SPA

### Via Netlify CLI

```bash
npm run build
npx netlify deploy --prod --dir=dist
```

### Alternativas

**Vercel:**
```bash
npm run build
vercel deploy --prod
```

**Qualquer hosting estático:**
```bash
npm run build
# Sirva a pasta dist/ com qualquer servidor HTTP
# Configure redirecionamento de /* → /index.html para o React Router
```

---

## 8. Deploy das Edge Functions

As Edge Functions ficam em `supabase/functions/` e precisam ser deployadas no seu projeto Supabase.

```bash
# Conecte ao projeto (se ainda não fez)
supabase link --project-ref SEU_PROJECT_REF

# Deploy de todas as funções
supabase functions deploy

# Ou uma específica
supabase functions deploy rede-gateway-totem
```

### Configuração de JWT

As funções precisam de `verify_jwt = false` para funcionar corretamente. Isso já está configurado no `supabase/config.toml`, mas **você deve alterar o `project_id`**:

```toml
# supabase/config.toml — altere para seu project_id
project_id = "SEU_PROJECT_REF"
```

### Lista de Edge Functions

| Função | Descrição |
|--------|-----------|
| `create-paroquiano` | Cadastro de paroquiano via portal admin |
| `create-servo` | Cadastro de colaborador (admin) |
| `create-totem` | Cadastro de totem com conta auth |
| `toggle-servo` | Ativar/desativar colaborador |
| `register-dizimista` | Auto-registro de dizimista |
| `admin-reset-password` | Reset de senha por admin |
| `rede-gateway` | Gateway de pagamentos (web) |
| `rede-gateway-totem` | Gateway de pagamentos (totem) |
| `tef-gateway` | Proxy para middleware TEF local |
| `totem-buscar-paroquiano` | Buscar paroquiano por CPF/matrícula |
| `totem-config` | Configuração pública do totem |
| `totem-pin` | Validação do PIN do totem |
| `totem-pix-status` | Polling de status do PIX |
| `enviar-email-agradecimento` | E-mail pós-contribuição (via Resend) |
| `enviar-email-aniversario` | E-mail de aniversário (via Resend) |

---

## 9. Configurar Secrets das Edge Functions

```bash
# Obrigatórios (já são automáticos no Supabase Cloud, mas verifique)
supabase secrets set SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
supabase secrets set SUPABASE_ANON_KEY=sua_anon_key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
```

### Verificar secrets configurados

```bash
supabase secrets list
```

> As Edge Functions validam a presença dessas variáveis e retornam erro 500 descritivo se estiverem ausentes.

### Secrets opcionais

| Secret | Para quê |
|--------|---------|
| Resend API Key | Configurado via painel admin → Configurações (salvo no banco) |
| Credenciais e.Rede | Configurado via painel admin → Configurações → Gateway |
| TEF Middleware | Configurado via painel admin → Integração Maquininha |

---

## 10. Verificação Pós-Deploy

### Checklist

- [ ] Frontend carrega sem erros no console
- [ ] Login funciona (email/senha)
- [ ] Painel admin acessível após login como super_admin
- [ ] Configurações da paróquia salvam corretamente
- [ ] Totem carrega em `/totem`
- [ ] Edge Functions respondem

### Testar Edge Functions

```bash
# Testar totem-config (não requer auth)
curl -X POST https://SEU_PROJECT_REF.supabase.co/functions/v1/totem-config \
  -H "Content-Type: application/json" \
  -d '{}'

# Testar totem-pin
curl -X POST https://SEU_PROJECT_REF.supabase.co/functions/v1/totem-pin \
  -H "Content-Type: application/json" \
  -d '{"pin":"1234"}'
```

### Verificar Tabelas

No SQL Editor:

```sql
SELECT * FROM public.configuracoes_paroquia;  -- Deve retornar 1 registro
SELECT * FROM public.profiles;                 -- Deve mostrar seu usuário
SELECT * FROM public.user_roles;               -- Deve mostrar 'super_admin'
```

---

## 11. Client Local (Totem)

Se for usar totem com impressora térmica e/ou maquininha, instale o **Client Local** na máquina Windows.

```bash
cd client-local
npm install
scripts\setup.bat          # Wizard interativo
scripts\install-service.bat # Instalar como serviço Windows
```

Consulte:
- 📖 `client-local/README.md` — Documentação completa
- 🖥️ `public/DEPLOY_KIOSK.md` — Configuração em modo Kiosk

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| `relation "xxx" does not exist` | Execute `backup_schema.sql` novamente — é idempotente |
| `permission denied for schema auth` | Use a service_role key nas Edge Functions |
| Edge Function retorna 500 | Verifique secrets: `supabase secrets list` |
| Edge Function: "Missing required environment variables" | Configure via `supabase secrets set` |
| Login não funciona | Verifique se Email Auth está habilitado em Authentication → Providers |
| RLS bloqueando queries | Verifique se o usuário tem a role correta em `user_roles` |
| `Could not find the 'pgcrypto' extension` | Execute: `CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;` |
| Storage upload falha | Verifique se os buckets foram criados e as policies de storage existem |
| `project_id` no config.toml | Altere para o ref do seu projeto Supabase |

---

## Estrutura do Projeto

```
dizimosc/
├── src/                          # Frontend React + TypeScript
│   ├── components/               # Componentes reutilizáveis
│   ├── pages/                    # Páginas (admin, paroquiano, totem)
│   ├── contexts/                 # AuthContext, ThemeContext
│   ├── integrations/supabase/    # Client e types (auto-gerados)
│   └── lib/                      # Utilitários
├── supabase/
│   ├── functions/                # Edge Functions (Deno)
│   │   ├── _shared/              # Helpers compartilhados
│   │   └── */index.ts            # Cada função
│   └── config.toml               # Config do projeto (alterar project_id)
├── client-local/                 # Módulo local (impressora + TEF)
├── public/
│   ├── backup_schema.sql         # Schema completo e idempotente
│   ├── DEPLOY_KIOSK.md           # Guia de deploy kiosk
│   └── MANUAL_TECNICO.md         # Documentação técnica
├── .env.example                  # Template de variáveis de ambiente
├── netlify.toml                  # Config do Netlify
└── package.json
```

---

## Regenerar Types TypeScript

Após alterações no schema, regenere os types:

```bash
supabase gen types typescript --project-id SEU_PROJECT_REF > src/integrations/supabase/types.ts
```

---

*Última atualização: Março 2026 — v2.1.0*
