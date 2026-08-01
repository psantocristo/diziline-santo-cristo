# Provisionamento de Nova Paróquia (Opção A — Multi-Projeto)

Cada paróquia = **1 projeto Supabase isolado + 1 deploy Cloudflare Pages**.
Isolamento total de dados, gateways, secrets e domínio.

## Pré-requisitos (uma vez por máquina)

```bash
# CLIs
brew install supabase/tap/supabase jq
bun add -g wrangler web-push       # web-push é opcional (gera VAPID)

# Tokens (adicione ao seu ~/.zshrc / secret manager)
export SUPABASE_ACCESS_TOKEN=sbp_xxx      # Personal Access Token
export SUPABASE_ORG_ID=xxxxxxxxxxxx       # ID da organização
export SUPABASE_DB_PASSWORD='SenhaFort#'  # senha do Postgres do novo projeto
export CLOUDFLARE_API_TOKEN=cf_xxx        # opcional (deploy automático)
export CLOUDFLARE_ACCOUNT_ID=xxxxxxx      # opcional
export LOVABLE_API_KEY=lv_xxx             # opcional (IA)
```

## Uso

```bash
./scripts/create-parish.sh \
  --slug   paroquia-sao-jose \
  --name   "Paróquia São José" \
  --region sa-east-1 \
  --admin-email admin@saojose.org.br \
  --admin-password 'SenhaForte#2026' \
  --cnpj   12.345.678/0001-90 \
  --site   https://saojose.org.br \
  --deploy-cloudflare
```

## O que é criado

| Etapa | Recurso                                                   |
|------:|-----------------------------------------------------------|
| 1     | Projeto Supabase (Management API) na região escolhida     |
| 2     | Schema completo via `supabase db push` (todas migrations) |
| 3     | Buckets: logos-termicos, banners, produtos, avisos, avatares |
| 4     | Deploy de **todas** as Edge Functions em `supabase/functions/*` |
| 5     | Secrets: `CARTEIRINHA_HMAC_SECRET`, `VAPID_*`, `LOVABLE_API_KEY` |
| 6     | Usuário `super_admin` + `setup_nova_paroquia()`           |
| 7     | Arquivo `.tenants/<slug>/.env` e `secrets.txt` (chmod 600) |
| 8     | (Opcional) Deploy Cloudflare Pages: `dizimo-<slug>.pages.dev` |

## Estrutura gerada

```
.tenants/
  paroquia-sao-jose/
    .env          → chaves públicas (VITE_*)
    secrets.txt   → service-role, DB URL, HMAC, VAPID (chmod 600, cofre!)
```

## Passos manuais pós-provisionamento

1. Login em `https://dizimo-<slug>.pages.dev` com o e-mail admin.
2. `/admin/configuracoes` → logo, cores, dados fiscais.
3. `/admin/gateway` → credenciais Rede/Sicredi/Pagar.me (produção).
4. `/admin/tef` → CliSiTef/Sipag/PayGo (se totem físico).
5. Domínio próprio: Cloudflare Pages → **Custom domains**.

## Backup / rollback

```bash
supabase db dump --project-ref <ref> -f backup-<slug>-$(date +%F).sql
```

## Excluir uma paróquia

```bash
curl -X DELETE https://api.supabase.com/v1/projects/<ref> \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
wrangler pages project delete dizimo-<slug>
rm -rf .tenants/<slug>
```
