INSERT INTO public.configuracoes_tef (
  middleware_url, middleware_token, terminal_id, ativo,
  modo, timeout_segundos, credito_ativo, debito_ativo,
  provedor_tef, middleware_urls, status_conexao
) VALUES (
  '', '', '', false,
  'simulacao', 60, true, true,
  'connect_tef', '{}'::jsonb, 'desconectado'
);