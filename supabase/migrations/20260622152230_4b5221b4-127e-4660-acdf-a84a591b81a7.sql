
-- Adicionar suporte multi-provedor de pagamento
ALTER TABLE public.configuracoes_gateway
  ADD COLUMN IF NOT EXISTS provedor TEXT NOT NULL DEFAULT 'rede',
  ADD COLUMN IF NOT EXISTS api_key TEXT,
  ADD COLUMN IF NOT EXISTS api_key_secret_name TEXT,
  ADD COLUMN IF NOT EXISTS webhook_secret TEXT,
  ADD COLUMN IF NOT EXISTS extra_config JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.configuracoes_gateway
  DROP CONSTRAINT IF EXISTS configuracoes_gateway_provedor_check;
ALTER TABLE public.configuracoes_gateway
  ADD CONSTRAINT configuracoes_gateway_provedor_check
  CHECK (provedor IN ('rede', 'sicredi', 'pagarme'));

ALTER TABLE public.configuracoes_tef
  ADD COLUMN IF NOT EXISTS provedor_tef TEXT NOT NULL DEFAULT 'connect_tef',
  ADD COLUMN IF NOT EXISTS extra_config JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.configuracoes_tef
  DROP CONSTRAINT IF EXISTS configuracoes_tef_provedor_tef_check;
ALTER TABLE public.configuracoes_tef
  ADD CONSTRAINT configuracoes_tef_provedor_tef_check
  CHECK (provedor_tef IN ('connect_tef', 'sipag', 'pagarme_stone', 'paygo'));

ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS provedor TEXT;
