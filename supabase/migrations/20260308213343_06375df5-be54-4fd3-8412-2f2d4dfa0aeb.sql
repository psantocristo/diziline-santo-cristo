
-- 1. Totem can SELECT pagamentos originated from totem
CREATE POLICY "pagamentos_select_totem"
ON public.pagamentos FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'totem'::app_role)
  AND origem = 'totem'
);

-- 2. Update get_tema_paroquia to include 'site'
CREATE OR REPLACE FUNCTION public.get_tema_paroquia()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
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
    'cadastro_aberto',  cadastro_aberto,
    'site',             site
  )
  FROM public.configuracoes_paroquia
  LIMIT 1;
$$;
