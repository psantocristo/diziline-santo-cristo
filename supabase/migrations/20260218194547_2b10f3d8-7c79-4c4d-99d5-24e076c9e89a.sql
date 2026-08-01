
-- =====================================================
-- SISTEMA DÍZIMO SANTO CRISTO
-- Schema completo do banco de dados
-- =====================================================

-- 1. ENUM: Roles do sistema
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'paroquiano');

-- 2. ENUM: Status do paroquiano
CREATE TYPE public.paroquiano_status AS ENUM ('ativo', 'inativo', 'suspenso', 'inadimplente');

-- 3. ENUM: Status do pagamento
CREATE TYPE public.pagamento_status AS ENUM ('criado', 'aguardando_pagamento', 'pago', 'cancelado', 'expirado', 'estornado');

-- 4. ENUM: Método de pagamento
CREATE TYPE public.pagamento_metodo AS ENUM ('pix', 'credito', 'debito');

-- 5. ENUM: Tipo de contribuição
CREATE TYPE public.contribuicao_tipo AS ENUM ('dizimo', 'oferta', 'campanha', 'eventual');

-- 6. TABELA: Perfis de usuário
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. TABELA: Roles dos usuários (RBAC separado)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- 8. TABELA: Comunidades / Capelas
CREATE TABLE public.comunidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. TABELA: Paroquianos / Dizimistas
CREATE TABLE public.paroquianos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nome_completo TEXT NOT NULL,
  cpf TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  data_nascimento DATE,
  matricula_paroquial TEXT UNIQUE,
  comunidade_id UUID REFERENCES public.comunidades(id),
  status paroquiano_status NOT NULL DEFAULT 'ativo',
  data_inicio_dizimista DATE,
  valor_sugerido DECIMAL(10,2),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. TABELA: Campanhas
CREATE TABLE public.campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  banner_url TEXT,
  meta_financeira DECIMAL(10,2),
  total_arrecadado DECIMAL(10,2) NOT NULL DEFAULT 0,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  qrcode_exclusivo TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. TABELA: Categorias de pagamento
CREATE TABLE public.categorias_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo contribuicao_tipo NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. TABELA: Pagamentos / Transações
CREATE TABLE public.pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paroquiano_id UUID REFERENCES public.paroquianos(id),
  user_id UUID REFERENCES auth.users(id),
  campanha_id UUID REFERENCES public.campanhas(id),
  categoria_id UUID REFERENCES public.categorias_pagamento(id),
  tipo contribuicao_tipo NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  metodo pagamento_metodo NOT NULL,
  status pagamento_status NOT NULL DEFAULT 'criado',
  parcelas INTEGER DEFAULT 1,
  -- Dados do gateway (simulado/real)
  gateway_id TEXT,
  gateway_status TEXT,
  gateway_payload JSONB,
  -- PIX
  pix_copia_cola TEXT,
  pix_qrcode TEXT,
  pix_expiracao TIMESTAMPTZ,
  -- Comprovante
  codigo_autenticacao TEXT UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  comprovante_url TEXT,
  -- Timestamps
  pago_em TIMESTAMPTZ,
  expirado_em TIMESTAMPTZ,
  cancelado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. TABELA: Comprovantes
CREATE TABLE public.comprovantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pagamento_id UUID NOT NULL REFERENCES public.pagamentos(id) ON DELETE CASCADE,
  pdf_url TEXT,
  enviado_whatsapp BOOLEAN DEFAULT false,
  whatsapp_enviado_em TIMESTAMPTZ,
  versículo TEXT,
  mensagem_pastoral TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. TABELA: Mensagens personalizadas
CREATE TABLE public.mensagens_personalizadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo contribuicao_tipo,
  campanha_id UUID REFERENCES public.campanhas(id),
  comunidade_id UUID REFERENCES public.comunidades(id),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  versiculo TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. TABELA: Configurações do gateway
CREATE TABLE public.configuracoes_gateway (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL DEFAULT 'Laranjinha (Rede Itaú)',
  modo TEXT NOT NULL DEFAULT 'simulacao', -- 'simulacao' | 'producao'
  merchant_id TEXT,
  webhook_secret TEXT,
  parcelamento_max INTEGER DEFAULT 12,
  parcelamento_juros DECIMAL(5,4) DEFAULT 0.0199,
  pix_expiracao_minutos INTEGER DEFAULT 30,
  ativo BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. TABELA: Logs de webhook
CREATE TABLE public.logs_webhook (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pagamento_id UUID REFERENCES public.pagamentos(id),
  evento TEXT NOT NULL,
  payload JSONB,
  assinatura TEXT,
  status_processamento TEXT DEFAULT 'recebido',
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. TABELA: Logs de auditoria
CREATE TABLE public.logs_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  acao TEXT NOT NULL,
  entidade TEXT,
  entidade_id UUID,
  detalhes JSONB,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- FUNÇÃO: Verificar role do usuário (SECURITY DEFINER)
-- =====================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Função auxiliar: obter role mais alto do usuário
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'super_admin' THEN 1 
      WHEN 'admin' THEN 2 
      WHEN 'paroquiano' THEN 3 
    END
  LIMIT 1
$$;

-- =====================================================
-- TRIGGER: Auto-criar profile ao registrar usuário
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_completo, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.email),
    NEW.email
  );
  
  -- Atribuir role paroquiano por padrão
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'paroquiano');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- TRIGGER: Atualizar total arrecadado nas campanhas
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_campanha_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.campanha_id IS NOT NULL AND NEW.status = 'pago' THEN
    UPDATE public.campanhas
    SET total_arrecadado = (
      SELECT COALESCE(SUM(valor), 0)
      FROM public.pagamentos
      WHERE campanha_id = NEW.campanha_id AND status = 'pago'
    ),
    updated_at = now()
    WHERE id = NEW.campanha_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_pagamento_status_change
  AFTER INSERT OR UPDATE OF status ON public.pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_campanha_total();

-- =====================================================
-- TRIGGER: updated_at automático
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_paroquianos_updated_at BEFORE UPDATE ON public.paroquianos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_campanhas_updated_at BEFORE UPDATE ON public.campanhas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_pagamentos_updated_at BEFORE UPDATE ON public.pagamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_comunidades_updated_at BEFORE UPDATE ON public.comunidades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_mensagens_updated_at BEFORE UPDATE ON public.mensagens_personalizadas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paroquianos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comprovantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_personalizadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_gateway ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_webhook ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;

-- PROFILES: usuário vê/edita o próprio, admins veem todos
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_select_admin" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- USER_ROLES: apenas super_admin gerencia, usuário vê o próprio
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_roles_select_admin" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "user_roles_insert_admin" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "user_roles_update_admin" ON public.user_roles FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "user_roles_delete_admin" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'));

-- COMUNIDADES: todos autenticados veem, admins gerenciam
CREATE POLICY "comunidades_select" ON public.comunidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "comunidades_insert_admin" ON public.comunidades FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "comunidades_update_admin" ON public.comunidades FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "comunidades_delete_admin" ON public.comunidades FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'));

-- PAROQUIANOS: paroquiano vê o próprio, admin vê todos
CREATE POLICY "paroquianos_select_own" ON public.paroquianos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "paroquianos_select_admin" ON public.paroquianos FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "paroquianos_insert" ON public.paroquianos FOR INSERT WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "paroquianos_update_own" ON public.paroquianos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "paroquianos_update_admin" ON public.paroquianos FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "paroquianos_delete_admin" ON public.paroquianos FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'));

-- CAMPANHAS: todos veem, admins gerenciam
CREATE POLICY "campanhas_select" ON public.campanhas FOR SELECT TO authenticated USING (true);
CREATE POLICY "campanhas_select_public" ON public.campanhas FOR SELECT USING (ativo = true);
CREATE POLICY "campanhas_insert_admin" ON public.campanhas FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "campanhas_update_admin" ON public.campanhas FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "campanhas_delete_admin" ON public.campanhas FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'));

-- CATEGORIAS: todos veem, admins gerenciam
CREATE POLICY "categorias_select" ON public.categorias_pagamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "categorias_insert_admin" ON public.categorias_pagamento FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "categorias_update_admin" ON public.categorias_pagamento FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- PAGAMENTOS: usuário vê os próprios, admin vê todos
CREATE POLICY "pagamentos_select_own" ON public.pagamentos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "pagamentos_select_admin" ON public.pagamentos FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "pagamentos_insert" ON public.pagamentos FOR INSERT WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "pagamentos_update_own" ON public.pagamentos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "pagamentos_update_admin" ON public.pagamentos FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- COMPROVANTES: usuário vê os próprios, admin vê todos
CREATE POLICY "comprovantes_select_own" ON public.comprovantes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.pagamentos p WHERE p.id = pagamento_id AND p.user_id = auth.uid())
);
CREATE POLICY "comprovantes_select_admin" ON public.comprovantes FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "comprovantes_insert" ON public.comprovantes FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- MENSAGENS: todos veem ativas, super_admin gerencia
CREATE POLICY "mensagens_select" ON public.mensagens_personalizadas FOR SELECT TO authenticated USING (ativo = true);
CREATE POLICY "mensagens_insert_admin" ON public.mensagens_personalizadas FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "mensagens_update_admin" ON public.mensagens_personalizadas FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "mensagens_delete_admin" ON public.mensagens_personalizadas FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'));

-- CONFIGURAÇÕES GATEWAY: apenas super_admin
CREATE POLICY "config_gateway_select" ON public.configuracoes_gateway FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "config_gateway_all" ON public.configuracoes_gateway FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- LOGS WEBHOOK: apenas admins
CREATE POLICY "logs_webhook_select" ON public.logs_webhook FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "logs_webhook_insert" ON public.logs_webhook FOR INSERT WITH CHECK (true);

-- LOGS AUDITORIA: apenas admins
CREATE POLICY "logs_auditoria_select" ON public.logs_auditoria FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "logs_auditoria_insert" ON public.logs_auditoria FOR INSERT WITH CHECK (true);

-- =====================================================
-- DADOS INICIAIS
-- =====================================================

-- Categorias padrão
INSERT INTO public.categorias_pagamento (nome, tipo, descricao) VALUES
  ('Dízimo Mensal', 'dizimo', 'Contribuição mensal do dizimista'),
  ('Oferta Espontânea', 'oferta', 'Oferta voluntária do paroquiano'),
  ('Reforma da Igreja', 'campanha', 'Contribuição para obras e reformas'),
  ('Festa da Paróquia', 'eventual', 'Contribuição para eventos e festas');

-- Comunidades padrão
INSERT INTO public.comunidades (nome, descricao) VALUES
  ('Comunidade Sede', 'Comunidade principal da paróquia'),
  ('Comunidade São José', 'Capela São José'),
  ('Comunidade Nossa Senhora', 'Capela Nossa Senhora'),
  ('Comunidade Santa Ana', 'Capela Santa Ana');

-- Configuração gateway padrão (modo simulação)
INSERT INTO public.configuracoes_gateway (nome, modo, parcelamento_max, pix_expiracao_minutos)
VALUES ('Laranjinha (Rede Itaú)', 'simulacao', 12, 30);

-- Mensagem padrão de dízimo
INSERT INTO public.mensagens_personalizadas (tipo, titulo, mensagem, versiculo)
VALUES (
  'dizimo',
  'Gratidão pelo Dízimo',
  'Deus abençoe você! Sua fidelidade fortalece a missão da Paróquia Senhor Santo Cristo dos Milagres. Obrigado por contribuir com o dízimo. 🙏✨',
  'Trazei todos os dízimos à casa do tesouro... e provai-me nisto, diz o Senhor dos Exércitos. — Malaquias 3:10'
);

INSERT INTO public.mensagens_personalizadas (tipo, titulo, mensagem, versiculo)
VALUES (
  'oferta',
  'Gratidão pela Oferta',
  'Deus lhe pague! Sua generosidade fortalece a missão da Igreja. Que o Senhor multiplique cada centavo que você ofereceu com amor. 🙏',
  'Cada um dê conforme determinou em seu coração, não com tristeza ou por obrigação, pois Deus ama quem dá com alegria. — 2 Coríntios 9:7'
);
