
-- Function to get the community ID of a servo (admin user)
CREATE OR REPLACE FUNCTION public.get_servo_comunidade(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT comunidade_id FROM public.servos
  WHERE user_id = _user_id AND ativo = true
  LIMIT 1;
$$;

-- Update paroquianos SELECT policy for admin to filter by community
-- Drop old policy and create new one
DROP POLICY IF EXISTS paroquianos_select_admin ON public.paroquianos;
CREATE POLICY paroquianos_select_admin ON public.paroquianos FOR SELECT USING (
  has_role(auth.uid(), 'super_admin')
  OR (
    has_role(auth.uid(), 'admin')
    AND (
      get_servo_comunidade(auth.uid()) IS NULL
      OR comunidade_id = get_servo_comunidade(auth.uid())
    )
  )
);

-- Update paroquianos UPDATE policy for admin
DROP POLICY IF EXISTS paroquianos_update_admin ON public.paroquianos;
CREATE POLICY paroquianos_update_admin ON public.paroquianos FOR UPDATE USING (
  has_role(auth.uid(), 'super_admin')
  OR (
    has_role(auth.uid(), 'admin')
    AND (
      get_servo_comunidade(auth.uid()) IS NULL
      OR comunidade_id = get_servo_comunidade(auth.uid())
    )
  )
);

-- Update pagamentos SELECT policy for admin to filter by community
DROP POLICY IF EXISTS pagamentos_select_admin ON public.pagamentos;
CREATE POLICY pagamentos_select_admin ON public.pagamentos FOR SELECT USING (
  has_role(auth.uid(), 'super_admin')
  OR (
    has_role(auth.uid(), 'admin')
    AND (
      get_servo_comunidade(auth.uid()) IS NULL
      OR paroquiano_id IN (
        SELECT id FROM public.paroquianos
        WHERE comunidade_id = get_servo_comunidade(auth.uid())
      )
      OR paroquiano_id IS NULL
    )
  )
);

-- Update pagamentos UPDATE policy for admin
DROP POLICY IF EXISTS pagamentos_update_admin ON public.pagamentos;
CREATE POLICY pagamentos_update_admin ON public.pagamentos FOR UPDATE USING (
  has_role(auth.uid(), 'super_admin')
  OR (
    has_role(auth.uid(), 'admin')
    AND (
      get_servo_comunidade(auth.uid()) IS NULL
      OR paroquiano_id IN (
        SELECT id FROM public.paroquianos
        WHERE comunidade_id = get_servo_comunidade(auth.uid())
      )
      OR paroquiano_id IS NULL
    )
  )
);
