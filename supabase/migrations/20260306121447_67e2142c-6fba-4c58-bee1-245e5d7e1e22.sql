
-- Replace the overly permissive INSERT policy with admin-only
DROP POLICY IF EXISTS "notificacoes_insert_system" ON public.notificacoes_admin;

CREATE POLICY "notificacoes_insert_admin"
ON public.notificacoes_admin
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
