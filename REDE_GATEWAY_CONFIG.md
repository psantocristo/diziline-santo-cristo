# Configuração do Gateway de Pagamento e.Rede

Este documento descreve toda a infraestrutura e lógica implementada para o funcionamento do gateway de pagamento **e.Rede** (Crédito, Débito e PIX) neste sistema. Estas configurações podem ser replicadas para outros projetos.

> **Atualização:** o sistema agora suporta múltiplos provedores alternáveis: **Rede**, **Sicredi (Sipag)** e **Pagar.me**, controlados pelo campo `configuracoes_gateway.provedor`. Para pinpad: **Connect TEF**, **Sipag Integrado**, **Pagar.me Maquininha (Stone)** e **PayGo**, via `configuracoes_tef.provedor_tef`. Veja a seção 8 abaixo.

## 8. Suporte Multi-Provedor

### Arquitetura
- `supabase/functions/_shared/payment-providers.ts` — adapters Sicredi e Pagar.me (PIX + cartão + status + teste).
- `supabase/functions/_shared/tef-providers.ts` — adapters TEF (Connect TEF, Sipag, Pagar.me Stone, PayGo).
- Edge Functions `rede-gateway`, `rede-gateway-totem`, `totem-pix-status` e `tef-gateway` despacham para o adapter correto antes de cair no fluxo padrão da Rede.
- Webhook unificado: `supabase/functions/webhook-pagamento` (`?provedor=pagarme` ou `?provedor=sicredi`).

### Configuração via Admin
- Aba **Credenciais → Provedor**: escolha Rede / Sicredi / Pagar.me. Campos do formulário se adaptam.
- Aba **Maquininha TEF → Provedor da Maquininha**: escolha Connect TEF / Sipag / Pagar.me Stone / PayGo.

### Campos por provedor (configuracoes_gateway)
| Provedor | Campos obrigatórios |
|---|---|
| `rede` | `client_id`, `client_secret` |
| `sicredi` | `client_id`, `client_secret`, `merchant_id` (código filiação Sipag) |
| `pagarme` | `api_key` (Secret Key sk_test_… / sk_live_…) |

### Rastreabilidade
- Toda transação grava `pagamentos.provedor` indicando qual gateway processou (ex.: `pagarme`, `tef:sipag`).

## 1. Estrutura do Banco de Dados (PostgreSQL)

### Tabela `configuracoes_gateway`
Armazena as credenciais e parâmetros de funcionamento (Sandbox/Produção).

```sql
CREATE TABLE public.configuracoes_gateway (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT DEFAULT 'Rede',
    modo TEXT DEFAULT 'simulacao', -- 'simulacao', 'sandbox', 'producao'
    client_id TEXT,               -- Número de Afiliação (PV)
    client_secret TEXT,           -- Client Secret (OAuth)
    merchant_id TEXT,             -- Merchant ID
    sandbox_url TEXT DEFAULT 'https://sandbox-erede.useredecloud.com.br',
    producao_url TEXT DEFAULT 'https://api.userede.com.br/erede',
    oauth_url_sandbox TEXT DEFAULT 'https://rl7-sandbox-api.useredecloud.com.br/oauth2/token',
    oauth_url_producao TEXT DEFAULT 'https://api.userede.com.br/redelabs/oauth2/token',
    pix_ativo BOOLEAN DEFAULT true,
    credito_ativo BOOLEAN DEFAULT true,
    debito_ativo BOOLEAN DEFAULT true,
    pix_expiracao_minutos INTEGER DEFAULT 30,
    parcelamento_max INTEGER DEFAULT 1,
    parcelamento_juros NUMERIC DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS: Apenas admins podem ler/editar configurações sensíveis
ALTER TABLE public.configuracoes_gateway ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage config" ON public.configuracoes_gateway 
    FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')));
```

### Tabela `pagamentos` (Campos Relevantes)
```sql
ALTER TABLE public.pagamentos 
ADD COLUMN gateway_id TEXT,
ADD COLUMN gateway_status TEXT,
ADD COLUMN gateway_payload JSONB,
ADD COLUMN pix_qrcode TEXT,
ADD COLUMN pix_copia_cola TEXT,
ADD COLUMN pix_expiracao TIMESTAMP WITH TIME ZONE;
```

---

## 2. Detalhes Técnicos dos Payloads (API e.Rede)

Para que o sistema funcione, os valores são enviados sempre em **centavos** (ex: R$ 10,00 = `1000`).

### 2.1 Pagamento PIX (QR Code)
Payload enviado para `POST /v2/transactions`:
```json
{
  "kind": "Pix",
  "amount": 1000,
  "reference": "referencia_unica",
  "qrCode": {
    "dateTimeExpiration": "2024-12-31T23:59:59-0300"
  }
}
```
A resposta contém o `qrCodeImage` (Base64 do QR Code) e `qrCodeData` (texto Copia e Cola).

### 2.2 Pagamento com Cartão (Crédito/Débito)
Payload enviado para `POST /v2/transactions`:
```json
{
  "kind": "credit",    // ou "debit"
  "amount": 1000,
  "reference": "referencia_unica",
  "cardNumber": "4111...",
  "cardholderName": "NOME NO CARTAO",
  "expirationMonth": 12,
  "expirationYear": 2026,
  "securityCode": "123",
  "installments": 1,   // Apenas se kind for 'credit'
  "consumer": {        // Opcional, usado no totem para identificação
    "taxId": "12345678901",
    "name": "Nome do Paroquiano"
  }
}
```

---

## 3. Edge Functions (Supabase)

Foram implementadas duas funções principais com foco em segurança e separação de contextos:

### `rede-gateway` (Web)
Utilizada para pagamentos realizados via site/app pelo usuário final.
- **Segurança**: Valida o JWT do usuário logado. O usuário só pode gerar pagamentos para o seu próprio `user_id` (exceto admins).
- **Ações**: `create-pix`, `create-card`, `test-connection`.
- **CORS**: Restrito a domínios autorizados.

### `rede-gateway-totem` (Totem/Maquininha)
Otimizada para transações presenciais com input de cartão.
- **Segurança**: Valida o JWT. Exige a role `totem`, `admin` ou `super_admin`.
- **Log de Auditoria**: Registra eventos de PIN PAD no banco de dados.
- **Sanitização**: Remove dados sensíveis (número completo do cartão, CVV) antes de salvar o `gateway_payload` no banco de dados.

---

## 4. Segurança e Robustez

1. **JWT (JSON Web Token)**: Todas as chamadas às Edge Functions exigem o header `Authorization: Bearer <TOKEN>`. A função valida a identidade do usuário via `auth.getUser()` do Supabase.
2. **CORS (Cross-Origin Resource Sharing)**: As funções possuem uma lista branca (`ALLOWED_ORIGINS`). Chamadas de origens desconhecidas são bloqueadas pelo navegador.
3. **Logs Seguros**:
   - `console.log` nunca exibe números de cartão completos ou CVV.
   - O `gateway_payload` salvo no banco é limpo de informações sensíveis (PII).
4. **Retry Logic**: A função de Totem implementa `fetchWithRetry` com backoff exponencial para lidar com instabilidades na API da Rede.

---

## 5. Variáveis de Ambiente (Secrets)

As Edge Functions utilizam:
- `SUPABASE_URL`: URL do projeto.
- `SUPABASE_ANON_KEY`: Para validação de usuário.
- `SUPABASE_SERVICE_ROLE_KEY`: Para leitura de configurações e update de pagamentos com bypass de RLS.

---

## 6. Fluxo de Integração Frontend

### Chamada da Função
```typescript
const { data, error } = await supabase.functions.invoke('rede-gateway-totem', {
  body: { 
    action: 'create-card', 
    pagamento_id: '...', 
    tipo: 'credito', 
    card: { numero, nome, validade, cvv } 
  }
});
```

### Mapeamento de Erros
Foi criado o arquivo `_shared/rede-codes.ts` (Edge Function) e `lib/rede-error-codes.ts` (Frontend) que traduz os códigos da Rede (ex: `54`, `55`, `00`) em mensagens amigáveis em português.

---

## 7. Como replicar em outro projeto

1. Execute o SQL das tabelas e RLS.
2. Crie as Edge Functions `rede-gateway` e `rede-gateway-totem` copiando o código-fonte.
3. Certifique-se de que a tabela `user_roles` existe e os usuários possuem as permissões corretas.
4. Configure os `ALLOWED_ORIGINS` no código das funções para refletir os novos domínios.
5. Popule a tabela `configuracoes_gateway` com as credenciais obtidas no portal da Rede.

