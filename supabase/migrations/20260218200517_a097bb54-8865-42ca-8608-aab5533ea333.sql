
-- 1. Adicionar coluna origem à tabela pagamentos
ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS origem text DEFAULT 'web';

-- 2. Adicionar trigger de validação para origem (em vez de CHECK constraint)
CREATE OR REPLACE FUNCTION public.validate_pagamento_origem()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.origem IS NOT NULL AND NEW.origem NOT IN ('web', 'totem', 'admin', 'kiosk') THEN
    RAISE EXCEPTION 'Origem inválida: %. Valores permitidos: web, totem, admin, kiosk', NEW.origem;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_validate_pagamento_origem
BEFORE INSERT OR UPDATE ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.validate_pagamento_origem();

-- 3. RLS: Permitir INSERT anônimo para pagamentos do totem (user_id NULL, origem = 'totem')
CREATE POLICY pagamentos_insert_totem
ON public.pagamentos
FOR INSERT
WITH CHECK (user_id IS NULL AND origem = 'totem');

-- 4. RLS: Permitir SELECT público de paroquianos para identificação no totem
--    (apenas leitura básica, restrita a busca por CPF/matrícula — sem filtro de coluna no RLS,
--    mas o totem só consulta e exibe nome + comunidade)
CREATE POLICY paroquianos_select_totem
ON public.paroquianos
FOR SELECT
USING (status = 'ativo');

-- 5. RLS: Permitir INSERT de comprovantes para pagamentos do totem (sem autenticação)
CREATE POLICY comprovantes_insert_totem
ON public.comprovantes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pagamentos p
    WHERE p.id = pagamento_id AND p.origem = 'totem'
  )
);
