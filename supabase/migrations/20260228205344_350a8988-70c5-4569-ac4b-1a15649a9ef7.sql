
-- Allow totem role to insert payments
DROP POLICY IF EXISTS "pagamentos_insert" ON public.pagamentos;
CREATE POLICY "pagamentos_insert" ON public.pagamentos
  FOR INSERT
  WITH CHECK (
    (auth.uid() = user_id)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'totem'::app_role)
  );
