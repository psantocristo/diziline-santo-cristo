# sicredi-proxy

Cloudflare Worker que adiciona o **certificado mTLS** exigido pela API PIX do
Sicredi nas chamadas feitas pelas Edge Functions do Supabase.

```text
Edge Function ──(x-proxy-secret)──► Worker ──(mTLS)──► api-pix.sicredi.com.br
```

## Deploy rápido

```bash
cd bridges/sicredi-proxy
npm install

# 1) Converter o .pfx do Sicredi em PEM
./scripts/converter-certificado.sh ~/sicredi.pfx

# 2) Subir cert + key em: Cloudflare → SSL/TLS → Client Certificates →
#    mTLS Certificates → Upload. Copie o certificate_id e cole no wrangler.toml

# 3) Segredo compartilhado com o Supabase
openssl rand -hex 32          # guarde este valor
npx wrangler secret put PROXY_SECRET

# 4) Deploy
npx wrangler deploy                  # produção
npx wrangler deploy --env homolog    # homologação
```

Depois adicione um **Custom Domain** (ex.: `sicredi-proxy.suaparoquia.com.br`)
em Workers & Pages → sicredi-proxy → Settings → Domains & Routes.

## Teste

```bash
curl -H "x-proxy-secret: <PROXY_SECRET>" https://sicredi-proxy.suaparoquia.com.br/status
# → {"ok":true,"host":"https://api-pix.sicredi.com.br", ...}
```

Guia completo (credenciais, painel admin, webhook, testes): [`docs/SICREDI.md`](../../docs/SICREDI.md)
