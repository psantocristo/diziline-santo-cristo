
-- Add payment method configuration columns to totens table
ALTER TABLE public.totens
  ADD COLUMN pix_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN credito_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN debito_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN tef_ativo boolean NOT NULL DEFAULT false;
