-- Impede dois pagamentos de dízimo "pago" para o mesmo paroquiano no mesmo mês de referência.
-- Pagamentos cancelados/expirados/aguardando não bloqueiam novas tentativas.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_dizimo_pago_mes
  ON public.pagamentos (paroquiano_id, mes_referencia)
  WHERE tipo = 'dizimo'
    AND status = 'pago'
    AND paroquiano_id IS NOT NULL
    AND mes_referencia IS NOT NULL;

-- Garante role padrão "dizimista" para usuários autenticados sem role atribuída,
-- evitando que a tela trave em "Verificando permissões".
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'dizimista'::public.app_role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.user_id IS NULL
ON CONFLICT DO NOTHING;