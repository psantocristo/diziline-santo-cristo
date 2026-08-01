
-- 1. Add DELETE policy for admins on notificacoes_admin
CREATE POLICY "notificacoes_delete_admin"
ON public.notificacoes_admin
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 2. Add INSERT policy for service role (triggers run as SECURITY DEFINER)
CREATE POLICY "notificacoes_insert_system"
ON public.notificacoes_admin
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3. Trigger function to notify on new payments (status = 'pago')
CREATE OR REPLACE FUNCTION public.notify_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _nome text;
  _metodo text;
  _valor text;
BEGIN
  -- Only notify when payment becomes 'pago'
  IF NEW.status = 'pago' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pago') THEN
    -- Get contributor name
    _nome := COALESCE(NEW.nome_contribuinte, 'Anônimo');
    IF NEW.paroquiano_id IS NOT NULL THEN
      SELECT nome_completo INTO _nome FROM public.paroquianos WHERE id = NEW.paroquiano_id;
    END IF;
    
    _metodo := UPPER(COALESCE(NEW.metodo::text, '?'));
    _valor := 'R$ ' || to_char(NEW.valor, 'FM999G999D00');
    
    INSERT INTO public.notificacoes_admin (tipo, titulo, mensagem, dados)
    VALUES (
      'novo_pagamento',
      'Pagamento recebido: ' || _valor,
      _nome || ' — ' || _metodo || ' | ' || COALESCE(NEW.tipo::text, '-'),
      jsonb_build_object('pagamento_id', NEW.id, 'valor', NEW.valor, 'metodo', NEW.metodo, 'tipo', NEW.tipo)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Attach trigger to pagamentos table
CREATE TRIGGER trg_notify_pagamento
AFTER INSERT OR UPDATE ON public.pagamentos
FOR EACH ROW
EXECUTE FUNCTION public.notify_pagamento();
