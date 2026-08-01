
-- Criar tabela configuracoes_paroquia
CREATE TABLE public.configuracoes_paroquia (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text,
  cnpj text,
  telefone text,
  endereco text,
  site text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.configuracoes_paroquia ENABLE ROW LEVEL SECURITY;

-- Apenas super_admin pode SELECT
CREATE POLICY "paroquia_select_super_admin"
ON public.configuracoes_paroquia
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Apenas super_admin pode INSERT
CREATE POLICY "paroquia_insert_super_admin"
ON public.configuracoes_paroquia
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Apenas super_admin pode UPDATE
CREATE POLICY "paroquia_update_super_admin"
ON public.configuracoes_paroquia
FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_configuracoes_paroquia_updated_at
BEFORE UPDATE ON public.configuracoes_paroquia
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();
