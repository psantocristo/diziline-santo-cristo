
-- Add estado_civil column to paroquianos
ALTER TABLE public.paroquianos ADD COLUMN IF NOT EXISTS estado_civil text;

-- Create membros_familia table
CREATE TABLE IF NOT EXISTS public.membros_familia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paroquiano_id uuid NOT NULL REFERENCES public.paroquianos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  parentesco text NOT NULL,
  data_nascimento date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.membros_familia ENABLE ROW LEVEL SECURITY;

-- RLS policies for membros_familia
CREATE POLICY "membros_familia_select_own" ON public.membros_familia
  FOR SELECT TO authenticated
  USING (paroquiano_id IN (SELECT id FROM public.paroquianos WHERE user_id = auth.uid()));

CREATE POLICY "membros_familia_select_admin" ON public.membros_familia
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "membros_familia_insert_own" ON public.membros_familia
  FOR INSERT TO authenticated
  WITH CHECK (paroquiano_id IN (SELECT id FROM public.paroquianos WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "membros_familia_delete_admin" ON public.membros_familia
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "membros_familia_update" ON public.membros_familia
  FOR UPDATE TO authenticated
  USING (paroquiano_id IN (SELECT id FROM public.paroquianos WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
