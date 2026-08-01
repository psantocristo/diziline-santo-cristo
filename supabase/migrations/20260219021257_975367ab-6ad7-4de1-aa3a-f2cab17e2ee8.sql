
-- Adicionar campo PIN do Totem na tabela configuracoes_paroquia
ALTER TABLE public.configuracoes_paroquia
  ADD COLUMN IF NOT EXISTS pin_totem text DEFAULT NULL;

-- Adicionar chave_pix para exibição no TotemBeneficiario
ALTER TABLE public.configuracoes_paroquia
  ADD COLUMN IF NOT EXISTS chave_pix text DEFAULT NULL;

-- A RLS existente (select/insert/update restrito a super_admin) já protege esses campos.
-- O Totem (anon) NÃO consegue ler o pin_totem porque a policy paroquia_select_super_admin
-- requer has_role(super_admin). Criaremos uma edge function para validar o PIN server-side.

-- Edge function de validação de PIN não precisa de migração adicional.
