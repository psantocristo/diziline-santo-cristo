
-- =============================================
-- ÍNDICES DE PERFORMANCE
-- =============================================

-- user_roles: usado em TODA policy RLS via has_role()
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles (user_id, role);

-- pagamentos: consultas frequentes por status, origem, paroquiano, campanha, user, mês
CREATE INDEX IF NOT EXISTS idx_pagamentos_status ON public.pagamentos (status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_origem ON public.pagamentos (origem);
CREATE INDEX IF NOT EXISTS idx_pagamentos_paroquiano_id ON public.pagamentos (paroquiano_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_user_id ON public.pagamentos (user_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_campanha_id ON public.pagamentos (campanha_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_created_at ON public.pagamentos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pagamentos_mes_referencia ON public.pagamentos (mes_referencia);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status_origem ON public.pagamentos (status, origem);

-- paroquianos: busca por CPF, matrícula, status (usados no totem)
CREATE INDEX IF NOT EXISTS idx_paroquianos_cpf ON public.paroquianos (cpf);
CREATE INDEX IF NOT EXISTS idx_paroquianos_matricula ON public.paroquianos (matricula_paroquial);
CREATE INDEX IF NOT EXISTS idx_paroquianos_status ON public.paroquianos (status);
CREATE INDEX IF NOT EXISTS idx_paroquianos_user_id ON public.paroquianos (user_id);
CREATE INDEX IF NOT EXISTS idx_paroquianos_comunidade_id ON public.paroquianos (comunidade_id);

-- comprovantes: join com pagamentos
CREATE INDEX IF NOT EXISTS idx_comprovantes_pagamento_id ON public.comprovantes (pagamento_id);

-- logs_auditoria: consultas por data, ação, usuário
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_created_at ON public.logs_auditoria (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_user_id ON public.logs_auditoria (user_id);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_acao ON public.logs_auditoria (acao);

-- logs_webhook: consultas por evento e pagamento
CREATE INDEX IF NOT EXISTS idx_logs_webhook_pagamento_id ON public.logs_webhook (pagamento_id);
CREATE INDEX IF NOT EXISTS idx_logs_webhook_created_at ON public.logs_webhook (created_at DESC);

-- servos: busca por user_id + ativo
CREATE INDEX IF NOT EXISTS idx_servos_user_id_ativo ON public.servos (user_id, ativo);

-- totens: busca por user_id
CREATE INDEX IF NOT EXISTS idx_totens_user_id ON public.totens (user_id);

-- campanhas: filtro por ativo
CREATE INDEX IF NOT EXISTS idx_campanhas_ativo ON public.campanhas (ativo);

-- mensagens_personalizadas: filtros comuns
CREATE INDEX IF NOT EXISTS idx_mensagens_tipo ON public.mensagens_personalizadas (tipo);
CREATE INDEX IF NOT EXISTS idx_mensagens_campanha_id ON public.mensagens_personalizadas (campanha_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_comunidade_id ON public.mensagens_personalizadas (comunidade_id);
