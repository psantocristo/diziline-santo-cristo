# Diziline — Documento Técnico para Solicitação de Acesso à API Pix Sicredi

**Documento destinado à Cooperativa Sicredi / Equipe de Integração de APIs**

| Campo | Conteúdo |
| --- | --- |
| Sistema | **Diziline** — plataforma de gestão de dízimo, ofertas e campanhas paroquiais |
| Tipo de solicitante | Pessoa Jurídica (Paróquia / Mitra Diocesana) |
| Produto solicitado | **API Pix Sicredi — Recebimento (Cob / Cob imediata + Webhook)** |
| Ambientes | Homologação e Produção |
| Data | (preencher) |
| Responsável técnico | (preencher: nome, e-mail, telefone) |
| CNPJ da conta recebedora | (preencher) |
| Conta / Cooperativa | (preencher agência e conta PJ) |
| Chave Pix recebedora | (preencher — recomendado: CNPJ da paróquia) |

---

## 1. O que precisamos da Sicredi

Solicitamos formalmente a habilitação dos itens abaixo. Esta é a lista completa
e exata — nada além disso é necessário.

| # | Item | Detalhe | Obrigatório |
| --- | --- | --- | --- |
| 1 | **Adesão à API Pix (recebimento)** para o CNPJ acima | gera o *ID de Adesão* enviado por e-mail | Sim |
| 2 | **Credenciais de HOMOLOGAÇÃO** | `client_id` + `client_secret` da **API Pix** (não as de *Minhas Aplicações* do portal, que servem ao catálogo Open Data/Cobrança) | Sim |
| 3 | **Credenciais de PRODUÇÃO** | `client_id` + `client_secret` da API Pix | Sim |
| 4 | **Certificado digital de cliente (mTLS)** | emissão a partir do CSR que geraremos, entregue como `.pem`/`.crt` + cadeia, ou `.pfx`/`.p12` com senha — **um por ambiente** | Sim |
| 5 | **Vínculo credencial ↔ certificado** confirmado | é a causa nº 1 de `401 invalid_client` | Sim |
| 6 | **Escopos habilitados** | `cob.write`, `cob.read`, `pix.read`, `webhook.write`, `webhook.read` | Sim |
| 7 | **Chave Pix** ativa e vinculada à conta PJ | preferencialmente o CNPJ | Sim |
| 8 | Confirmação das **URLs base** dos dois ambientes | ver §4 | Sim |
| 9 | Faixa de **IPs de origem do webhook** Sicredi (se houver) | usada para hardening adicional | Desejável |
| 10 | Limites operacionais | teto de cobranças/minuto, expiração mínima do QR | Desejável |

> **Não solicitamos** API de cartão/e-commerce: o cartão presencial é atendido
> pela maquininha **Sipag** (TEF local) e o cartão online por outro adquirente.
> A integração Sicredi neste sistema é **exclusivamente Pix recebimento**.

---

## 2. Como o sistema funciona (visão end-to-end)

O Diziline é uma aplicação web (PWA) com backend serverless. Nenhum dado de
cartão trafega ou é armazenado pelo sistema; no fluxo Sicredi trafegam apenas
dados de **cobrança Pix** (valor, txid, chave recebedora, nome/CPF opcional do
pagador).

```text
┌────────────────────┐        ┌──────────────────────────┐
│  Fiel (App/Totem)  │        │  Painel Admin (paróquia) │
└─────────┬──────────┘        └────────────┬─────────────┘
          │ HTTPS/TLS 1.3                  │ HTTPS + JWT + RLS
          ▼                                ▼
   ┌──────────────────────────────────────────────────┐
   │  Frontend (Cloudflare, SPA)  — nunca vê segredos │
   └───────────────┬──────────────────────────────────┘
                   │ JWT do usuário (Supabase Auth)
                   ▼
   ┌──────────────────────────────────────────────────┐
   │  Edge Functions (Supabase / Deno, isoladas)      │
   │  • valida JWT e papel do usuário                 │
   │  • valida entrada (Zod)                          │
   │  • guarda client_id/secret fora do navegador     │
   └───────────────┬──────────────────────────────────┘
                   │ HTTPS + segredo compartilhado
                   ▼
   ┌──────────────────────────────────────────────────┐
   │  Proxy mTLS (Cloudflare Worker dedicado)         │
   │  • único componente que possui o certificado     │
   │  • allowlist de rotas Sicredi                    │
   └───────────────┬──────────────────────────────────┘
                   │ TLS mútuo (certificado de cliente Sicredi)
                   ▼
   ┌──────────────────────────────────────────────────┐
   │  API Pix Sicredi                                 │
   └───────────────┬──────────────────────────────────┘
                   │ Webhook HTTPS (callback autenticado)
                   ▼
   ┌──────────────────────────────────────────────────┐
   │  Edge Function `webhook-pagamento`               │
   │  • valida segredo/HMAC → concilia → baixa o mês  │
   └──────────────────────────────────────────────────┘
```

### 2.1 Fluxo de uma contribuição via Pix

1. O fiel escolhe tipo (dízimo/oferta/campanha), valor e mês de referência.
2. O backend cria o registro do pagamento em estado `criado` e chama
   `POST /api/v2/cob` (cobrança imediata) via proxy mTLS, com `txid` gerado
   pelo sistema e expiração configurável.
3. A resposta traz o **EMV copia-e-cola** e o `location`; o app/totem exibe o
   QR Code. O totem pode ainda imprimir o QR na impressora térmica local.
4. O Sicredi notifica o **webhook** quando a cobrança é paga.
5. O sistema valida a autenticidade do callback, marca o pagamento como `pago`,
   dispara comprovante/notificação e **baixa o mês de referência** do dizimista.
6. **Rede de segurança:** um job de reconciliação consulta
   `GET /api/v2/cob/{txid}` para toda cobrança pendente, de modo que nenhum
   pagamento se perde mesmo se o webhook falhar.

### 2.2 Endpoints Sicredi consumidos (escopo mínimo)

| Método | Rota | Uso |
| --- | --- | --- |
| POST | `/oauth/token` | OAuth2 `client_credentials` |
| POST | `/api/v2/cob` | criar cobrança imediata |
| GET | `/api/v2/cob/{txid}` | consulta/reconciliação |
| PUT | `/api/v2/webhook/{chave}` | registrar URL de callback |
| GET | `/api/v2/webhook/{chave}` | conferir callback registrado |

Nenhuma outra rota é chamada — o proxy possui **allowlist** e rejeita qualquer
caminho fora desta lista.

---

## 3. Arquitetura de segurança

### 3.1 Transporte e identidade
- **TLS 1.2+/1.3** obrigatório em todas as pontas; sem HTTP em claro.
- **mTLS** com o certificado emitido pela Sicredi na comunicação com a API Pix.
- O certificado **não fica no navegador, nem no repositório, nem no banco**:
  reside apenas como *secret* criptografado no Cloudflare Worker dedicado.
- O Worker aplica **allowlist de rotas** e exige um **segredo compartilhado**
  (`SICREDI_PROXY_SECRET`) para ser invocado — não é um proxy aberto.

### 3.2 Segredos
- `client_id`, `client_secret`, senha do certificado e segredos de webhook são
  guardados em cofre de secrets (Supabase/Cloudflare), injetados por variável de
  ambiente em tempo de execução.
- **Nunca** são expostos ao frontend, logados, versionados ou trafegados para o
  dispositivo do fiel.
- Rotação suportada sem downtime (troca do secret + redeploy da função).

### 3.3 Autenticação e autorização da aplicação
- Autenticação de usuários via **Supabase Auth (JWT assinado, chaves rotativas)**.
- Papéis (`super_admin`, `admin`, `dizimista`, `totem`) em **tabela dedicada**,
  nunca em campo editável pelo usuário, com função `SECURITY DEFINER`
  (`has_role`) usada nas políticas.
- **RLS (Row Level Security)** ativa em todas as tabelas sensíveis: cada
  dizimista só enxerga os próprios pagamentos; administradores enxergam apenas
  a paróquia da instalação.
- Permissão `EXECUTE` revogada de `anon` nas funções que não são públicas.
- Toda Edge Function valida o JWT em código e o papel do chamador antes de agir.

### 3.4 Webhook
- URL exclusiva por instalação, com **segredo de alta entropia** na query e
  **validação HMAC** do corpo recebido antes de qualquer processamento.
- Callback **idempotente**: `txid`/`e2eid` únicos impedem baixa dupla.
- Restrição `uniq_dizimo_pago_mes` no banco impede que o mesmo mês seja pago
  duas vezes, mesmo em corrida de eventos.
- Todo callback é registrado em tabela de auditoria (`logs_terminal`) com
  status de processamento e erro, sem gravar dados sensíveis.

### 3.5 Entrada e superfície de ataque
- Validação de esquema (**Zod**) em toda Edge Function e no client local.
- Sem SQL dinâmico: acesso exclusivamente por API tipada/parametrizada.
- Rate limiting nas rotas de pagamento e impressão.
- SPA sem segredos embarcados; apenas a chave pública/anon do Supabase, que é
  inofensiva sob RLS.
- O módulo local do totem escuta **somente em 127.0.0.1**, com CORS restrito ao
  domínio da paróquia e token `X-Client-Token` obrigatório.

### 3.6 Dados pessoais (LGPD)
- Coleta minimizada: nome, CPF (opcional), contato e histórico de contribuição.
- Isolamento por instalação — **um banco por paróquia**, sem base compartilhada.
- Backups gerenciados, criptografia em repouso e em trânsito.
- Nenhum dado de cartão é capturado, transmitido ou armazenado (fora de escopo
  PCI para o Pix).

### 3.7 Observabilidade
- Logs estruturados por transação (`txid`, status, provedor), sem segredos.
- Painel `/admin/diagnostico` com testes ponta a ponta: proxy → OAuth →
  cobrança de R$ 0,01 → consulta → webhook, para validação assistida junto à
  cooperativa.

---

## 4. Parâmetros a confirmar com a Sicredi

| Parâmetro | Homologação | Produção |
| --- | --- | --- |
| OAuth | `https://api-pix-h.sicredi.com.br/oauth/token` | `https://api-pix.sicredi.com.br/oauth/token` |
| Base Pix | `https://api-pix-h.sicredi.com.br` | `https://api-pix.sicredi.com.br` |
| Escopos | `cob.write cob.read pix.read webhook.write webhook.read` | idem |
| mTLS exigido no `/oauth/token` | Confirmar (sim, conforme manual) | Sim |
| URL do webhook | (fornecida pela paróquia após provisionamento) | idem |

---

## 5. Roteiro de homologação proposto

1. Sicredi aprova a adesão e libera credenciais de homologação.
2. Geramos o CSR e a Sicredi devolve o certificado do ambiente.
3. Publicamos o certificado no proxy mTLS e rodamos o diagnóstico assistido.
4. Cobrança de teste, pagamento e confirmação do webhook em homologação.
5. Repetição em produção com **R$ 0,01** e validação da baixa automática.
6. Registro formal do aceite.

---

## 6. Contato técnico

| Papel | Nome | E-mail | Telefone |
| --- | --- | --- | --- |
| Responsável técnico | (preencher) | | |
| Responsável pela paróquia | (preencher) | | |

---

*Diziline — cada instalação é individual, com banco, credenciais, domínio e
identidade visual próprios da paróquia.*
