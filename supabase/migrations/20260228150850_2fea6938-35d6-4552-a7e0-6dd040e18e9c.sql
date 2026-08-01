
-- Adicionar coluna cadastro_aberto na tabela configuracoes_paroquia
ALTER TABLE public.configuracoes_paroquia 
ADD COLUMN cadastro_aberto boolean NOT NULL DEFAULT true;

-- Atualizar a funcao RPC get_tema_paroquia para incluir cadastro_aberto
CREATE OR REPLACE FUNCTION public.get_tema_paroquia()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'nome', nome,
    'cnpj', cnpj,
    'logo_url', logo_url,
    'logo_termico_url', logo_termico_url,
    'cor_primaria', cor_primaria,
    'cor_secundaria', cor_secundaria,
    'slogan', slogan,
    'cadastro_aberto', cadastro_aberto
  )
  FROM public.configuracoes_paroquia
  LIMIT 1;
$function$;
