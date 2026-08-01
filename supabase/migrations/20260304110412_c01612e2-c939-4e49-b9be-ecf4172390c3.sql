
CREATE TABLE public.tokens_client (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  token text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  ultimo_uso timestamptz,
  ip_ultimo_uso text
);

ALTER TABLE public.tokens_client ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tokens_select_super_admin" ON public.tokens_client
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "tokens_insert_super_admin" ON public.tokens_client
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "tokens_update_super_admin" ON public.tokens_client
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "tokens_delete_super_admin" ON public.tokens_client
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));
