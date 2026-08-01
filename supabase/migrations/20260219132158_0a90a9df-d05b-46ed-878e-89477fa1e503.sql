
-- 1. Adicionar role 'totem' ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'totem';

-- 2. Criar tabela totens
CREATE TABLE IF NOT EXISTS public.totens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#7B1C2A',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.totens ENABLE ROW LEVEL SECURITY;

-- 4. Policies — apenas super_admin
CREATE POLICY "totens_select_super_admin"
  ON public.totens FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "totens_insert_super_admin"
  ON public.totens FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "totens_update_super_admin"
  ON public.totens FOR UPDATE
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "totens_delete_super_admin"
  ON public.totens FOR DELETE
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 5. Trigger updated_at
CREATE TRIGGER update_totens_updated_at
  BEFORE UPDATE ON public.totens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 6. Habilitar realtime para totens e pagamentos
ALTER PUBLICATION supabase_realtime ADD TABLE public.totens;

-- 7. Policy SELECT anônimo para pagamentos do totem (corrige bug do TotemPix)
CREATE POLICY "pagamentos_select_totem"
  ON public.pagamentos FOR SELECT
  USING (origem = 'totem' AND user_id IS NULL);
