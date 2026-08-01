
ALTER TABLE public.configuracoes_paroquia
  ADD COLUMN IF NOT EXISTS email_aniversario_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_aniversario_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_melhor_dia_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_atraso_ativo boolean NOT NULL DEFAULT true;
