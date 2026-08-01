
-- Otimizar RLS de configuracoes_tef: trocar EXISTS por has_role()
DROP POLICY IF EXISTS super_admin_tef_select ON public.configuracoes_tef;
DROP POLICY IF EXISTS super_admin_tef_insert ON public.configuracoes_tef;
DROP POLICY IF EXISTS super_admin_tef_update ON public.configuracoes_tef;

CREATE POLICY super_admin_tef_select ON public.configuracoes_tef
  FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY super_admin_tef_insert ON public.configuracoes_tef
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY super_admin_tef_update ON public.configuracoes_tef
  FOR UPDATE USING (has_role(auth.uid(), 'super_admin'::app_role));
