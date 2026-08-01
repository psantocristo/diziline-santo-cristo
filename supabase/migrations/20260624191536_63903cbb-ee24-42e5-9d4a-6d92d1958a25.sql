
-- ============================================================
-- HARDENING DE SEGURANÇA — itens críticos + altos
-- Mantém o sistema 100% funcional
-- ============================================================

-- 1) logs_terminal: a policy de INSERT estava com WITH CHECK true para `public`,
--    permitindo que qualquer autenticado inserisse logs falsos.
--    Restringimos a service_role. Os triggers (SECURITY DEFINER) continuam funcionando
--    porque rodam com privilégios do owner, ignorando RLS.
DROP POLICY IF EXISTS logs_terminal_insert_system ON public.logs_terminal;
CREATE POLICY logs_terminal_insert_system
  ON public.logs_terminal
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 2) Revogar EXECUTE de `anon` nas funções SECURITY DEFINER que expõem dados
--    administrativos. Usuários autenticados continuam podendo chamar (RLS interno
--    garante que apenas admins enxerguem dados reais via UI).
REVOKE EXECUTE ON FUNCTION public.get_dashboard_resumo(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_gateway_metrics(integer) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_dashboard_resumo(uuid) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.get_gateway_metrics(integer) TO authenticated, service_role;

-- 3) Adicionar coluna para indicar se o webhook do provedor exige HMAC obrigatório.
--    Default = true em produção (forçamos no edge function).
ALTER TABLE public.configuracoes_gateway
  ADD COLUMN IF NOT EXISTS webhook_hmac_obrigatorio boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.configuracoes_gateway.webhook_hmac_obrigatorio IS
  'Quando true, rejeita webhooks sem assinatura HMAC válida em modo produção.';
