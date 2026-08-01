# Deploy no Cloudflare Pages

Este projeto é uma SPA (Vite + React + React Router) e roda no **Cloudflare Pages** sem nenhuma alteração de código.

## Passo a passo

### 1. Conectar o repositório

1. Acesse https://dash.cloudflare.com → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Selecione o repositório do projeto.

### 2. Configurar o build

| Campo | Valor |
|---|---|
| Framework preset | `Vite` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | (vazio) |
| Node version | `20` (variável `NODE_VERSION=20`) |

### 3. Variáveis de ambiente (Production e Preview)

Adicione em **Settings → Environment variables**:

```
VITE_SUPABASE_URL=https://qvrzjaoelfnriaxcqbkm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key do .env>
VITE_SUPABASE_PROJECT_ID=qvrzjaoelfnriaxcqbkm
NODE_VERSION=20
```

### 4. Roteamento SPA

Já está configurado via `public/_redirects`:

```
/*    /index.html   200
```

Cloudflare Pages respeita esse arquivo nativamente — deep links (ex: `/admin/pagamentos`) e refresh funcionam.

### 5. Cache e segurança

Headers já configurados em `public/_headers`:
- `/assets/*` com cache imutável de 1 ano (hashes do Vite)
- Headers de segurança em todas as rotas

### 6. Deploy

Após salvar, todo `git push` na branch de produção gera um deploy automático. Branches geram **preview deployments** com URL própria.

### 7. Domínio customizado

**Settings → Custom domains → Set up a custom domain** e siga a wizard de DNS.

---

## Notas

- **Edge Functions do Supabase** continuam rodando no Supabase (não migram para Cloudflare). O frontend chama via `supabase.functions.invoke(...)` normalmente.
- **CORS** das edge functions já está configurado em `supabase/functions/_shared/supabase-client.ts` — funciona de qualquer origem.
- **Não use `wrangler.toml`** — este projeto usa Pages (estático), não Workers (SSR).
