ALTER TABLE public.avisos_totem
  ADD COLUMN IF NOT EXISTS tela_cheia boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS duracao_segundos integer NOT NULL DEFAULT 8;