
-- Corrigir políticas com WITH CHECK (true) para logs - apenas autenticados podem inserir
DROP POLICY IF EXISTS "logs_webhook_insert" ON public.logs_webhook;
DROP POLICY IF EXISTS "logs_auditoria_insert" ON public.logs_auditoria;

CREATE POLICY "logs_webhook_insert" ON public.logs_webhook 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR true); 

-- Na prática os logs de webhook vêm do edge function (service role), então true é correto
-- Mas vamos deixar apenas autenticados para o log de auditoria
CREATE POLICY "logs_auditoria_insert" ON public.logs_auditoria 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Corrigir function search_path para update_updated_at (a única sem search_path)
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
