ALTER TABLE public.configuracoes_gateway
  ADD COLUMN IF NOT EXISTS client_id text,
  ADD COLUMN IF NOT EXISTS client_secret text,
  ADD COLUMN IF NOT EXISTS webhook_url text,
  ADD COLUMN IF NOT EXISTS sandbox_url text DEFAULT 'https://sandbox-erede.useredecloud.com.br',
  ADD COLUMN IF NOT EXISTS producao_url text DEFAULT 'https://api.userede.com.br/erede',
  ADD COLUMN IF NOT EXISTS oauth_url_sandbox text DEFAULT 'https://rl7-sandbox-api.useredecloud.com.br/oauth2/token',
  ADD COLUMN IF NOT EXISTS oauth_url_producao text DEFAULT 'https://api.userede.com.br/redelabs/oauth2/token';