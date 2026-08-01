
-- 1. Campos no cadastro de paroquianos
ALTER TABLE public.paroquianos
  ADD COLUMN IF NOT EXISTS melhor_dia_pagamento smallint CHECK (melhor_dia_pagamento BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS notificacoes_push_ativas boolean NOT NULL DEFAULT true;

-- 2. Tabela de subscriptions Web Push
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  platform text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subs_select_own" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "push_subs_insert_own" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_subs_update_own" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_subs_delete_own" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);

-- 3. Histórico de notificações enviadas (deduplicação)
CREATE TABLE IF NOT EXISTS public.notificacoes_enviadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  referencia date NOT NULL,
  payload jsonb,
  enviada_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tipo, referencia)
);

GRANT ALL ON public.notificacoes_enviadas TO service_role;
ALTER TABLE public.notificacoes_enviadas ENABLE ROW LEVEL SECURITY;
-- Sem política para anon/authenticated: apenas service_role acessa.

CREATE INDEX IF NOT EXISTS idx_notif_env_user_tipo ON public.notificacoes_enviadas(user_id, tipo, referencia);
