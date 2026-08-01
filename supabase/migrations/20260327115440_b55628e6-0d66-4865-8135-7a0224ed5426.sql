
CREATE TABLE public.certificados_emitidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  tamanho text NOT NULL DEFAULT 'A4',
  nome_completo text NOT NULL,
  data_cerimonia date,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  emitido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.certificados_emitidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "certificados_select_admin" ON public.certificados_emitidos
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "certificados_insert_admin" ON public.certificados_emitidos
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "certificados_delete_admin" ON public.certificados_emitidos
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));
