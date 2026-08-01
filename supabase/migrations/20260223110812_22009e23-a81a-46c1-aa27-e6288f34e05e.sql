
-- Criar função set_updated_at se não existir
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tabela de configurações TEF (maquininha física)
CREATE TABLE public.configuracoes_tef (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  middleware_url TEXT NOT NULL DEFAULT '',
  middleware_token TEXT DEFAULT '',
  terminal_id TEXT DEFAULT '',
  ativo BOOLEAN DEFAULT false,
  ultimo_teste TIMESTAMPTZ,
  status_conexao TEXT DEFAULT 'desconectado',
  modo TEXT DEFAULT 'simulacao',
  timeout_segundos INT DEFAULT 60,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.configuracoes_tef ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_tef_select" ON public.configuracoes_tef
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "super_admin_tef_update" ON public.configuracoes_tef
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "super_admin_tef_insert" ON public.configuracoes_tef
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Registro padrão (bypass RLS)
INSERT INTO public.configuracoes_tef (middleware_url) VALUES ('');

-- Trigger para updated_at
CREATE TRIGGER set_updated_at_configuracoes_tef
  BEFORE UPDATE ON public.configuracoes_tef
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
