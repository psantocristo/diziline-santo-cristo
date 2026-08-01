ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS mes_referencia date NULL;

COMMENT ON COLUMN public.pagamentos.mes_referencia IS
  'Mês/ano de referência do pagamento (armazenado como 1º dia do mês, ex: 2026-02-01). Aplicável a dízimos.';