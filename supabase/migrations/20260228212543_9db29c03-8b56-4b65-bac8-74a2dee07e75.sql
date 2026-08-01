-- Ajustar política de INSERT em pagamentos para permitir operações do Totem sem sessão autenticada
-- (o fluxo de totem usa PIN via edge function e grava user_id nulo)
DROP POLICY IF EXISTS "pagamentos_insert" ON public.pagamentos;

CREATE POLICY "pagamentos_insert"
ON public.pagamentos
FOR INSERT
WITH CHECK (
  (auth.uid() = user_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'totem'::app_role)
  OR (origem = 'totem' AND user_id IS NULL)
);