CREATE OR REPLACE FUNCTION public.get_meses_dizimista(_paroquiano_id uuid, _ano integer)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(json_build_object(
    'mes_referencia', mes_referencia,
    'status', status
  )), '[]'::json)
  FROM public.pagamentos
  WHERE paroquiano_id = _paroquiano_id
    AND tipo = 'dizimo'
    AND mes_referencia >= make_date(_ano, 1, 1)
    AND mes_referencia <= make_date(_ano, 12, 31)
$$;