
-- Allow dizimistas to see payments linked to their paroquiano record
CREATE POLICY "pagamentos_select_own_paroquiano"
ON public.pagamentos
FOR SELECT
USING (
  paroquiano_id IN (
    SELECT id FROM public.paroquianos WHERE user_id = auth.uid()
  )
);
