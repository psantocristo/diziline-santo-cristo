
-- Trigger: ao marcar um dízimo como pago, cancelar pendentes do mesmo paroquiano/mês
CREATE OR REPLACE FUNCTION public.cancelar_pendentes_mesmo_mes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'dizimo'
     AND NEW.status = 'pago'
     AND NEW.mes_referencia IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pago') THEN
    UPDATE public.pagamentos
       SET status = 'cancelado',
           gateway_status = COALESCE(gateway_status, 'auto_cancelado_mes_ja_pago'),
           updated_at = now()
     WHERE id <> NEW.id
       AND tipo = 'dizimo'
       AND mes_referencia = NEW.mes_referencia
       AND status IN ('criado', 'aguardando_pagamento')
       AND (
         (NEW.paroquiano_id IS NOT NULL AND paroquiano_id = NEW.paroquiano_id)
         OR (NEW.user_id IS NOT NULL AND user_id = NEW.user_id)
       );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancelar_pendentes_mesmo_mes ON public.pagamentos;
CREATE TRIGGER trg_cancelar_pendentes_mesmo_mes
AFTER INSERT OR UPDATE OF status ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.cancelar_pendentes_mesmo_mes();
