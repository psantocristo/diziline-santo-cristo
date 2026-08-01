# Sicredi PIX em produção via proxy mTLS no Cloudflare

> **Guia principal:** [`docs/SICREDI.md`](./SICREDI.md) cobre a integração
> completa (credenciais, painel, webhook e testes) e o Worker já vem pronto em
> `bridges/sicredi-proxy/`. Este documento fica como referência detalhada do
> proxy mTLS.


A API PIX do Sicredi exige autenticação mútua (**mTLS**) com certificado
emitido pelo banco. As Edge Functions do Supabase (Deno Deploy) **não
suportam enviar certificado de cliente** em chamadas `fetch` de saída, então
em produção é preciso colocar um proxy no meio. Este guia descreve a
implementação recomendada — um **Cloudflare Worker** com binding de
**mTLS Certificate** — que é a opção mais simples, barata e que se integra
ao hosting que a paróquia já usa.

```text
Edge Function (Supabase)
        │  POST https://sicredi-proxy.suaparoquia.com.br/...
        │  header: x-proxy-secret: <token>
        ▼
Cloudflare Worker  ── usa mTLS cert ──►  api-pix.sicredi.com.br
        ▲                                          │
        └────────── resposta JSON ◄────────────────┘
```

A Edge Function continua orquestrando OAuth, criação de cobrança e consulta
de status. O Worker apenas reencaminha as requisições anexando o
certificado de cliente.

---

## Pré-requisitos

- Conta Cloudflare com plano **Pro ou superior** (mTLS Certificates não
  está disponível no plano Free).
- Domínio gerenciado pela Cloudflare (ex.: `suaparoquia.com.br`).
- O `.pfx` (ou `.p12`) entregue pelo Sicredi com a senha de exportação.
- `wrangler` instalado localmente (`npm i -g wrangler`).
- `openssl` instalado localmente (para extrair o PEM).

---

## Passo 1 — Converter o certificado para PEM

O Cloudflare aceita PEM separado em duas partes (certificado e chave
privada **sem senha**).

```bash
# Certificado público
openssl pkcs12 -in sicredi.pfx -clcerts -nokeys -out sicredi-cert.pem

# Chave privada (sem senha — o Cloudflare exige assim)
openssl pkcs12 -in sicredi.pfx -nocerts -nodes -out sicredi-key.pem
```

Guarde os dois arquivos como se fossem a senha do banco. Não comite no Git.

---

## Passo 2 — Cadastrar o mTLS Certificate no Cloudflare

1. Dashboard Cloudflare → conta → **SSL/TLS → Client Certificates →
   mTLS Certificates**.
2. **Upload mTLS Certificate**.
3. Cole o conteúdo de `sicredi-cert.pem` no campo *Certificate* e o de
   `sicredi-key.pem` no campo *Private Key*.
4. Dê um nome descritivo (ex.: `sicredi-pix-prod`) e salve.
5. **Copie o `certificate_id`** que o Cloudflare exibe — será usado no
   `wrangler.toml`.

---

## Passo 3 — Criar o Worker proxy

Em qualquer pasta local:

```bash
npm create cloudflare@latest sicredi-proxy
cd sicredi-proxy
```

### `src/index.ts`

```ts
export interface Env {
  SICREDI_CERT: Fetcher;      // binding mTLS (definido no wrangler.toml)
  PROXY_SECRET: string;       // segredo compartilhado com a Edge Function
  SICREDI_HOST: string;       // ex.: https://api-pix.sicredi.com.br
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    // 1) Autenticação entre Edge Function ↔ Worker
    if (req.headers.get('x-proxy-secret') !== env.PROXY_SECRET) {
      return new Response('forbidden', { status: 403 });
    }

    // 2) Reescreve a URL: /api/v2/cob/XYZ → https://api-pix.sicredi.com.br/api/v2/cob/XYZ
    const url = new URL(req.url);
    const target = env.SICREDI_HOST.replace(/\/$/, '') + url.pathname + url.search;

    // 3) Repassa headers, removendo os internos
    const headers = new Headers(req.headers);
    headers.delete('x-proxy-secret');
    headers.delete('host');

    // 4) Fetch com certificado de cliente (mTLS)
    const upstream = await env.SICREDI_CERT.fetch(target, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer(),
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: upstream.headers,
    });
  },
};
```

### `wrangler.toml`

```toml
name = "sicredi-proxy"
main = "src/index.ts"
compatibility_date = "2024-11-01"

[vars]
SICREDI_HOST = "https://api-pix.sicredi.com.br"
# Para homologação use: https://api-pix-h.sicredi.com.br

[[mtls_certificates]]
binding = "SICREDI_CERT"
certificate_id = "COLE_AQUI_O_ID_DO_PASSO_2"
```

### Deploy

```bash
# Segredo compartilhado (gere uma string aleatória longa, ex.: openssl rand -hex 32)
npx wrangler secret put PROXY_SECRET

# Sobe o Worker
npx wrangler deploy
```

### Domínio customizado (recomendado)

Em **Workers & Pages → sicredi-proxy → Settings → Triggers → Custom
Domains**, adicione `sicredi-proxy.suaparoquia.com.br`. O Cloudflare emite
o certificado TLS automaticamente.

---

## Passo 4 — Cadastrar o segredo no Supabase

A Edge Function precisa do **mesmo** valor de `PROXY_SECRET` para incluir o
header `x-proxy-secret` nas chamadas.

1. Painel Supabase → **Edge Functions → Secrets**.
2. Adicione um segredo com nome `SICREDI_PROXY_SECRET` (ou outro, desde
   que reflita no painel admin — veja Passo 5).
3. Valor: a mesma string usada em `wrangler secret put PROXY_SECRET`.

> O código do dispatcher (`supabase/functions/_shared/payment-providers.ts`)
> já injeta esse header automaticamente em todas as chamadas Sicredi
> (OAuth, criação de cobrança, consulta de status) quando
> `extra_config.mtls_proxy_url` está preenchido.

---

## Passo 5 — Configurar no painel `/admin/configuracoes`

Na aba **Gateway → Sicredi**:

**URLs e ambiente (avançado)** — aponte para o proxy:

| Campo                       | Valor                                                 |
| --------------------------- | ----------------------------------------------------- |
| OAuth — Produção            | `https://sicredi-proxy.suaparoquia.com.br/oauth/token` |
| PIX Base — Produção         | `https://sicredi-proxy.suaparoquia.com.br`            |

**Certificado mTLS:**

| Campo                                   | Valor                                  |
| --------------------------------------- | -------------------------------------- |
| Certificado / Chave / Passphrase        | *(em branco — agora vivem no Cloudflare)* |
| URL do proxy mTLS                       | `https://sicredi-proxy.suaparoquia.com.br` |
| Nome do segredo do proxy                | `SICREDI_PROXY_SECRET` (ou o nome usado) |

Salve. Pronto — o sistema passa a usar PIX Sicredi real em produção.

---

## Passo 6 — Testar

1. Em `/admin/configuracoes` → botão **Testar conexão** do Sicredi. Deve
   retornar `✅ Sicredi PIX — credenciais válidas`.
2. Crie uma cobrança real de valor mínimo (ex.: R\$ 0,01) via totem ou
   página pública e confira o QR/copia-e-cola.
3. Pague e veja em **Logs do terminal** se o webhook chegou (`webhook-
   pagamento?provedor=sicredi`).
4. No painel Cloudflare → **Workers → sicredi-proxy → Logs** confira as
   requisições passando.

---

## Custos estimados

| Item                                    | Custo                                  |
| --------------------------------------- | -------------------------------------- |
| Cloudflare Pro (necessário para mTLS)   | US\$ 20/mês por domínio                |
| Workers Free Tier                       | 100.000 req/dia — sobra muito          |
| Tráfego                                 | Incluso                                |

---

## Alternativas (caso não queira pagar o Cloudflare Pro)

Qualquer proxy reverso que suporte certificado de cliente serve. Exemplos:

- **Fly.io** — `fly proxy` ou Worker em Node/Deno, free tier generoso.
- **Render / Railway** — container Node com `https.Agent({ cert, key })`.
- **VPS + Nginx** com `proxy_ssl_certificate` / `proxy_ssl_certificate_key`.

A configuração no painel admin (`mtls_proxy_url` + segredo) é a mesma —
muda só o "como" você hospeda o proxy.

---

## Segurança

- Nunca comite `sicredi-cert.pem` ou `sicredi-key.pem`. Adicione-os ao
  `.gitignore` se ficarem no disco temporariamente.
- O `PROXY_SECRET` é a única defesa contra alguém na internet usar seu
  proxy para falar com o Sicredi em seu nome. Use ≥ 32 bytes aleatórios e
  rotacione anualmente.
- Restrinja o Worker a aceitar apenas os métodos/paths necessários se
  quiser ser ainda mais conservador (basta validar `url.pathname` antes
  do `fetch`).
- Habilite **Cloudflare Logpush** para auditar quem chama o proxy.

---

## Troubleshooting

| Sintoma                                                   | Causa provável                                          |
| --------------------------------------------------------- | ------------------------------------------------------- |
| Worker retorna 403 forbidden                              | Header `x-proxy-secret` divergente. Confira ambos os lados. |
| Sicredi retorna 401 / `invalid_client` no OAuth           | Client ID/Secret errados ou ambiente trocado (h vs prod). |
| Sicredi retorna `SSL handshake failed` / 525 no Worker    | `certificate_id` errado no `wrangler.toml` ou chave expirada. |
| `httpRequest timeout 30s` na Edge Function                | Worker offline, URL errada ou Sicredi indisponível.      |
| Webhook não chega                                         | Cadastre `https://<projeto>.supabase.co/functions/v1/webhook-pagamento?provedor=sicredi` no painel Sicredi. |
