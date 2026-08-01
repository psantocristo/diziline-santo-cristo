
-- Adicionar colunas de controle de métodos de pagamento no gateway online
ALTER TABLE public.configuracoes_gateway
  ADD COLUMN IF NOT EXISTS pix_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS credito_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS debito_ativo boolean NOT NULL DEFAULT true;

-- Adicionar colunas de controle de métodos de pagamento no TEF
ALTER TABLE public.configuracoes_tef
  ADD COLUMN IF NOT EXISTS credito_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS debito_ativo boolean NOT NULL DEFAULT true;
