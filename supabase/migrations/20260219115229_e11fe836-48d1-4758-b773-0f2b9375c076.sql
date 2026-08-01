
-- Criar tabela servos para voluntários do dízimo
CREATE TABLE public.servos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  cpf         text,
  ativo       boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.servos ENABLE ROW LEVEL SECURITY;

-- SELECT: super_admin pode ver todos; servo vê apenas o seu próprio registro
CREATE POLICY "servos_select_super_admin"
  ON public.servos FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR auth.uid() = user_id);

-- INSERT: apenas super_admin
CREATE POLICY "servos_insert_super_admin"
  ON public.servos FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- UPDATE: apenas super_admin
CREATE POLICY "servos_update_super_admin"
  ON public.servos FOR UPDATE
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- DELETE: apenas super_admin
CREATE POLICY "servos_delete_super_admin"
  ON public.servos FOR DELETE
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_servos_updated_at
  BEFORE UPDATE ON public.servos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
