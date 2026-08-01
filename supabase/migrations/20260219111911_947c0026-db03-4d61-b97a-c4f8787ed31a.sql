
-- Adicionar colunas de personalização white-label à tabela configuracoes_paroquia
ALTER TABLE public.configuracoes_paroquia
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS cor_primaria text DEFAULT '40 55% 54%',
  ADD COLUMN IF NOT EXISTS cor_secundaria text DEFAULT '350 60% 28%',
  ADD COLUMN IF NOT EXISTS slogan text;

-- Criar função RPC pública para leitura do tema sem autenticação
-- Necessário para carregar o tema na tela de login e no Totem
CREATE OR REPLACE FUNCTION public.get_tema_paroquia()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'nome', nome,
    'logo_url', logo_url,
    'cor_primaria', cor_primaria,
    'cor_secundaria', cor_secundaria,
    'slogan', slogan
  )
  FROM public.configuracoes_paroquia
  LIMIT 1;
$$;

-- Conceder acesso público à função RPC (anon role)
GRANT EXECUTE ON FUNCTION public.get_tema_paroquia() TO anon;
GRANT EXECUTE ON FUNCTION public.get_tema_paroquia() TO authenticated;
