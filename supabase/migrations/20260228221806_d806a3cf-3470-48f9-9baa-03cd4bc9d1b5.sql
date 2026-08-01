
-- Add Resend configuration columns to configuracoes_paroquia
ALTER TABLE public.configuracoes_paroquia
  ADD COLUMN IF NOT EXISTS resend_api_key text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resend_from_email text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_agradecimento_ativo boolean NOT NULL DEFAULT false;
