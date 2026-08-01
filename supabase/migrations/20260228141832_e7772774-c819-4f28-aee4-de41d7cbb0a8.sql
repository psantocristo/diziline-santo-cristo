
-- Tabela de avisos para exibição no totem
CREATE TABLE public.avisos_totem (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  cor text DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER set_avisos_totem_updated_at
  BEFORE UPDATE ON public.avisos_totem
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Habilitar RLS
ALTER TABLE public.avisos_totem ENABLE ROW LEVEL SECURITY;

-- SELECT público (totem não tem sessão autenticada)
CREATE POLICY "avisos_totem_select_public"
  ON public.avisos_totem
  FOR SELECT
  USING (true);

-- INSERT apenas super_admin
CREATE POLICY "avisos_totem_insert_admin"
  ON public.avisos_totem
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- UPDATE apenas super_admin
CREATE POLICY "avisos_totem_update_admin"
  ON public.avisos_totem
  FOR UPDATE
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- DELETE apenas super_admin
CREATE POLICY "avisos_totem_delete_admin"
  ON public.avisos_totem
  FOR DELETE
  USING (has_role(auth.uid(), 'super_admin'::app_role));
