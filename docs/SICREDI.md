# Integração Sicredi — PIX (e cartão)

Guia completo para deixar o **PIX do Sicredi** funcionando de verdade neste
sistema, do pedido de credenciais na cooperativa até o teste de R$ 0,01 em
produção.

> **Cartão:** o Sicredi **não publica API de e-commerce (cartão online)**. O
> catálogo do portal do desenvolvedor tem PIX, Cobrança/Boleto e Open Data.
> O cartão Sicredi é a maquininha **Sipag (presencial)**, já suportada pelo
> sistema via `bridges/sipag-bridge` (TEF no totem).
> Para **cartão online** (site/app), use **Rede** ou **Pagar.me** — o sistema
> permite PIX em um provedor e cartão em outro.

---

## Visão geral do fluxo

```text
App/Totem ──► Edge Function (rede-gateway) ──► [Proxy mTLS Cloudflare] ──► API PIX Sicredi
                        ▲                                                        │
                        └──── webhook-pagamento ◄──── callback do Sicredi ◄───────┘
```

A API PIX do Sicredi exige **mTLS** (certificado de cliente). O Supabase Edge
Functions não envia certificado de cliente, por isso existe o Worker
`bridges/sicredi-proxy`. Em **homologação/sandbox** você pode testar todo o
fluxo sem o proxy.

---

## Passo 1 — Pedir as credenciais à cooperativa

Peça na sua agência Sicredi (conta **PJ** — PF não tem API PIX):

1. **Adesão à API PIX** (produto "API Pix — recebimento integrado").
2. Cadastro no portal <https://developer.sicredi.com.br>.
3. Geração do **CSR** → o Sicredi devolve o certificado (`.pfx`/`.p12` + senha).
4. **client_id** e **client_secret** (homologação e produção).
5. A **chave PIX recebedora** da paróquia (CNPJ é o recomendado).

Você terá, no fim:

| Item                  | Onde usa                                     |
| --------------------- | -------------------------------------------- |
| `sicredi.pfx` + senha | Cloudflare (proxy mTLS)                      |
| client_id / secret    | `/admin/configuracoes` → Gateway → Sicredi   |
| chave PIX             | `/admin/configuracoes` → Gateway → Sicredi   |

---

## Passo 2 — Testar em homologação (sem certificado)

1. `/admin/configuracoes` → **Gateway** → provedor **Sicredi**, modo
   **sandbox/homologação**.
2. Preencha `client_id`, `client_secret` e a **chave PIX**.
3. URLs (já são o padrão, só confira):
   - OAuth homologação: `https://api-pix-h.sicredi.com.br/oauth/token`
   - PIX Base homologação: `https://api-pix-h.sicredi.com.br`
4. `/admin/diagnostico` → card **Sicredi PIX** → **Verificar configuração**.

Se o OAuth passar, as credenciais estão certas.

---

## Passo 3 — Subir o proxy mTLS (obrigatório em produção)

O projeto do Worker já está pronto em `bridges/sicredi-proxy/`.

```bash
cd bridges/sicredi-proxy
npm install

# 3.1 Converter o certificado do Sicredi para PEM
./scripts/converter-certificado.sh ~/sicredi.pfx
# → sicredi-cert.pem  e  sicredi-key.pem   (NUNCA comite esses arquivos)
```

**3.2 Cadastrar no Cloudflare**
Dashboard → conta → **SSL/TLS → Client Certificates → mTLS Certificates →
Upload**. Cole `sicredi-cert.pem` em *Certificate* e `sicredi-key.pem` em
*Private Key*. Copie o **certificate_id** e cole em `wrangler.toml`.

> Requer plano **Cloudflare Pro** ou superior (mTLS Certificates não existe no Free).

**3.3 Segredo compartilhado e deploy**

```bash
openssl rand -hex 32          # guarde este valor — chame de PROXY_SECRET
npx wrangler secret put PROXY_SECRET
npx wrangler deploy                   # produção
npx wrangler deploy --env homolog     # homologação (opcional)
```

**3.4 Domínio próprio** (recomendado)
Workers & Pages → `sicredi-proxy` → Settings → **Domains & Routes** →
`sicredi-proxy.suaparoquia.com.br`.

**3.5 Teste do proxy**

```bash
curl -H "x-proxy-secret: <PROXY_SECRET>" https://sicredi-proxy.suaparoquia.com.br/status
# {"ok":true,"host":"https://api-pix.sicredi.com.br", ...}
```

---

## Passo 4 — Segredos no Supabase

Em **Edge Functions → Secrets** do projeto Supabase:

| Nome                     | Valor                                                        |
| ------------------------ | ------------------------------------------------------------ |
| `SICREDI_PROXY_SECRET`   | o mesmo `PROXY_SECRET` usado no `wrangler secret put`        |
| `SICREDI_WEBHOOK_SECRET` | string aleatória (`openssl rand -hex 24`) — autentica o callback |

O `SICREDI_WEBHOOK_SECRET` é anexado automaticamente à URL cadastrada no
Sicredi (`...&s=<segredo>`) e validado a cada callback recebido.

---

## Passo 5 — Configurar o painel

`/admin/configuracoes` → aba **Gateway** → **Sicredi**:

| Campo                        | Homologação                              | Produção (com proxy)                                   |
| ---------------------------- | ---------------------------------------- | ------------------------------------------------------ |
| Modo                         | `sandbox`                                | `producao`                                              |
| Client ID / Secret           | credenciais de homologação               | credenciais de produção                                 |
| Chave PIX                    | chave de teste                           | CNPJ da paróquia                                        |
| OAuth — Produção             | —                                        | `https://sicredi-proxy.suaparoquia.com.br/oauth/token`  |
| PIX Base — Produção          | —                                        | `https://sicredi-proxy.suaparoquia.com.br`              |
| OAuth — Homologação          | `https://api-pix-h.sicredi.com.br/oauth/token` | —                                                 |
| PIX Base — Homologação       | `https://api-pix-h.sicredi.com.br`       | —                                                       |
| URL do proxy mTLS            | *(vazio)*                                | `https://sicredi-proxy.suaparoquia.com.br`              |
| Nome do segredo do proxy     | *(vazio)*                                | `SICREDI_PROXY_SECRET`                                  |
| Certificado / Chave / Senha  | *(vazio — vivem no Cloudflare)*          | *(vazio — vivem no Cloudflare)*                         |

Salve.

---

## Passo 6 — Registrar o webhook

`/admin/diagnostico` → card **Sicredi PIX** → botão **Registrar webhook**.

Isso executa `PUT /api/v2/webhook/{chave}` no Sicredi apontando para:

```text
https://<projeto>.supabase.co/functions/v1/webhook-pagamento?provedor=sicredi&s=<SICREDI_WEBHOOK_SECRET>
```

Depois, o passo "Webhook PIX registrado" do diagnóstico deve ficar verde.

> Mesmo que o webhook falhe, a função `reconciliar-pagamentos` consulta as
> cobranças pendentes a cada execução e marca como pago — é a rede de segurança.

---

## Passo 7 — Roteiro de teste

1. **Verificar configuração** (`/admin/diagnostico`) — todos os passos verdes.
2. **Teste completo (R$ 0,01)** — gera cobrança real, mostra o copia-e-cola.
3. Pague o copia-e-cola pelo app do seu banco.
4. Em poucos segundos o pagamento deve aparecer como **pago**:
   - `/admin/pagamentos` (Realtime, sem recarregar);
   - **Logs do terminal** mostra `Webhook: pix.recebido`.
5. Repita pelo **totem** e pelo **app do dizimista** para validar as três origens.

---

## Solução de problemas

| Sintoma                                          | Causa provável / solução                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| Proxy responde **403**                           | `SICREDI_PROXY_SECRET` (Supabase) ≠ `PROXY_SECRET` (Worker).                    |
| Proxy responde **404 path not allowed**          | Rota fora da allowlist do Worker — confira `src/index.ts`.                      |
| OAuth **401 / invalid_client**                   | client_id/secret errados ou ambiente trocado (homologação × produção).          |
| Erro **525 / SSL handshake**                     | `certificate_id` errado no `wrangler.toml`, ou certificado vencido.             |
| **timeout 30s** na Edge Function                 | Worker fora do ar, URL errada ou instabilidade do Sicredi.                      |
| Cobrança criada, mas nunca fica paga             | Webhook não registrado — use o botão do painel; a reconciliação cobre o atraso. |
| Webhook chega e volta **401**                    | `SICREDI_WEBHOOK_SECRET` mudou depois do registro — registre o webhook de novo. |
| `chave PIX recebedora não configurada`           | Preencha a chave em Configurações → Gateway → Sicredi.                          |

---

## Segurança

- Certificado e chave privada **nunca** entram no banco, no bundle ou no Git —
  ficam apenas no Cloudflare.
- O `PROXY_SECRET` é a única barreira entre a internet e o seu certificado:
  use 32 bytes aleatórios e rotacione anualmente (troque nos dois lados).
- O webhook é autenticado por segredo na URL; em produção, chamadas sem o
  segredo correto são rejeitadas com 401 e registradas em `logs_webhook`.
- Toda chamada ao Sicredi acontece **server-side** (Edge Functions). O
  navegador nunca vê credenciais.

---

## Referências

- Portal do desenvolvedor Sicredi — <https://developer.sicredi.com.br>
- API Pix Sicredi (produto) — <https://www.sicredi.com.br/site/pixpj/api-pix/>
- Padrão BACEN Pix API — <https://bacen.github.io/pix-api/>
- Proxy mTLS deste projeto — [`bridges/sicredi-proxy/README.md`](../bridges/sicredi-proxy/README.md)
