
-- Adicionar coluna nome_contribuinte na tabela pagamentos
-- Usada para fiéis que informam nome no totem sem serem dizimistas cadastrados
ALTER TABLE public.pagamentos
ADD COLUMN IF NOT EXISTS nome_contribuinte text;
