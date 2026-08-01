
-- Tabela de notificações para o admin
CREATE TABLE public.notificacoes_admin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  dados jsonb DEFAULT '{}',
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes_admin ENABLE ROW LEVEL SECURITY;

-- Apenas admin/super_admin podem ler
CREATE POLICY "notificacoes_select_admin" ON public.notificacoes_admin
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Apenas admin/super_admin podem marcar como lida
CREATE POLICY "notificacoes_update_admin" ON public.notificacoes_admin
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Função para gerar matrícula sequencial
CREATE OR REPLACE FUNCTION public.gerar_matricula_paroquial()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 'DIZSC-' || lpad(
    (COALESCE(
      MAX(NULLIF(regexp_replace(matricula_paroquial, '^DIZSC-', ''), '')::int),
      0
    ) + 1)::text, 5, '0'
  )
  FROM public.paroquianos
  WHERE matricula_paroquial LIKE 'DIZSC-%'
$$;
