
CREATE OR REPLACE FUNCTION public.get_paroquia_publica()
RETURNS TABLE (
  id uuid,
  nome text,
  site text,
  logo_url text,
  logo_carteirinha_url text,
  logo_termico_url text,
  slogan text,
  cor_primaria text,
  cor_secundaria text,
  cor_acento text,
  cor_fonte text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, nome, site, logo_url, logo_carteirinha_url, logo_termico_url,
         slogan, cor_primaria, cor_secundaria, cor_acento, cor_fonte
  FROM public.configuracoes_paroquia
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_paroquia_publica() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_paroquia_publica() TO anon, authenticated;
