#!/usr/bin/env bash
# =============================================================================
# create-parish.sh — Provisionamento automatizado de nova paróquia (Opção A)
# =============================================================================
# Estratégia: 1 projeto Supabase + 1 deploy Cloudflare por paróquia.
#
# O que o script faz:
#   1. Cria um novo projeto Supabase via Management API
#   2. Aplica TODAS as migrations do repositório (esquema idêntico)
#   3. Cria buckets de Storage (logos, banners, produtos, avisos, avatares)
#   4. Faz deploy de todas as Edge Functions (supabase/functions/*)
#   5. Configura secrets base (VAPID, HMAC, service role, LOVABLE_API_KEY)
#   6. Cria o usuário super_admin e roda setup_nova_paroquia()
#   7. Gera .env.<slug> com as chaves publicáveis
#   8. (Opcional) Faz deploy Cloudflare Pages / Workers com o slug
#
# Requisitos locais:
#   - supabase CLI  >= 1.180  (https://supabase.com/docs/guides/cli)
#   - jq, curl, openssl
#   - SUPABASE_ACCESS_TOKEN exportado (Personal Access Token do Supabase)
#   - SUPABASE_ORG_ID       exportado (id da organização)
#   - SUPABASE_DB_PASSWORD  exportado (senha forte p/ Postgres)
#   - (Opcional) CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID p/ deploy
#
# Uso:
#   ./scripts/create-parish.sh \
#       --slug   paroquia-sao-jose \
#       --name   "Paróquia São José" \
#       --region sa-east-1 \
#       --admin-email admin@saojose.org.br \
#       --admin-password 'SenhaForte#2026' \
#       [--cnpj 12.345.678/0001-90] \
#       [--site https://saojose.org.br] \
#       [--deploy-cloudflare]
# =============================================================================
set -euo pipefail

# --------------------------------- helpers -----------------------------------
log()  { printf "\033[1;34m[create-parish]\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m  ✔\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m  ⚠\033[0m %s\n" "$*"; }
die()  { printf "\033[1;31m  ✘ %s\033[0m\n" "$*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "comando obrigatório ausente: $1"; }
need supabase; need jq; need curl; need openssl

# ------------------------------ argumentos -----------------------------------
SLUG="" NAME="" REGION="sa-east-1" ADMIN_EMAIL="" ADMIN_PASS=""
CNPJ="" SITE="" DEPLOY_CF="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slug)              SLUG="$2"; shift 2 ;;
    --name)              NAME="$2"; shift 2 ;;
    --region)            REGION="$2"; shift 2 ;;
    --admin-email)       ADMIN_EMAIL="$2"; shift 2 ;;
    --admin-password)    ADMIN_PASS="$2"; shift 2 ;;
    --cnpj)              CNPJ="$2"; shift 2 ;;
    --site)              SITE="$2"; shift 2 ;;
    --deploy-cloudflare) DEPLOY_CF="true"; shift ;;
    -h|--help)           grep -E '^# ' "$0" | sed 's/^# //'; exit 0 ;;
    *) die "argumento desconhecido: $1" ;;
  esac
done

[[ -n "$SLUG" && -n "$NAME" && -n "$ADMIN_EMAIL" && -n "$ADMIN_PASS" ]] \
  || die "faltando --slug/--name/--admin-email/--admin-password (--help)"

[[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]] || die "exporte SUPABASE_ACCESS_TOKEN"
[[ -n "${SUPABASE_ORG_ID:-}"       ]] || die "exporte SUPABASE_ORG_ID"
[[ -n "${SUPABASE_DB_PASSWORD:-}"  ]] || die "exporte SUPABASE_DB_PASSWORD"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/.tenants/$SLUG"
mkdir -p "$OUT_DIR"

# 1) ------------- criar projeto Supabase via Management API -------------------
log "1/8  criando projeto Supabase '$NAME' na região $REGION…"
CREATE_RES=$(curl -sS -X POST "https://api.supabase.com/v1/projects" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg org "$SUPABASE_ORG_ID" --arg name "$NAME" \
              --arg pass "$SUPABASE_DB_PASSWORD" --arg reg "$REGION" \
        '{organization_id:$org,name:$name,db_pass:$pass,region:$reg,plan:"free"}')")

PROJECT_REF=$(echo "$CREATE_RES" | jq -r '.id // .ref // empty')
[[ -n "$PROJECT_REF" ]] || die "falha ao criar projeto: $CREATE_RES"
ok "projeto criado: $PROJECT_REF"

log "   aguardando projeto ficar ACTIVE_HEALTHY (até ~3 min)…"
for i in $(seq 1 60); do
  STATUS=$(curl -sS "https://api.supabase.com/v1/projects/$PROJECT_REF" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" | jq -r '.status')
  [[ "$STATUS" == "ACTIVE_HEALTHY" ]] && { ok "projeto pronto"; break; }
  sleep 5
done
[[ "$STATUS" == "ACTIVE_HEALTHY" ]] || die "timeout aguardando projeto"

# obter chaves
KEYS=$(curl -sS "https://api.supabase.com/v1/projects/$PROJECT_REF/api-keys" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN")
ANON_KEY=$(echo "$KEYS"    | jq -r '.[] | select(.name=="anon")         | .api_key')
SERVICE_KEY=$(echo "$KEYS" | jq -r '.[] | select(.name=="service_role") | .api_key')
SUPA_URL="https://${PROJECT_REF}.supabase.co"
DB_URL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres"

# 2) ------------------- link + aplicar migrations ----------------------------
log "2/8  aplicando migrations…"
pushd "$ROOT" >/dev/null
supabase link --project-ref "$PROJECT_REF" --password "$SUPABASE_DB_PASSWORD" >/dev/null
supabase db push --db-url "$DB_URL"
ok "migrations aplicadas"

# 3) ------------------------- storage buckets --------------------------------
log "3/8  criando buckets de Storage…"
create_bucket() {
  local id="$1" public="$2"
  curl -sS -X POST "$SUPA_URL/storage/v1/bucket" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"$id\",\"name\":\"$id\",\"public\":$public}" >/dev/null || true
}
create_bucket logos-termicos       true
create_bucket banners-campanhas    true
create_bucket produtos             true
create_bucket avisos-totem         true
create_bucket avatares-paroquianos false
ok "buckets criados"

# 4) ------------------------- edge functions ---------------------------------
log "4/8  fazendo deploy das Edge Functions…"
for fn in supabase/functions/*/; do
  name="$(basename "$fn")"
  [[ "$name" == "_shared" ]] && continue
  supabase functions deploy "$name" --project-ref "$PROJECT_REF" --no-verify-jwt >/dev/null \
    && ok "deploy: $name" || warn "falhou: $name"
done

# 5) ----------------------------- secrets ------------------------------------
log "5/8  configurando secrets base…"
HMAC=$(openssl rand -hex 32)
LOVABLE_API_KEY="${LOVABLE_API_KEY:-}"

# VAPID keys (para Web Push). Requer 'web-push' ou usa chaves fornecidas.
if command -v web-push >/dev/null 2>&1; then
  VAPID=$(web-push generate-vapid-keys --json)
  VAPID_PUB=$(echo "$VAPID"  | jq -r '.publicKey')
  VAPID_PRIV=$(echo "$VAPID" | jq -r '.privateKey')
else
  warn "web-push CLI ausente — pulei geração VAPID (configure depois em /admin)"
  VAPID_PUB=""; VAPID_PRIV=""
fi

set_secret() {
  local k="$1" v="$2"
  [[ -z "$v" ]] && return 0
  supabase secrets set "$k=$v" --project-ref "$PROJECT_REF" >/dev/null \
    && ok "secret: $k"
}
set_secret CARTEIRINHA_HMAC_SECRET "$HMAC"
set_secret VAPID_PUBLIC_KEY        "$VAPID_PUB"
set_secret VAPID_PRIVATE_KEY       "$VAPID_PRIV"
set_secret VAPID_SUBJECT           "mailto:$ADMIN_EMAIL"
set_secret LOVABLE_API_KEY         "$LOVABLE_API_KEY"

# 6) -------------------- super_admin + setup RPC -----------------------------
log "6/8  criando super_admin ($ADMIN_EMAIL)…"
curl -sS -X POST "$SUPA_URL/auth/v1/admin/users" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "apikey: $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg e "$ADMIN_EMAIL" --arg p "$ADMIN_PASS" \
        '{email:$e,password:$p,email_confirm:true,user_metadata:{nome_completo:"Administrador"}}')" \
  >/dev/null
ok "usuário criado"

log "   chamando setup_nova_paroquia()…"
curl -sS -X POST "$SUPA_URL/rest/v1/rpc/setup_nova_paroquia" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "apikey: $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg e "$ADMIN_EMAIL" --arg n "$NAME" \
              --arg c "$CNPJ" --arg s "$SITE" \
        '{_email:$e,_nome_paroquia:$n,_cnpj:($c|select(length>0)),_site:($s|select(length>0))}')" \
  | jq .
ok "paróquia inicializada"

# 7) ---------------------- .env do novo tenant -------------------------------
log "7/8  gerando .env em $OUT_DIR/.env"
cat >"$OUT_DIR/.env" <<EOF
# === $NAME ($SLUG) — gerado em $(date -u +%FT%TZ) ===
VITE_SUPABASE_URL=$SUPA_URL
VITE_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY
VITE_SUPABASE_PROJECT_ID=$PROJECT_REF
EOF
cat >"$OUT_DIR/secrets.txt" <<EOF
PROJECT_REF=$PROJECT_REF
SERVICE_ROLE_KEY=$SERVICE_KEY
DB_URL=$DB_URL
CARTEIRINHA_HMAC_SECRET=$HMAC
VAPID_PUBLIC_KEY=$VAPID_PUB
VAPID_PRIVATE_KEY=$VAPID_PRIV
EOF
chmod 600 "$OUT_DIR/secrets.txt"
ok "credenciais salvas em $OUT_DIR (mantenha em cofre seguro)"

# 8) ---------------------- deploy Cloudflare ---------------------------------
if [[ "$DEPLOY_CF" == "true" ]]; then
  log "8/8  deploy Cloudflare Pages (projeto: dizimo-$SLUG)…"
  need wrangler
  [[ -n "${CLOUDFLARE_API_TOKEN:-}" && -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]] \
    || die "exporte CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID"

  pushd "$ROOT" >/dev/null
  cp "$OUT_DIR/.env" .env.production
  bun install
  bun run build
  wrangler pages deploy dist \
    --project-name "dizimo-$SLUG" \
    --branch main \
    --commit-dirty=true
  popd >/dev/null
  ok "Cloudflare Pages publicado"
else
  log "8/8  deploy Cloudflare pulado (use --deploy-cloudflare para automatizar)"
fi

popd >/dev/null

# ------------------------------ resumo final ---------------------------------
cat <<EOF

╔══════════════════════════════════════════════════════════════════════════╗
║  ✅  Paróquia provisionada com sucesso                                    ║
╠══════════════════════════════════════════════════════════════════════════╣
║  Nome           : $NAME
║  Slug           : $SLUG
║  Supabase ref   : $PROJECT_REF
║  URL            : $SUPA_URL
║  Admin          : $ADMIN_EMAIL
║  Credenciais    : $OUT_DIR/
╚══════════════════════════════════════════════════════════════════════════╝

Próximos passos:
  1. Faça login em $SUPA_URL como $ADMIN_EMAIL
  2. Abra /admin/configuracoes e envie logo, cores e dados da paróquia
  3. Configure o gateway (Rede / Sicredi / Pagar.me) em /admin/gateway
  4. Configure a maquininha TEF (se houver) em /admin/tef
  5. Se não usou --deploy-cloudflare, publique o front-end manualmente:
       cp .tenants/$SLUG/.env .env.production && bun run build \\
         && wrangler pages deploy dist --project-name dizimo-$SLUG

EOF
