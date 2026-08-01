
-- 1. Tabela para persistir logs do terminal
CREATE TABLE public.logs_terminal (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  tipo text NOT NULL DEFAULT 'info' CHECK (tipo IN ('info', 'success', 'warning', 'error')),
  origem text NOT NULL DEFAULT 'sistema',
  mensagem text NOT NULL,
  detalhes text,
  return_code text,
  pagamento_id uuid REFERENCES public.pagamentos(id) ON DELETE SET NULL
);

CREATE INDEX idx_logs_terminal_created_at ON public.logs_terminal (created_at DESC);
CREATE INDEX idx_logs_terminal_tipo ON public.logs_terminal (tipo);
CREATE INDEX idx_logs_terminal_origem ON public.logs_terminal (origem);

ALTER TABLE public.logs_terminal ENABLE ROW LEVEL SECURITY;

CREATE POLICY logs_terminal_select_admin ON public.logs_terminal
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY logs_terminal_insert_system ON public.logs_terminal
  FOR INSERT WITH CHECK (true);

-- Trigger: auto-log mudanças em pagamentos
CREATE OR REPLACE FUNCTION public.log_pagamento_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tipo text := 'info';
  _msg text;
  _det text;
  _rc text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _msg := 'Nova transação — ' || UPPER(COALESCE(NEW.metodo::text, '?')) || ' R$ ' || to_char(NEW.valor, 'FM999G999D00');
    _det := 'ID: ' || left(NEW.id::text, 8) || '… | Status: ' || NEW.status || ' | Tipo: ' || NEW.tipo;
    INSERT INTO public.logs_terminal (tipo, origem, mensagem, detalhes, pagamento_id)
    VALUES ('info', COALESCE(NEW.origem, 'sistema'), _msg, _det, NEW.id);
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    _rc := (NEW.gateway_payload->>'returnCode');
    IF NEW.status = 'pago' THEN
      _tipo := 'success';
      _msg := '✅ APROVADO — ' || UPPER(COALESCE(NEW.metodo::text, '?')) || ' R$ ' || to_char(NEW.valor, 'FM999G999D00');
      _det := 'Gateway: ' || COALESCE(NEW.gateway_status, '-') || ' | ID: ' || left(NEW.id::text, 8) || '…';
      IF NEW.gateway_id IS NOT NULL THEN _det := _det || ' | TID: ' || NEW.gateway_id; END IF;
    ELSIF NEW.status = 'cancelado' THEN
      _tipo := 'error';
      _msg := '❌ RECUSADO — ' || UPPER(COALESCE(NEW.metodo::text, '?')) || ' R$ ' || to_char(NEW.valor, 'FM999G999D00');
      _det := 'Motivo: ' || COALESCE(NEW.gateway_status, 'Não informado');
    ELSIF NEW.status = 'expirado' THEN
      _tipo := 'warning';
      _msg := '⏰ EXPIRADO — ' || UPPER(COALESCE(NEW.metodo::text, '?')) || ' R$ ' || to_char(NEW.valor, 'FM999G999D00');
      _det := 'ID: ' || left(NEW.id::text, 8) || '…';
    ELSIF NEW.status = 'aguardando_pagamento' AND OLD.status = 'criado' THEN
      _msg := '⏳ Aguardando pagamento — ' || UPPER(COALESCE(NEW.metodo::text, '?')) || ' R$ ' || to_char(NEW.valor, 'FM999G999D00');
      _det := 'ID: ' || left(NEW.id::text, 8) || '…';
      IF NEW.gateway_id IS NOT NULL THEN _det := _det || ' | Gateway ID: ' || NEW.gateway_id; END IF;
    ELSE
      _msg := 'Status alterado: ' || COALESCE(OLD.status::text, '?') || ' → ' || NEW.status;
      _det := 'ID: ' || left(NEW.id::text, 8) || '… | ' || UPPER(COALESCE(NEW.metodo::text, '?')) || ' R$ ' || to_char(NEW.valor, 'FM999G999D00');
    END IF;

    INSERT INTO public.logs_terminal (tipo, origem, mensagem, detalhes, return_code, pagamento_id)
    VALUES (_tipo, COALESCE(NEW.origem, 'sistema'), _msg, _det, _rc, NEW.id);
  ELSIF OLD.gateway_status IS DISTINCT FROM NEW.gateway_status AND NEW.gateway_status IS NOT NULL THEN
    _msg := 'Gateway: ' || NEW.gateway_status;
    _det := 'ID: ' || left(NEW.id::text, 8) || '… | ' || UPPER(COALESCE(NEW.metodo::text, '?'));
    INSERT INTO public.logs_terminal (tipo, origem, mensagem, detalhes, pagamento_id)
    VALUES ('info', COALESCE(NEW.origem, 'sistema'), _msg, _det, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_pagamento
AFTER INSERT OR UPDATE ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.log_pagamento_change();

-- Trigger: auto-log webhooks
CREATE OR REPLACE FUNCTION public.log_webhook_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.logs_terminal (tipo, origem, mensagem, detalhes, pagamento_id)
  VALUES (
    CASE WHEN NEW.erro IS NOT NULL THEN 'error' ELSE 'info' END,
    'webhook',
    'Webhook: ' || NEW.evento || CASE WHEN NEW.erro IS NOT NULL THEN ' — ERRO: ' || NEW.erro ELSE '' END,
    'Status: ' || COALESCE(NEW.status_processamento, '-') || CASE WHEN NEW.pagamento_id IS NOT NULL THEN ' | Pagamento: ' || left(NEW.pagamento_id::text, 8) || '…' ELSE '' END,
    NEW.pagamento_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_webhook
AFTER INSERT ON public.logs_webhook
FOR EACH ROW EXECUTE FUNCTION public.log_webhook_change();

-- Remover realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.pagamentos;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.logs_webhook;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.logs_auditoria;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;
