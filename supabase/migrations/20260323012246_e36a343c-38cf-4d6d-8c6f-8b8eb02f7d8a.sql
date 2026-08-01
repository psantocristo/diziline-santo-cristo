
-- 1. Create consolidated dashboard function
CREATE OR REPLACE FUNCTION public.get_dashboard_resumo(_comunidade_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _result json;
  _inicio_mes timestamptz;
  _fim_mes timestamptz;
  _inicio_12m timestamptz;
  _paroquiano_ids uuid[];
BEGIN
  _inicio_mes := date_trunc('month', now());
  _fim_mes := date_trunc('month', now()) + interval '1 month' - interval '1 second';
  _inicio_12m := date_trunc('month', now() - interval '11 months');

  IF _comunidade_id IS NOT NULL THEN
    SELECT array_agg(id) INTO _paroquiano_ids
    FROM public.paroquianos WHERE comunidade_id = _comunidade_id;
  END IF;

  SELECT json_build_object(
    'total_mes', (
      SELECT COALESCE(SUM(valor), 0) FROM public.pagamentos
      WHERE status = 'pago' AND created_at >= _inicio_mes AND created_at <= _fim_mes
      AND (_comunidade_id IS NULL OR paroquiano_id = ANY(_paroquiano_ids))
    ),
    'total_pix', (
      SELECT COALESCE(SUM(valor), 0) FROM public.pagamentos
      WHERE status = 'pago' AND metodo = 'pix' AND created_at >= _inicio_mes AND created_at <= _fim_mes
      AND (_comunidade_id IS NULL OR paroquiano_id = ANY(_paroquiano_ids))
    ),
    'total_cartao', (
      SELECT COALESCE(SUM(valor), 0) FROM public.pagamentos
      WHERE status = 'pago' AND metodo != 'pix' AND created_at >= _inicio_mes AND created_at <= _fim_mes
      AND (_comunidade_id IS NULL OR paroquiano_id = ANY(_paroquiano_ids))
    ),
    'total_aprovados', (
      SELECT COUNT(*) FROM public.pagamentos
      WHERE status = 'pago'
      AND (_comunidade_id IS NULL OR paroquiano_id = ANY(_paroquiano_ids))
    ),
    'total_dizimistas', (
      SELECT COUNT(*) FROM public.paroquianos
      WHERE status = 'ativo'
      AND (_comunidade_id IS NULL OR comunidade_id = _comunidade_id)
    ),
    'campanhas', (
      SELECT COALESCE(json_agg(json_build_object(
        'meta_financeira', meta_financeira,
        'total_arrecadado', total_arrecadado
      )), '[]'::json)
      FROM public.campanhas WHERE ativo = true
    ),
    'pagamentos_12m', (
      SELECT COALESCE(json_agg(json_build_object(
        'valor', p.valor,
        'tipo', p.tipo,
        'origem', COALESCE(p.origem, 'web'),
        'created_at', p.created_at,
        'comunidade_nome', c.nome
      )), '[]'::json)
      FROM public.pagamentos p
      LEFT JOIN public.paroquianos pq ON pq.id = p.paroquiano_id
      LEFT JOIN public.comunidades c ON c.id = pq.comunidade_id
      WHERE p.status = 'pago' AND p.created_at >= _inicio_12m
      AND (_comunidade_id IS NULL OR p.paroquiano_id = ANY(_paroquiano_ids))
    )
  ) INTO _result;

  RETURN _result;
END;
$$;

-- 2. Enable realtime for notificacoes_admin
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes_admin;
