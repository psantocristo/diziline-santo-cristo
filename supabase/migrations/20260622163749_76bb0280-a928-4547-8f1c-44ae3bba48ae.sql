ALTER TABLE public.configuracoes_tef
  ADD COLUMN IF NOT EXISTS middleware_urls jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.configuracoes_tef.middleware_urls IS
  'Mapa de URLs por provedor TEF. Ex: {"connect_tef":"http://localhost:8080","sipag":"http://localhost:60906","pagarme_stone":"http://localhost:9999","paygo":"http://localhost:60906"}';