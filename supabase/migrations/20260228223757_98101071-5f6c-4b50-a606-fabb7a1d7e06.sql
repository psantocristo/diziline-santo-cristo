
-- Add extended theming columns
ALTER TABLE public.configuracoes_paroquia ADD COLUMN IF NOT EXISTS cor_acento TEXT DEFAULT '40 75% 50%';
ALTER TABLE public.configuracoes_paroquia ADD COLUMN IF NOT EXISTS cor_fonte TEXT DEFAULT '350 40% 12%';
ALTER TABLE public.configuracoes_paroquia ADD COLUMN IF NOT EXISTS tamanho_fonte TEXT DEFAULT 'medio';

-- Update get_tema_paroquia to include new fields
CREATE OR REPLACE FUNCTION public.get_tema_paroquia()
RETURNS JSON
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'nome',             nome,
    'cnpj',             cnpj,
    'logo_url',         logo_url,
    'logo_termico_url', logo_termico_url,
    'cor_primaria',     cor_primaria,
    'cor_secundaria',   cor_secundaria,
    'cor_acento',       cor_acento,
    'cor_fonte',        cor_fonte,
    'tamanho_fonte',    tamanho_fonte,
    'slogan',           slogan,
    'cadastro_aberto',  cadastro_aberto
  )
  FROM public.configuracoes_paroquia
  LIMIT 1;
$$;
