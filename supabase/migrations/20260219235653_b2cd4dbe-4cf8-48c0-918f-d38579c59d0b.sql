
-- ================================================================
-- CORREÇÃO DE SEGURANÇA: Remover policies que expõem dados sensíveis
-- publicamente sem autenticação
-- ================================================================

-- 1. Remover policy que expõe TODOS os dados de paroquianos (CPF, endereço, etc.)
--    para acessos não autenticados via totem
DROP POLICY IF EXISTS paroquianos_select_totem ON public.paroquianos;

-- 2. Remover policy que expõe dados de pagamentos sem autenticação
DROP POLICY IF EXISTS pagamentos_select_totem ON public.pagamentos;

-- 3. Remover policy de INSERT público de pagamentos do totem sem autenticação
--    (será substituída por service role via edge function)
DROP POLICY IF EXISTS pagamentos_insert_totem ON public.pagamentos;

-- 4. Remover policy de INSERT público de comprovantes do totem
DROP POLICY IF EXISTS comprovantes_insert_totem ON public.comprovantes;

-- NOTA: O acesso do totem será feito exclusivamente via Edge Functions
-- que usam SUPABASE_SERVICE_ROLE_KEY server-side, garantindo segurança
-- sem expor dados ao cliente.
