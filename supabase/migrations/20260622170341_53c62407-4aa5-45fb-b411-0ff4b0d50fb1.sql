-- 1) Idempotência via coluna dedicada
ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pagamentos_idempotency_key_unique
  ON public.pagamentos(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 2) Rate limiting (controle de hits por janela)
CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  bucket text NOT NULL,
  key text NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket, key)
);
GRANT ALL ON public.edge_rate_limits TO service_role;
ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;
-- Sem policies: apenas service_role acessa via Edge Functions

CREATE INDEX IF NOT EXISTS idx_edge_rate_limits_window
  ON public.edge_rate_limits(window_start);

-- 3) Provedor de pagamento alternativo (fallback)
ALTER TABLE public.configuracoes_gateway
  ADD COLUMN IF NOT EXISTS provedor_fallback text;

-- 4) RPC de métricas por provedor (para dashboard)
CREATE OR REPLACE FUNCTION public.get_gateway_metrics(_dias integer DEFAULT 30)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  FROM (
    SELECT
      COALESCE(NULLIF(provedor, ''), 'rede') AS provedor,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'pago')::int AS aprovados,
      COUNT(*) FILTER (WHERE status = 'cancelado')::int AS recusados,
      COUNT(*) FILTER (WHERE status IN ('aguardando_pagamento','criado'))::int AS pendentes,
      COALESCE(SUM(valor) FILTER (WHERE status = 'pago'), 0)::numeric AS volume,
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE status = 'pago')::numeric
        / NULLIF(COUNT(*), 0), 2
      ) AS taxa_aprovacao
    FROM public.pagamentos
    WHERE created_at >= now() - (_dias || ' days')::interval
    GROUP BY 1
    ORDER BY 2 DESC
  ) t
$$;

GRANT EXECUTE ON FUNCTION public.get_gateway_metrics(integer) TO authenticated, service_role;