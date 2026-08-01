-- ============================================================================
-- DízimoSC — Backup completo de schema (idempotente)
-- Gerado automaticamente a partir do banco de produção.
-- Compatível com Supabase Cloud externo (self-hosted ou app.supabase.com).
--
-- COMO USAR:
--   1) Crie um projeto Supabase novo.
--   2) No SQL Editor, cole este arquivo inteiro e execute (Run).
--   3) Pode ser re-executado quantas vezes quiser sem quebrar nada.
--   4) Após rodar, crie um usuário em Authentication → Users e promova-o:
--        UPDATE public.user_roles SET role = 'super_admin' WHERE user_id = '<uuid>';
--   5) Deploy das Edge Functions: `supabase functions deploy`
--
-- INCLUI: enums, tabelas, índices, constraints, funções, triggers,
--         políticas RLS, GRANTs para anon/authenticated/service_role,
--         buckets de storage e policies de storage.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS public;
CREATE EXTENSION IF NOT EXISTS pgcrypto      WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"   WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent      WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm       WITH SCHEMA extensions;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM (
        'super_admin',
        'admin',
        'dizimista',
        'totem'
    );
  END IF;
END $$;


--
-- Name: contribuicao_tipo; Type: TYPE; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contribuicao_tipo') THEN
    CREATE TYPE public.contribuicao_tipo AS ENUM (
        'dizimo',
        'oferta',
        'campanha',
        'eventual'
    );
  END IF;
END $$;


--
-- Name: pagamento_metodo; Type: TYPE; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pagamento_metodo') THEN
    CREATE TYPE public.pagamento_metodo AS ENUM (
        'pix',
        'credito',
        'debito'
    );
  END IF;
END $$;


--
-- Name: pagamento_status; Type: TYPE; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pagamento_status') THEN
    CREATE TYPE public.pagamento_status AS ENUM (
        'criado',
        'aguardando_pagamento',
        'pago',
        'cancelado',
        'expirado',
        'estornado'
    );
  END IF;
END $$;


--
-- Name: paroquiano_status; Type: TYPE; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'paroquiano_status') THEN
    CREATE TYPE public.paroquiano_status AS ENUM (
        'ativo',
        'inativo',
        'suspenso',
        'inadimplente'
    );
  END IF;
END $$;


--
-- Name: avisos_totem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.avisos_totem (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    mensagem text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    cor text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    imagem_url text,
    link_url text
);


--
-- Name: campanhas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.campanhas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    descricao text,
    banner_url text,
    meta_financeira numeric(10,2),
    total_arrecadado numeric(10,2) DEFAULT 0 NOT NULL,
    data_inicio date NOT NULL,
    data_fim date,
    ativo boolean DEFAULT true NOT NULL,
    qrcode_exclusivo text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: categorias_pagamento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.categorias_pagamento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    tipo public.contribuicao_tipo NOT NULL,
    descricao text,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: certificados_emitidos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.certificados_emitidos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo text NOT NULL,
    tamanho text DEFAULT 'A4'::text NOT NULL,
    nome_completo text NOT NULL,
    data_cerimonia date,
    dados jsonb DEFAULT '{}'::jsonb NOT NULL,
    emitido_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: comprovantes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.comprovantes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pagamento_id uuid NOT NULL,
    pdf_url text,
    enviado_whatsapp boolean DEFAULT false,
    whatsapp_enviado_em timestamp with time zone,
    "versículo" text,
    mensagem_pastoral text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: comunidades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.comunidades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    descricao text,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: configuracoes_gateway; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.configuracoes_gateway (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text DEFAULT 'Laranjinha (Rede Itaú)'::text NOT NULL,
    modo text DEFAULT 'simulacao'::text NOT NULL,
    merchant_id text,
    webhook_secret text,
    parcelamento_max integer DEFAULT 12,
    parcelamento_juros numeric(5,4) DEFAULT 0.0199,
    pix_expiracao_minutos integer DEFAULT 30,
    ativo boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    client_id text,
    client_secret text,
    webhook_url text,
    sandbox_url text DEFAULT 'https://sandbox-erede.useredecloud.com.br'::text,
    producao_url text DEFAULT 'https://api.userede.com.br/erede'::text,
    oauth_url_sandbox text DEFAULT 'https://rl7-sandbox-api.useredecloud.com.br/oauth2/token'::text,
    oauth_url_producao text DEFAULT 'https://api.userede.com.br/redelabs/oauth2/token'::text,
    pix_ativo boolean DEFAULT true NOT NULL,
    credito_ativo boolean DEFAULT true NOT NULL,
    debito_ativo boolean DEFAULT true NOT NULL,
    provedor text DEFAULT 'rede'::text NOT NULL,
    api_key text,
    api_key_secret_name text,
    extra_config jsonb DEFAULT '{}'::jsonb,
    provedor_fallback text,
    webhook_hmac_obrigatorio boolean DEFAULT true NOT NULL,
    CONSTRAINT configuracoes_gateway_provedor_check CHECK ((provedor = ANY (ARRAY['rede'::text, 'sicredi'::text, 'pagarme'::text])))
);


--
-- Name: configuracoes_paroquia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.configuracoes_paroquia (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text,
    cnpj text,
    telefone text,
    endereco text,
    site text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pin_totem text,
    chave_pix text,
    logo_url text,
    cor_primaria text DEFAULT '40 55% 54%'::text,
    cor_secundaria text DEFAULT '350 60% 28%'::text,
    slogan text,
    logo_termico_url text,
    cadastro_aberto boolean DEFAULT true NOT NULL,
    resend_api_key text,
    resend_from_email text,
    email_agradecimento_ativo boolean DEFAULT false NOT NULL,
    cor_acento text DEFAULT '40 75% 50%'::text,
    cor_fonte text DEFAULT '350 40% 12%'::text,
    tamanho_fonte text DEFAULT 'medio'::text,
    loja_ativa boolean DEFAULT false NOT NULL
);


--
-- Name: configuracoes_tef; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.configuracoes_tef (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    middleware_url text DEFAULT ''::text NOT NULL,
    middleware_token text DEFAULT ''::text,
    terminal_id text DEFAULT ''::text,
    ativo boolean DEFAULT false,
    ultimo_teste timestamp with time zone,
    status_conexao text DEFAULT 'desconectado'::text,
    modo text DEFAULT 'simulacao'::text,
    timeout_segundos integer DEFAULT 60,
    updated_at timestamp with time zone DEFAULT now(),
    credito_ativo boolean DEFAULT true NOT NULL,
    debito_ativo boolean DEFAULT true NOT NULL,
    provedor_tef text DEFAULT 'connect_tef'::text NOT NULL,
    extra_config jsonb DEFAULT '{}'::jsonb,
    middleware_urls jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT configuracoes_tef_provedor_tef_check CHECK ((provedor_tef = ANY (ARRAY['connect_tef'::text, 'sipag'::text, 'pagarme_stone'::text, 'paygo'::text])))
);


--
-- Name: edge_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
    bucket text NOT NULL,
    key text NOT NULL,
    hits integer DEFAULT 0 NOT NULL,
    window_start timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: itens_pedido; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.itens_pedido (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pedido_id uuid NOT NULL,
    produto_id uuid NOT NULL,
    quantidade integer NOT NULL,
    preco_unitario numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT itens_pedido_preco_unitario_check CHECK ((preco_unitario >= (0)::numeric)),
    CONSTRAINT itens_pedido_quantidade_check CHECK ((quantidade > 0))
);


--
-- Name: logs_auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.logs_auditoria (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    acao text NOT NULL,
    entidade text,
    entidade_id uuid,
    detalhes jsonb,
    ip text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: logs_terminal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.logs_terminal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tipo text DEFAULT 'info'::text NOT NULL,
    origem text DEFAULT 'sistema'::text NOT NULL,
    mensagem text NOT NULL,
    detalhes text,
    return_code text,
    pagamento_id uuid,
    CONSTRAINT logs_terminal_tipo_check CHECK ((tipo = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'error'::text])))
);


--
-- Name: logs_webhook; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.logs_webhook (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pagamento_id uuid,
    evento text NOT NULL,
    payload jsonb,
    assinatura text,
    status_processamento text DEFAULT 'recebido'::text,
    erro text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: membros_familia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.membros_familia (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    paroquiano_id uuid NOT NULL,
    nome text NOT NULL,
    parentesco text NOT NULL,
    data_nascimento date,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mensagens_personalizadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.mensagens_personalizadas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo public.contribuicao_tipo,
    campanha_id uuid,
    comunidade_id uuid,
    titulo text NOT NULL,
    mensagem text NOT NULL,
    versiculo text,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notificacoes_admin; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.notificacoes_admin (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo text NOT NULL,
    titulo text NOT NULL,
    mensagem text NOT NULL,
    dados jsonb DEFAULT '{}'::jsonb,
    lida boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pagamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.pagamentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    paroquiano_id uuid,
    user_id uuid,
    campanha_id uuid,
    categoria_id uuid,
    tipo public.contribuicao_tipo NOT NULL,
    valor numeric(10,2) NOT NULL,
    metodo public.pagamento_metodo NOT NULL,
    status public.pagamento_status DEFAULT 'criado'::public.pagamento_status NOT NULL,
    parcelas integer DEFAULT 1,
    gateway_id text,
    gateway_status text,
    gateway_payload jsonb,
    pix_copia_cola text,
    pix_qrcode text,
    pix_expiracao timestamp with time zone,
    codigo_autenticacao text DEFAULT encode(extensions.gen_random_bytes(8), 'hex'::text),
    comprovante_url text,
    pago_em timestamp with time zone,
    expirado_em timestamp with time zone,
    cancelado_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    origem text DEFAULT 'web'::text,
    nome_contribuinte text,
    descricao text,
    mes_referencia date,
    provedor text,
    idempotency_key text
);


--
-- Name: paroquianos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.paroquianos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    nome_completo text NOT NULL,
    cpf text,
    telefone text,
    email text,
    endereco text,
    cidade text,
    estado text,
    cep text,
    data_nascimento date,
    matricula_paroquial text,
    comunidade_id uuid,
    status public.paroquiano_status DEFAULT 'ativo'::public.paroquiano_status NOT NULL,
    data_inicio_dizimista date,
    valor_sugerido numeric(10,2),
    observacoes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    estado_civil text
);


--
-- Name: pedidos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.pedidos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_retirada text DEFAULT ('PED-'::text || upper(substr(md5((random())::text), 1, 6))) NOT NULL,
    paroquiano_id uuid,
    user_id uuid,
    nome_cliente text,
    origem text DEFAULT 'web'::text NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    total numeric NOT NULL,
    retirado_em timestamp with time zone,
    cancelado_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pedidos_origem_check CHECK ((origem = ANY (ARRAY['web'::text, 'totem'::text]))),
    CONSTRAINT pedidos_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'retirado'::text, 'cancelado'::text]))),
    CONSTRAINT pedidos_total_check CHECK ((total > (0)::numeric))
);


--
-- Name: produtos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.produtos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    descricao text,
    preco numeric NOT NULL,
    estoque integer DEFAULT 0 NOT NULL,
    slug text NOT NULL,
    imagem_url text,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT produtos_preco_check CHECK ((preco > (0)::numeric))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL,
    nome_completo text NOT NULL,
    email text,
    telefone text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: servos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.servos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    nome text NOT NULL,
    cpf text,
    ativo boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    comunidade_id uuid
);


--
-- Name: tokens_client; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.tokens_client (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    token text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    ultimo_uso timestamp with time zone,
    ip_ultimo_uso text
);


--
-- Name: totens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.totens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    cor text DEFAULT '#7B1C2A'::text NOT NULL,
    user_id uuid,
    ativo boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pix_ativo boolean DEFAULT true NOT NULL,
    credito_ativo boolean DEFAULT true NOT NULL,
    debito_ativo boolean DEFAULT true NOT NULL,
    tef_ativo boolean DEFAULT false NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: avisos_totem avisos_totem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'avisos_totem_pkey') THEN
    ALTER TABLE ONLY public.avisos_totem
        ADD CONSTRAINT avisos_totem_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: campanhas campanhas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campanhas_pkey') THEN
    ALTER TABLE ONLY public.campanhas
        ADD CONSTRAINT campanhas_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: categorias_pagamento categorias_pagamento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categorias_pagamento_pkey') THEN
    ALTER TABLE ONLY public.categorias_pagamento
        ADD CONSTRAINT categorias_pagamento_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: certificados_emitidos certificados_emitidos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'certificados_emitidos_pkey') THEN
    ALTER TABLE ONLY public.certificados_emitidos
        ADD CONSTRAINT certificados_emitidos_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: comprovantes comprovantes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comprovantes_pkey') THEN
    ALTER TABLE ONLY public.comprovantes
        ADD CONSTRAINT comprovantes_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: comunidades comunidades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comunidades_pkey') THEN
    ALTER TABLE ONLY public.comunidades
        ADD CONSTRAINT comunidades_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: configuracoes_gateway configuracoes_gateway_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'configuracoes_gateway_pkey') THEN
    ALTER TABLE ONLY public.configuracoes_gateway
        ADD CONSTRAINT configuracoes_gateway_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: configuracoes_paroquia configuracoes_paroquia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'configuracoes_paroquia_pkey') THEN
    ALTER TABLE ONLY public.configuracoes_paroquia
        ADD CONSTRAINT configuracoes_paroquia_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: configuracoes_tef configuracoes_tef_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'configuracoes_tef_pkey') THEN
    ALTER TABLE ONLY public.configuracoes_tef
        ADD CONSTRAINT configuracoes_tef_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: edge_rate_limits edge_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'edge_rate_limits_pkey') THEN
    ALTER TABLE ONLY public.edge_rate_limits
        ADD CONSTRAINT edge_rate_limits_pkey PRIMARY KEY (bucket, key);
  END IF;
END $$;


--
-- Name: itens_pedido itens_pedido_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'itens_pedido_pkey') THEN
    ALTER TABLE ONLY public.itens_pedido
        ADD CONSTRAINT itens_pedido_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: logs_auditoria logs_auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'logs_auditoria_pkey') THEN
    ALTER TABLE ONLY public.logs_auditoria
        ADD CONSTRAINT logs_auditoria_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: logs_terminal logs_terminal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'logs_terminal_pkey') THEN
    ALTER TABLE ONLY public.logs_terminal
        ADD CONSTRAINT logs_terminal_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: logs_webhook logs_webhook_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'logs_webhook_pkey') THEN
    ALTER TABLE ONLY public.logs_webhook
        ADD CONSTRAINT logs_webhook_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: membros_familia membros_familia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membros_familia_pkey') THEN
    ALTER TABLE ONLY public.membros_familia
        ADD CONSTRAINT membros_familia_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: mensagens_personalizadas mensagens_personalizadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mensagens_personalizadas_pkey') THEN
    ALTER TABLE ONLY public.mensagens_personalizadas
        ADD CONSTRAINT mensagens_personalizadas_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: notificacoes_admin notificacoes_admin_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notificacoes_admin_pkey') THEN
    ALTER TABLE ONLY public.notificacoes_admin
        ADD CONSTRAINT notificacoes_admin_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: pagamentos pagamentos_codigo_autenticacao_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagamentos_codigo_autenticacao_key') THEN
    ALTER TABLE ONLY public.pagamentos
        ADD CONSTRAINT pagamentos_codigo_autenticacao_key UNIQUE (codigo_autenticacao);
  END IF;
END $$;


--
-- Name: pagamentos pagamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagamentos_pkey') THEN
    ALTER TABLE ONLY public.pagamentos
        ADD CONSTRAINT pagamentos_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: paroquianos paroquianos_matricula_paroquial_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'paroquianos_matricula_paroquial_key') THEN
    ALTER TABLE ONLY public.paroquianos
        ADD CONSTRAINT paroquianos_matricula_paroquial_key UNIQUE (matricula_paroquial);
  END IF;
END $$;


--
-- Name: paroquianos paroquianos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'paroquianos_pkey') THEN
    ALTER TABLE ONLY public.paroquianos
        ADD CONSTRAINT paroquianos_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: pedidos pedidos_codigo_retirada_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_codigo_retirada_key') THEN
    ALTER TABLE ONLY public.pedidos
        ADD CONSTRAINT pedidos_codigo_retirada_key UNIQUE (codigo_retirada);
  END IF;
END $$;


--
-- Name: pedidos pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_pkey') THEN
    ALTER TABLE ONLY public.pedidos
        ADD CONSTRAINT pedidos_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: produtos produtos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'produtos_pkey') THEN
    ALTER TABLE ONLY public.produtos
        ADD CONSTRAINT produtos_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: produtos produtos_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'produtos_slug_key') THEN
    ALTER TABLE ONLY public.produtos
        ADD CONSTRAINT produtos_slug_key UNIQUE (slug);
  END IF;
END $$;


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_pkey') THEN
    ALTER TABLE ONLY public.profiles
        ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: servos servos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'servos_pkey') THEN
    ALTER TABLE ONLY public.servos
        ADD CONSTRAINT servos_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: servos servos_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'servos_user_id_key') THEN
    ALTER TABLE ONLY public.servos
        ADD CONSTRAINT servos_user_id_key UNIQUE (user_id);
  END IF;
END $$;


--
-- Name: tokens_client tokens_client_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tokens_client_pkey') THEN
    ALTER TABLE ONLY public.tokens_client
        ADD CONSTRAINT tokens_client_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: tokens_client tokens_client_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tokens_client_token_key') THEN
    ALTER TABLE ONLY public.tokens_client
        ADD CONSTRAINT tokens_client_token_key UNIQUE (token);
  END IF;
END $$;


--
-- Name: totens totens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'totens_pkey') THEN
    ALTER TABLE ONLY public.totens
        ADD CONSTRAINT totens_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_pkey') THEN
    ALTER TABLE ONLY public.user_roles
        ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_role_key') THEN
    ALTER TABLE ONLY public.user_roles
        ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;


--
-- Name: idx_campanhas_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_campanhas_ativo ON public.campanhas USING btree (ativo);


--
-- Name: idx_comprovantes_pagamento_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_comprovantes_pagamento_id ON public.comprovantes USING btree (pagamento_id);


--
-- Name: idx_edge_rate_limits_window; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_edge_rate_limits_window ON public.edge_rate_limits USING btree (window_start);


--
-- Name: idx_logs_auditoria_acao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_logs_auditoria_acao ON public.logs_auditoria USING btree (acao);


--
-- Name: idx_logs_auditoria_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_logs_auditoria_created_at ON public.logs_auditoria USING btree (created_at DESC);


--
-- Name: idx_logs_auditoria_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_logs_auditoria_user_id ON public.logs_auditoria USING btree (user_id);


--
-- Name: idx_logs_terminal_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_logs_terminal_created_at ON public.logs_terminal USING btree (created_at DESC);


--
-- Name: idx_logs_terminal_origem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_logs_terminal_origem ON public.logs_terminal USING btree (origem);


--
-- Name: idx_logs_terminal_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_logs_terminal_tipo ON public.logs_terminal USING btree (tipo);


--
-- Name: idx_logs_webhook_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_logs_webhook_created_at ON public.logs_webhook USING btree (created_at DESC);


--
-- Name: idx_logs_webhook_pagamento_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_logs_webhook_pagamento_id ON public.logs_webhook USING btree (pagamento_id);


--
-- Name: idx_mensagens_campanha_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_mensagens_campanha_id ON public.mensagens_personalizadas USING btree (campanha_id);


--
-- Name: idx_mensagens_comunidade_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_mensagens_comunidade_id ON public.mensagens_personalizadas USING btree (comunidade_id);


--
-- Name: idx_mensagens_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_mensagens_tipo ON public.mensagens_personalizadas USING btree (tipo);


--
-- Name: idx_pagamentos_campanha_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_pagamentos_campanha_id ON public.pagamentos USING btree (campanha_id);


--
-- Name: idx_pagamentos_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_pagamentos_created_at ON public.pagamentos USING btree (created_at DESC);


--
-- Name: idx_pagamentos_idempotency_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS idx_pagamentos_idempotency_key_unique ON public.pagamentos USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: idx_pagamentos_mes_referencia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_pagamentos_mes_referencia ON public.pagamentos USING btree (mes_referencia);


--
-- Name: idx_pagamentos_origem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_pagamentos_origem ON public.pagamentos USING btree (origem);


--
-- Name: idx_pagamentos_paroquiano_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_pagamentos_paroquiano_id ON public.pagamentos USING btree (paroquiano_id);


--
-- Name: idx_pagamentos_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_pagamentos_status ON public.pagamentos USING btree (status);


--
-- Name: idx_pagamentos_status_origem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_pagamentos_status_origem ON public.pagamentos USING btree (status, origem);


--
-- Name: idx_pagamentos_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_pagamentos_user_id ON public.pagamentos USING btree (user_id);


--
-- Name: idx_paroquianos_comunidade_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_paroquianos_comunidade_id ON public.paroquianos USING btree (comunidade_id);


--
-- Name: idx_paroquianos_cpf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_paroquianos_cpf ON public.paroquianos USING btree (cpf);


--
-- Name: idx_paroquianos_matricula; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_paroquianos_matricula ON public.paroquianos USING btree (matricula_paroquial);


--
-- Name: idx_paroquianos_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_paroquianos_status ON public.paroquianos USING btree (status);


--
-- Name: idx_paroquianos_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_paroquianos_user_id ON public.paroquianos USING btree (user_id);


--
-- Name: idx_servos_user_id_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_servos_user_id_ativo ON public.servos USING btree (user_id, ativo);


--
-- Name: idx_totens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_totens_user_id ON public.totens USING btree (user_id);


--
-- Name: idx_user_roles_user_id_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles USING btree (user_id, role);


--
--
-- Name: abater_estoque_pedido(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.abater_estoque_pedido() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.produtos
  SET estoque = estoque - NEW.quantidade
  WHERE id = NEW.produto_id AND estoque >= NEW.quantidade;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estoque insuficiente para o produto %', NEW.produto_id;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: gerar_matricula_paroquial(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.gerar_matricula_paroquial() RETURNS text
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 'DIZSC-' || lpad(
    (COALESCE(
      MAX(NULLIF(regexp_replace(matricula_paroquial, '^DIZSC-', ''), '')::int),
      0
    ) + 1)::text, 5, '0'
  )
  FROM public.paroquianos
  WHERE matricula_paroquial LIKE 'DIZSC-%'
$$;


--
-- Name: gerar_slug_produto(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.gerar_slug_produto() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  -- Gerar slug base: lowercase, sem acentos, hifens
  base_slug := lower(unaccent(NEW.nome));
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := regexp_replace(base_slug, '^-|-$', '', 'g');

  final_slug := base_slug;

  -- Verificar unicidade
  WHILE EXISTS (SELECT 1 FROM public.produtos WHERE slug = final_slug AND id IS DISTINCT FROM NEW.id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  NEW.slug := final_slug;
  RETURN NEW;
END;
$_$;


--
-- Name: get_dashboard_resumo(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_dashboard_resumo(_comunidade_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
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


--
-- Name: get_gateway_metrics(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_gateway_metrics(_dias integer DEFAULT 30) RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: get_loja_config(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_loja_config() RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT json_build_object('loja_ativa', loja_ativa)
  FROM public.configuracoes_paroquia
  LIMIT 1;
$$;


--
-- Name: get_meses_dizimista(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_meses_dizimista(_paroquiano_id uuid, _ano integer) RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
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


--
-- Name: get_servo_comunidade(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_servo_comunidade(_user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT comunidade_id FROM public.servos
  WHERE user_id = _user_id AND ativo = true
  LIMIT 1;
$$;


--
-- Name: get_tema_paroquia(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_tema_paroquia() RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT json_build_object(
    'nome',             nome,
    'cnpj',             cnpj,
    'logo_url',         logo_url,
    'logo_termico_url', logo_termico_url,
    'cor_primaria',     cor_primaria,
    'cor_secundaria',   cor_secundaria,
    'cor_acento',       cor_acento,
    'cor_fonte',        cor_fonte,
    'tamanho_fonte',    tamanho_fonte,
    'slogan',           slogan,
    'cadastro_aberto',  cadastro_aberto,
    'site',             site
  )
  FROM public.configuracoes_paroquia
  LIMIT 1;
$$;


--
-- Name: get_user_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid) RETURNS public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'super_admin' THEN 1 
      WHEN 'admin' THEN 2 
      WHEN 'dizimista' THEN 3
      WHEN 'totem' THEN 4
    END
  LIMIT 1
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_completo, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.email),
    NEW.email
  );
  
  -- Atribuir role dizimista por padrão
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'dizimista');
  
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


--
-- Name: log_pagamento_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.log_pagamento_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  _tipo text := 'info';
  _msg text;
  _det text;
  _rc text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _msg := 'Nova transação — ' || UPPER(COALESCE(NEW.metodo::text, '?')) || ' R$ ' || to_char(NEW.valor, 'FM999G999D00');
    _det := 'ID: ' || left(NEW.id::text, 8) || '… | Status: ' || NEW.status || ' | Tipo: ' || NEW.tipo;
    INSERT INTO public.logs_terminal (tipo, origem, mensagem, detalhes, pagamento_id)
    VALUES ('info', COALESCE(NEW.origem, 'sistema'), _msg, _det, NEW.id);
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    _rc := (NEW.gateway_payload->>'returnCode');
    IF NEW.status = 'pago' THEN
      _tipo := 'success';
      _msg := '✅ APROVADO — ' || UPPER(COALESCE(NEW.metodo::text, '?')) || ' R$ ' || to_char(NEW.valor, 'FM999G999D00');
      _det := 'Gateway: ' || COALESCE(NEW.gateway_status, '-') || ' | ID: ' || left(NEW.id::text, 8) || '…';
      IF NEW.gateway_id IS NOT NULL THEN _det := _det || ' | TID: ' || NEW.gateway_id; END IF;
    ELSIF NEW.status = 'cancelado' THEN
      _tipo := 'error';
      _msg := '❌ RECUSADO — ' || UPPER(COALESCE(NEW.metodo::text, '?')) || ' R$ ' || to_char(NEW.valor, 'FM999G999D00');
      _det := 'Motivo: ' || COALESCE(NEW.gateway_status, 'Não informado');
    ELSIF NEW.status = 'expirado' THEN
      _tipo := 'warning';
      _msg := '⏰ EXPIRADO — ' || UPPER(COALESCE(NEW.metodo::text, '?')) || ' R$ ' || to_char(NEW.valor, 'FM999G999D00');
      _det := 'ID: ' || left(NEW.id::text, 8) || '…';
    ELSIF NEW.status = 'aguardando_pagamento' AND OLD.status = 'criado' THEN
      _msg := '⏳ Aguardando pagamento — ' || UPPER(COALESCE(NEW.metodo::text, '?')) || ' R$ ' || to_char(NEW.valor, 'FM999G999D00');
      _det := 'ID: ' || left(NEW.id::text, 8) || '…';
      IF NEW.gateway_id IS NOT NULL THEN _det := _det || ' | Gateway ID: ' || NEW.gateway_id; END IF;
    ELSE
      _msg := 'Status alterado: ' || COALESCE(OLD.status::text, '?') || ' → ' || NEW.status;
      _det := 'ID: ' || left(NEW.id::text, 8) || '… | ' || UPPER(COALESCE(NEW.metodo::text, '?')) || ' R$ ' || to_char(NEW.valor, 'FM999G999D00');
    END IF;

    INSERT INTO public.logs_terminal (tipo, origem, mensagem, detalhes, return_code, pagamento_id)
    VALUES (_tipo, COALESCE(NEW.origem, 'sistema'), _msg, _det, _rc, NEW.id);
  ELSIF OLD.gateway_status IS DISTINCT FROM NEW.gateway_status AND NEW.gateway_status IS NOT NULL THEN
    _msg := 'Gateway: ' || NEW.gateway_status;
    _det := 'ID: ' || left(NEW.id::text, 8) || '… | ' || UPPER(COALESCE(NEW.metodo::text, '?'));
    INSERT INTO public.logs_terminal (tipo, origem, mensagem, detalhes, pagamento_id)
    VALUES ('info', COALESCE(NEW.origem, 'sistema'), _msg, _det, NEW.id);
  END IF;

  RETURN NEW;
END;
$_$;


--
-- Name: log_webhook_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.log_webhook_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.logs_terminal (tipo, origem, mensagem, detalhes, pagamento_id)
  VALUES (
    CASE WHEN NEW.erro IS NOT NULL THEN 'error' ELSE 'info' END,
    'webhook',
    'Webhook: ' || NEW.evento || CASE WHEN NEW.erro IS NOT NULL THEN ' — ERRO: ' || NEW.erro ELSE '' END,
    'Status: ' || COALESCE(NEW.status_processamento, '-') || CASE WHEN NEW.pagamento_id IS NOT NULL THEN ' | Pagamento: ' || left(NEW.pagamento_id::text, 8) || '…' ELSE '' END,
    NEW.pagamento_id
  );
  RETURN NEW;
END;
$$;


--
-- Name: notify_pagamento(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.notify_pagamento() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  _nome text;
  _metodo text;
  _valor text;
BEGIN
  -- Only notify when payment becomes 'pago'
  IF NEW.status = 'pago' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pago') THEN
    -- Get contributor name
    _nome := COALESCE(NEW.nome_contribuinte, 'Anônimo');
    IF NEW.paroquiano_id IS NOT NULL THEN
      SELECT nome_completo INTO _nome FROM public.paroquianos WHERE id = NEW.paroquiano_id;
    END IF;
    
    _metodo := UPPER(COALESCE(NEW.metodo::text, '?'));
    _valor := 'R$ ' || to_char(NEW.valor, 'FM999G999D00');
    
    INSERT INTO public.notificacoes_admin (tipo, titulo, mensagem, dados)
    VALUES (
      'novo_pagamento',
      'Pagamento recebido: ' || _valor,
      _nome || ' — ' || _metodo || ' | ' || COALESCE(NEW.tipo::text, '-'),
      jsonb_build_object('pagamento_id', NEW.id, 'valor', NEW.valor, 'metodo', NEW.metodo, 'tipo', NEW.tipo)
    );
  END IF;
  
  RETURN NEW;
END;
$_$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_campanha_total(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_campanha_total() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: validate_pagamento_origem(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.validate_pagamento_origem() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.origem IS NOT NULL AND NEW.origem NOT IN ('web', 'totem', 'admin', 'kiosk') THEN
    RAISE EXCEPTION 'Origem inválida: %. Valores permitidos: web, totem, admin, kiosk', NEW.origem;
  END IF;
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

-- Name: pagamentos on_pagamento_status_change; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS on_pagamento_status_change ON public.pagamentos;
CREATE TRIGGER on_pagamento_status_change AFTER INSERT OR UPDATE OF status ON public.pagamentos FOR EACH ROW EXECUTE FUNCTION public.update_campanha_total();


--
-- Name: avisos_totem set_avisos_totem_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS set_avisos_totem_updated_at ON public.avisos_totem;
CREATE TRIGGER set_avisos_totem_updated_at BEFORE UPDATE ON public.avisos_totem FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: pedidos set_pedidos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS set_pedidos_updated_at ON public.pedidos;
CREATE TRIGGER set_pedidos_updated_at BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: produtos set_produtos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS set_produtos_updated_at ON public.produtos;
CREATE TRIGGER set_produtos_updated_at BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: configuracoes_tef set_updated_at_configuracoes_tef; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS set_updated_at_configuracoes_tef ON public.configuracoes_tef;
CREATE TRIGGER set_updated_at_configuracoes_tef BEFORE UPDATE ON public.configuracoes_tef FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: itens_pedido trg_abater_estoque; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS trg_abater_estoque ON public.itens_pedido;
CREATE TRIGGER trg_abater_estoque AFTER INSERT ON public.itens_pedido FOR EACH ROW EXECUTE FUNCTION public.abater_estoque_pedido();


--
-- Name: produtos trg_gerar_slug_produto; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS trg_gerar_slug_produto ON public.produtos;
CREATE TRIGGER trg_gerar_slug_produto BEFORE INSERT OR UPDATE OF nome ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.gerar_slug_produto();


--
-- Name: pagamentos trg_log_pagamento; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS trg_log_pagamento ON public.pagamentos;
CREATE TRIGGER trg_log_pagamento AFTER INSERT OR UPDATE ON public.pagamentos FOR EACH ROW EXECUTE FUNCTION public.log_pagamento_change();


--
-- Name: logs_webhook trg_log_webhook; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS trg_log_webhook ON public.logs_webhook;
CREATE TRIGGER trg_log_webhook AFTER INSERT ON public.logs_webhook FOR EACH ROW EXECUTE FUNCTION public.log_webhook_change();


--
-- Name: pagamentos trg_notify_pagamento; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS trg_notify_pagamento ON public.pagamentos;
CREATE TRIGGER trg_notify_pagamento AFTER INSERT OR UPDATE ON public.pagamentos FOR EACH ROW EXECUTE FUNCTION public.notify_pagamento();


--
-- Name: pagamentos trg_validate_pagamento_origem; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS trg_validate_pagamento_origem ON public.pagamentos;
CREATE TRIGGER trg_validate_pagamento_origem BEFORE INSERT OR UPDATE ON public.pagamentos FOR EACH ROW EXECUTE FUNCTION public.validate_pagamento_origem();


--
-- Name: campanhas update_campanhas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_campanhas_updated_at ON public.campanhas;
CREATE TRIGGER update_campanhas_updated_at BEFORE UPDATE ON public.campanhas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: comunidades update_comunidades_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_comunidades_updated_at ON public.comunidades;
CREATE TRIGGER update_comunidades_updated_at BEFORE UPDATE ON public.comunidades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: configuracoes_paroquia update_configuracoes_paroquia_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_configuracoes_paroquia_updated_at ON public.configuracoes_paroquia;
CREATE TRIGGER update_configuracoes_paroquia_updated_at BEFORE UPDATE ON public.configuracoes_paroquia FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: mensagens_personalizadas update_mensagens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_mensagens_updated_at ON public.mensagens_personalizadas;
CREATE TRIGGER update_mensagens_updated_at BEFORE UPDATE ON public.mensagens_personalizadas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: pagamentos update_pagamentos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_pagamentos_updated_at ON public.pagamentos;
CREATE TRIGGER update_pagamentos_updated_at BEFORE UPDATE ON public.pagamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: paroquianos update_paroquianos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_paroquianos_updated_at ON public.paroquianos;
CREATE TRIGGER update_paroquianos_updated_at BEFORE UPDATE ON public.paroquianos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: servos update_servos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_servos_updated_at ON public.servos;
CREATE TRIGGER update_servos_updated_at BEFORE UPDATE ON public.servos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: totens update_totens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_totens_updated_at ON public.totens;
CREATE TRIGGER update_totens_updated_at BEFORE UPDATE ON public.totens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: campanhas campanhas_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campanhas_created_by_fkey') THEN
    ALTER TABLE ONLY public.campanhas
        ADD CONSTRAINT campanhas_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
  END IF;
END $$;


--
-- Name: certificados_emitidos certificados_emitidos_emitido_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'certificados_emitidos_emitido_por_fkey') THEN
    ALTER TABLE ONLY public.certificados_emitidos
        ADD CONSTRAINT certificados_emitidos_emitido_por_fkey FOREIGN KEY (emitido_por) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;


--
-- Name: comprovantes comprovantes_pagamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comprovantes_pagamento_id_fkey') THEN
    ALTER TABLE ONLY public.comprovantes
        ADD CONSTRAINT comprovantes_pagamento_id_fkey FOREIGN KEY (pagamento_id) REFERENCES public.pagamentos(id) ON DELETE CASCADE;
  END IF;
END $$;


--
-- Name: itens_pedido itens_pedido_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'itens_pedido_pedido_id_fkey') THEN
    ALTER TABLE ONLY public.itens_pedido
        ADD CONSTRAINT itens_pedido_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE CASCADE;
  END IF;
END $$;


--
-- Name: itens_pedido itens_pedido_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'itens_pedido_produto_id_fkey') THEN
    ALTER TABLE ONLY public.itens_pedido
        ADD CONSTRAINT itens_pedido_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id);
  END IF;
END $$;


--
-- Name: logs_auditoria logs_auditoria_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'logs_auditoria_user_id_fkey') THEN
    ALTER TABLE ONLY public.logs_auditoria
        ADD CONSTRAINT logs_auditoria_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;
END $$;


--
-- Name: logs_terminal logs_terminal_pagamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'logs_terminal_pagamento_id_fkey') THEN
    ALTER TABLE ONLY public.logs_terminal
        ADD CONSTRAINT logs_terminal_pagamento_id_fkey FOREIGN KEY (pagamento_id) REFERENCES public.pagamentos(id) ON DELETE SET NULL;
  END IF;
END $$;


--
-- Name: logs_webhook logs_webhook_pagamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'logs_webhook_pagamento_id_fkey') THEN
    ALTER TABLE ONLY public.logs_webhook
        ADD CONSTRAINT logs_webhook_pagamento_id_fkey FOREIGN KEY (pagamento_id) REFERENCES public.pagamentos(id);
  END IF;
END $$;


--
-- Name: membros_familia membros_familia_paroquiano_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membros_familia_paroquiano_id_fkey') THEN
    ALTER TABLE ONLY public.membros_familia
        ADD CONSTRAINT membros_familia_paroquiano_id_fkey FOREIGN KEY (paroquiano_id) REFERENCES public.paroquianos(id) ON DELETE CASCADE;
  END IF;
END $$;


--
-- Name: mensagens_personalizadas mensagens_personalizadas_campanha_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mensagens_personalizadas_campanha_id_fkey') THEN
    ALTER TABLE ONLY public.mensagens_personalizadas
        ADD CONSTRAINT mensagens_personalizadas_campanha_id_fkey FOREIGN KEY (campanha_id) REFERENCES public.campanhas(id);
  END IF;
END $$;


--
-- Name: mensagens_personalizadas mensagens_personalizadas_comunidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mensagens_personalizadas_comunidade_id_fkey') THEN
    ALTER TABLE ONLY public.mensagens_personalizadas
        ADD CONSTRAINT mensagens_personalizadas_comunidade_id_fkey FOREIGN KEY (comunidade_id) REFERENCES public.comunidades(id);
  END IF;
END $$;


--
-- Name: pagamentos pagamentos_campanha_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagamentos_campanha_id_fkey') THEN
    ALTER TABLE ONLY public.pagamentos
        ADD CONSTRAINT pagamentos_campanha_id_fkey FOREIGN KEY (campanha_id) REFERENCES public.campanhas(id);
  END IF;
END $$;


--
-- Name: pagamentos pagamentos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagamentos_categoria_id_fkey') THEN
    ALTER TABLE ONLY public.pagamentos
        ADD CONSTRAINT pagamentos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_pagamento(id);
  END IF;
END $$;


--
-- Name: pagamentos pagamentos_paroquiano_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagamentos_paroquiano_id_fkey') THEN
    ALTER TABLE ONLY public.pagamentos
        ADD CONSTRAINT pagamentos_paroquiano_id_fkey FOREIGN KEY (paroquiano_id) REFERENCES public.paroquianos(id);
  END IF;
END $$;


--
-- Name: pagamentos pagamentos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagamentos_user_id_fkey') THEN
    ALTER TABLE ONLY public.pagamentos
        ADD CONSTRAINT pagamentos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;
END $$;


--
-- Name: paroquianos paroquianos_comunidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'paroquianos_comunidade_id_fkey') THEN
    ALTER TABLE ONLY public.paroquianos
        ADD CONSTRAINT paroquianos_comunidade_id_fkey FOREIGN KEY (comunidade_id) REFERENCES public.comunidades(id);
  END IF;
END $$;


--
-- Name: paroquianos paroquianos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'paroquianos_user_id_fkey') THEN
    ALTER TABLE ONLY public.paroquianos
        ADD CONSTRAINT paroquianos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;


--
-- Name: pedidos pedidos_paroquiano_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_paroquiano_id_fkey') THEN
    ALTER TABLE ONLY public.pedidos
        ADD CONSTRAINT pedidos_paroquiano_id_fkey FOREIGN KEY (paroquiano_id) REFERENCES public.paroquianos(id);
  END IF;
END $$;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_id_fkey') THEN
    ALTER TABLE ONLY public.profiles
        ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;


--
-- Name: servos servos_comunidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'servos_comunidade_id_fkey') THEN
    ALTER TABLE ONLY public.servos
        ADD CONSTRAINT servos_comunidade_id_fkey FOREIGN KEY (comunidade_id) REFERENCES public.comunidades(id) ON DELETE SET NULL;
  END IF;
END $$;


--
-- Name: servos servos_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'servos_created_by_fkey') THEN
    ALTER TABLE ONLY public.servos
        ADD CONSTRAINT servos_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
  END IF;
END $$;


--
-- Name: servos servos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'servos_user_id_fkey') THEN
    ALTER TABLE ONLY public.servos
        ADD CONSTRAINT servos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;


--
-- Name: tokens_client tokens_client_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tokens_client_created_by_fkey') THEN
    ALTER TABLE ONLY public.tokens_client
        ADD CONSTRAINT tokens_client_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;


--
-- Name: totens totens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'totens_user_id_fkey') THEN
    ALTER TABLE ONLY public.totens
        ADD CONSTRAINT totens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_fkey') THEN
    ALTER TABLE ONLY public.user_roles
        ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;


--
-- Name: avisos_totem; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.avisos_totem ENABLE ROW LEVEL SECURITY;

--
-- Name: avisos_totem avisos_totem_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY avisos_totem_delete_admin ON public.avisos_totem FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: avisos_totem avisos_totem_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY avisos_totem_insert_admin ON public.avisos_totem FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: avisos_totem avisos_totem_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY avisos_totem_select_public ON public.avisos_totem FOR SELECT USING (true);


--
-- Name: avisos_totem avisos_totem_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY avisos_totem_update_admin ON public.avisos_totem FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: campanhas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;

--
-- Name: campanhas campanhas_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campanhas_delete_admin ON public.campanhas FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: campanhas campanhas_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campanhas_insert_admin ON public.campanhas FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: campanhas campanhas_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campanhas_select ON public.campanhas FOR SELECT TO authenticated USING (true);


--
-- Name: campanhas campanhas_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campanhas_select_public ON public.campanhas FOR SELECT USING ((ativo = true));


--
-- Name: campanhas campanhas_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY campanhas_update_admin ON public.campanhas FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: categorias_pagamento categorias_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categorias_insert_admin ON public.categorias_pagamento FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: categorias_pagamento; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categorias_pagamento ENABLE ROW LEVEL SECURITY;

--
-- Name: categorias_pagamento categorias_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categorias_select ON public.categorias_pagamento FOR SELECT TO authenticated USING (true);


--
-- Name: categorias_pagamento categorias_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categorias_update_admin ON public.categorias_pagamento FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: certificados_emitidos certificados_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY certificados_delete_admin ON public.certificados_emitidos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: certificados_emitidos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.certificados_emitidos ENABLE ROW LEVEL SECURITY;

--
-- Name: certificados_emitidos certificados_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY certificados_insert_admin ON public.certificados_emitidos FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: certificados_emitidos certificados_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY certificados_select_admin ON public.certificados_emitidos FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: comprovantes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comprovantes ENABLE ROW LEVEL SECURITY;

--
-- Name: comprovantes comprovantes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comprovantes_insert ON public.comprovantes FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: comprovantes comprovantes_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comprovantes_select_admin ON public.comprovantes FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: comprovantes comprovantes_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comprovantes_select_own ON public.comprovantes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.pagamentos p
  WHERE ((p.id = comprovantes.pagamento_id) AND (p.user_id = auth.uid())))));


--
-- Name: comunidades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comunidades ENABLE ROW LEVEL SECURITY;

--
-- Name: comunidades comunidades_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidades_delete_admin ON public.comunidades FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: comunidades comunidades_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidades_insert_admin ON public.comunidades FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: comunidades comunidades_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidades_select ON public.comunidades FOR SELECT TO authenticated USING (true);


--
-- Name: comunidades comunidades_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comunidades_update_admin ON public.comunidades FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: configuracoes_gateway config_gateway_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY config_gateway_all ON public.configuracoes_gateway USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: configuracoes_gateway config_gateway_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY config_gateway_select ON public.configuracoes_gateway FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: configuracoes_gateway; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.configuracoes_gateway ENABLE ROW LEVEL SECURITY;

--
-- Name: configuracoes_paroquia; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.configuracoes_paroquia ENABLE ROW LEVEL SECURITY;

--
-- Name: configuracoes_tef; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.configuracoes_tef ENABLE ROW LEVEL SECURITY;

--
-- Name: edge_rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: itens_pedido; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;

--
-- Name: itens_pedido itens_pedido_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY itens_pedido_insert ON public.itens_pedido FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.pedidos
  WHERE ((pedidos.id = itens_pedido.pedido_id) AND ((pedidos.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'totem'::public.app_role) OR public.has_role(auth.uid(), 'dizimista'::public.app_role))))));


--
-- Name: itens_pedido itens_pedido_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY itens_pedido_select_admin ON public.itens_pedido FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: itens_pedido itens_pedido_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY itens_pedido_select_own ON public.itens_pedido FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.pedidos
  WHERE ((pedidos.id = itens_pedido.pedido_id) AND (pedidos.user_id = auth.uid())))));


--
-- Name: logs_auditoria; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;

--
-- Name: logs_auditoria logs_auditoria_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY logs_auditoria_insert ON public.logs_auditoria FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: logs_auditoria logs_auditoria_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY logs_auditoria_select ON public.logs_auditoria FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: logs_terminal; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.logs_terminal ENABLE ROW LEVEL SECURITY;

--
-- Name: logs_terminal logs_terminal_insert_system; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY logs_terminal_insert_system ON public.logs_terminal FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: logs_terminal logs_terminal_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY logs_terminal_select_admin ON public.logs_terminal FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: logs_webhook; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.logs_webhook ENABLE ROW LEVEL SECURITY;

--
-- Name: logs_webhook logs_webhook_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY logs_webhook_insert ON public.logs_webhook FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) OR true));


--
-- Name: logs_webhook logs_webhook_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY logs_webhook_select ON public.logs_webhook FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: membros_familia; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.membros_familia ENABLE ROW LEVEL SECURITY;

--
-- Name: membros_familia membros_familia_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY membros_familia_delete_admin ON public.membros_familia FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: membros_familia membros_familia_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY membros_familia_insert_own ON public.membros_familia FOR INSERT TO authenticated WITH CHECK (((paroquiano_id IN ( SELECT paroquianos.id
   FROM public.paroquianos
  WHERE (paroquianos.user_id = auth.uid()))) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: membros_familia membros_familia_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY membros_familia_select_admin ON public.membros_familia FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: membros_familia membros_familia_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY membros_familia_select_own ON public.membros_familia FOR SELECT TO authenticated USING ((paroquiano_id IN ( SELECT paroquianos.id
   FROM public.paroquianos
  WHERE (paroquianos.user_id = auth.uid()))));


--
-- Name: membros_familia membros_familia_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY membros_familia_update ON public.membros_familia FOR UPDATE TO authenticated USING (((paroquiano_id IN ( SELECT paroquianos.id
   FROM public.paroquianos
  WHERE (paroquianos.user_id = auth.uid()))) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: mensagens_personalizadas mensagens_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mensagens_delete_admin ON public.mensagens_personalizadas FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: mensagens_personalizadas mensagens_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mensagens_insert_admin ON public.mensagens_personalizadas FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: mensagens_personalizadas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mensagens_personalizadas ENABLE ROW LEVEL SECURITY;

--
-- Name: mensagens_personalizadas mensagens_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mensagens_select ON public.mensagens_personalizadas FOR SELECT TO authenticated USING ((ativo = true));


--
-- Name: mensagens_personalizadas mensagens_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mensagens_update_admin ON public.mensagens_personalizadas FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: notificacoes_admin; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notificacoes_admin ENABLE ROW LEVEL SECURITY;

--
-- Name: notificacoes_admin notificacoes_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notificacoes_delete_admin ON public.notificacoes_admin FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: notificacoes_admin notificacoes_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notificacoes_insert_admin ON public.notificacoes_admin FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: notificacoes_admin notificacoes_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notificacoes_select_admin ON public.notificacoes_admin FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: notificacoes_admin notificacoes_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notificacoes_update_admin ON public.notificacoes_admin FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: pagamentos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

--
-- Name: pagamentos pagamentos_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pagamentos_insert ON public.pagamentos FOR INSERT WITH CHECK (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'totem'::public.app_role) OR public.has_role(auth.uid(), 'dizimista'::public.app_role) OR ((origem = 'totem'::text) AND (user_id IS NULL))));


--
-- Name: pagamentos pagamentos_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pagamentos_select_admin ON public.pagamentos FOR SELECT USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (public.has_role(auth.uid(), 'admin'::public.app_role) AND ((public.get_servo_comunidade(auth.uid()) IS NULL) OR (paroquiano_id IN ( SELECT paroquianos.id
   FROM public.paroquianos
  WHERE (paroquianos.comunidade_id = public.get_servo_comunidade(auth.uid())))) OR (paroquiano_id IS NULL)))));


--
-- Name: pagamentos pagamentos_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pagamentos_select_own ON public.pagamentos FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: pagamentos pagamentos_select_own_paroquiano; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pagamentos_select_own_paroquiano ON public.pagamentos FOR SELECT USING ((paroquiano_id IN ( SELECT paroquianos.id
   FROM public.paroquianos
  WHERE (paroquianos.user_id = auth.uid()))));


--
-- Name: pagamentos pagamentos_select_totem; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pagamentos_select_totem ON public.pagamentos FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'totem'::public.app_role) AND (origem = 'totem'::text)));


--
-- Name: pagamentos pagamentos_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pagamentos_update_admin ON public.pagamentos FOR UPDATE USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (public.has_role(auth.uid(), 'admin'::public.app_role) AND ((public.get_servo_comunidade(auth.uid()) IS NULL) OR (paroquiano_id IN ( SELECT paroquianos.id
   FROM public.paroquianos
  WHERE (paroquianos.comunidade_id = public.get_servo_comunidade(auth.uid())))) OR (paroquiano_id IS NULL)))));


--
-- Name: pagamentos pagamentos_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pagamentos_update_own ON public.pagamentos FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: configuracoes_paroquia paroquia_insert_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY paroquia_insert_super_admin ON public.configuracoes_paroquia FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: configuracoes_paroquia paroquia_select_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY paroquia_select_super_admin ON public.configuracoes_paroquia FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: configuracoes_paroquia paroquia_update_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY paroquia_update_super_admin ON public.configuracoes_paroquia FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: paroquianos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.paroquianos ENABLE ROW LEVEL SECURITY;

--
-- Name: paroquianos paroquianos_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY paroquianos_delete_admin ON public.paroquianos FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: paroquianos paroquianos_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY paroquianos_insert ON public.paroquianos FOR INSERT WITH CHECK (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: paroquianos paroquianos_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY paroquianos_select_admin ON public.paroquianos FOR SELECT USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (public.has_role(auth.uid(), 'admin'::public.app_role) AND ((public.get_servo_comunidade(auth.uid()) IS NULL) OR (comunidade_id = public.get_servo_comunidade(auth.uid()))))));


--
-- Name: paroquianos paroquianos_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY paroquianos_select_own ON public.paroquianos FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: paroquianos paroquianos_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY paroquianos_update_admin ON public.paroquianos FOR UPDATE USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (public.has_role(auth.uid(), 'admin'::public.app_role) AND ((public.get_servo_comunidade(auth.uid()) IS NULL) OR (comunidade_id = public.get_servo_comunidade(auth.uid()))))));


--
-- Name: paroquianos paroquianos_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY paroquianos_update_own ON public.paroquianos FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: pedidos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

--
-- Name: pedidos pedidos_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pedidos_insert ON public.pedidos FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'totem'::public.app_role) OR public.has_role(auth.uid(), 'dizimista'::public.app_role)));


--
-- Name: pedidos pedidos_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pedidos_select_admin ON public.pedidos FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: pedidos pedidos_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pedidos_select_own ON public.pedidos FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: pedidos pedidos_select_totem; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pedidos_select_totem ON public.pedidos FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'totem'::public.app_role) AND (origem = 'totem'::text)));


--
-- Name: pedidos pedidos_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pedidos_update_admin ON public.pedidos FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: produtos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

--
-- Name: produtos produtos_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY produtos_delete_admin ON public.produtos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: produtos produtos_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY produtos_insert_admin ON public.produtos FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: produtos produtos_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY produtos_select_admin ON public.produtos FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: produtos produtos_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY produtos_select_public ON public.produtos FOR SELECT USING ((ativo = true));


--
-- Name: produtos produtos_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY produtos_update_admin ON public.produtos FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: profiles profiles_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_admin ON public.profiles FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: profiles profiles_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_admin ON public.profiles FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: servos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.servos ENABLE ROW LEVEL SECURITY;

--
-- Name: servos servos_delete_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY servos_delete_super_admin ON public.servos FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: servos servos_insert_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY servos_insert_super_admin ON public.servos FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: servos servos_select_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY servos_select_super_admin ON public.servos FOR SELECT USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (auth.uid() = user_id)));


--
-- Name: servos servos_update_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY servos_update_super_admin ON public.servos FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: configuracoes_tef super_admin_tef_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY super_admin_tef_insert ON public.configuracoes_tef FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: configuracoes_tef super_admin_tef_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY super_admin_tef_select ON public.configuracoes_tef FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: configuracoes_tef super_admin_tef_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY super_admin_tef_update ON public.configuracoes_tef FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: tokens_client; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tokens_client ENABLE ROW LEVEL SECURITY;

--
-- Name: tokens_client tokens_delete_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tokens_delete_super_admin ON public.tokens_client FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: tokens_client tokens_insert_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tokens_insert_super_admin ON public.tokens_client FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: tokens_client tokens_select_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tokens_select_super_admin ON public.tokens_client FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: tokens_client tokens_update_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tokens_update_super_admin ON public.tokens_client FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: totens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.totens ENABLE ROW LEVEL SECURITY;

--
-- Name: totens totens_delete_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY totens_delete_super_admin ON public.totens FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: totens totens_insert_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY totens_insert_super_admin ON public.totens FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: totens totens_select_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY totens_select_super_admin ON public.totens FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: totens totens_update_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY totens_update_super_admin ON public.totens FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_delete_admin ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: user_roles user_roles_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_insert_admin ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: user_roles user_roles_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_select_admin ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: user_roles user_roles_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_select_own ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles user_roles_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_update_admin ON public.user_roles FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- PostgreSQL database dump complete
--


-- ============================================================================
-- GRANTs para roles do Supabase (PostgREST/Data API)
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avisos_totem TO authenticated;
GRANT ALL ON public.avisos_totem TO service_role;
GRANT SELECT ON public.avisos_totem TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campanhas TO authenticated;
GRANT ALL ON public.campanhas TO service_role;
GRANT SELECT ON public.campanhas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_pagamento TO authenticated;
GRANT ALL ON public.categorias_pagamento TO service_role;
GRANT SELECT ON public.categorias_pagamento TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificados_emitidos TO authenticated;
GRANT ALL ON public.certificados_emitidos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comprovantes TO authenticated;
GRANT ALL ON public.comprovantes TO service_role;
GRANT SELECT ON public.comprovantes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comunidades TO authenticated;
GRANT ALL ON public.comunidades TO service_role;
GRANT SELECT ON public.comunidades TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes_gateway TO authenticated;
GRANT ALL ON public.configuracoes_gateway TO service_role;
GRANT SELECT ON public.configuracoes_gateway TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes_paroquia TO authenticated;
GRANT ALL ON public.configuracoes_paroquia TO service_role;
GRANT SELECT ON public.configuracoes_paroquia TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes_tef TO authenticated;
GRANT ALL ON public.configuracoes_tef TO service_role;
GRANT SELECT ON public.configuracoes_tef TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edge_rate_limits TO authenticated;
GRANT ALL ON public.edge_rate_limits TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itens_pedido TO authenticated;
GRANT ALL ON public.itens_pedido TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.logs_auditoria TO authenticated;
GRANT ALL ON public.logs_auditoria TO service_role;
GRANT SELECT ON public.logs_auditoria TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.logs_terminal TO authenticated;
GRANT ALL ON public.logs_terminal TO service_role;
GRANT SELECT ON public.logs_terminal TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.logs_webhook TO authenticated;
GRANT ALL ON public.logs_webhook TO service_role;
GRANT SELECT ON public.logs_webhook TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.membros_familia TO authenticated;
GRANT ALL ON public.membros_familia TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensagens_personalizadas TO authenticated;
GRANT ALL ON public.mensagens_personalizadas TO service_role;
GRANT SELECT ON public.mensagens_personalizadas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes_admin TO authenticated;
GRANT ALL ON public.notificacoes_admin TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos TO authenticated;
GRANT ALL ON public.pagamentos TO service_role;
GRANT SELECT ON public.pagamentos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paroquianos TO authenticated;
GRANT ALL ON public.paroquianos TO service_role;
GRANT SELECT ON public.paroquianos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos TO authenticated;
GRANT ALL ON public.pedidos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO authenticated;
GRANT ALL ON public.produtos TO service_role;
GRANT SELECT ON public.produtos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.servos TO authenticated;
GRANT ALL ON public.servos TO service_role;
GRANT SELECT ON public.servos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tokens_client TO authenticated;
GRANT ALL ON public.tokens_client TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.totens TO authenticated;
GRANT ALL ON public.totens TO service_role;
GRANT SELECT ON public.totens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT ON public.user_roles TO anon;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;


-- ============================================================================
-- POLÍTICAS RLS (public.*)
-- ============================================================================

DROP POLICY IF EXISTS avisos_totem_delete_admin ON public.avisos_totem;
CREATE POLICY avisos_totem_delete_admin ON public.avisos_totem AS PERMISSIVE FOR DELETE TO public USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS avisos_totem_insert_admin ON public.avisos_totem;
CREATE POLICY avisos_totem_insert_admin ON public.avisos_totem AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS avisos_totem_select_public ON public.avisos_totem;
CREATE POLICY avisos_totem_select_public ON public.avisos_totem AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS avisos_totem_update_admin ON public.avisos_totem;
CREATE POLICY avisos_totem_update_admin ON public.avisos_totem AS PERMISSIVE FOR UPDATE TO public USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS campanhas_delete_admin ON public.campanhas;
CREATE POLICY campanhas_delete_admin ON public.campanhas AS PERMISSIVE FOR DELETE TO public USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS campanhas_insert_admin ON public.campanhas;
CREATE POLICY campanhas_insert_admin ON public.campanhas AS PERMISSIVE FOR INSERT TO public WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS campanhas_select ON public.campanhas;
CREATE POLICY campanhas_select ON public.campanhas AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS campanhas_select_public ON public.campanhas;
CREATE POLICY campanhas_select_public ON public.campanhas AS PERMISSIVE FOR SELECT TO public USING ((ativo = true));
DROP POLICY IF EXISTS campanhas_update_admin ON public.campanhas;
CREATE POLICY campanhas_update_admin ON public.campanhas AS PERMISSIVE FOR UPDATE TO public USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS categorias_insert_admin ON public.categorias_pagamento;
CREATE POLICY categorias_insert_admin ON public.categorias_pagamento AS PERMISSIVE FOR INSERT TO public WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS categorias_select ON public.categorias_pagamento;
CREATE POLICY categorias_select ON public.categorias_pagamento AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS categorias_update_admin ON public.categorias_pagamento;
CREATE POLICY categorias_update_admin ON public.categorias_pagamento AS PERMISSIVE FOR UPDATE TO public USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS certificados_delete_admin ON public.certificados_emitidos;
CREATE POLICY certificados_delete_admin ON public.certificados_emitidos AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS certificados_insert_admin ON public.certificados_emitidos;
CREATE POLICY certificados_insert_admin ON public.certificados_emitidos AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS certificados_select_admin ON public.certificados_emitidos;
CREATE POLICY certificados_select_admin ON public.certificados_emitidos AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS comprovantes_insert ON public.comprovantes;
CREATE POLICY comprovantes_insert ON public.comprovantes AS PERMISSIVE FOR INSERT TO public WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS comprovantes_select_admin ON public.comprovantes;
CREATE POLICY comprovantes_select_admin ON public.comprovantes AS PERMISSIVE FOR SELECT TO public USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS comprovantes_select_own ON public.comprovantes;
CREATE POLICY comprovantes_select_own ON public.comprovantes AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM pagamentos p
  WHERE ((p.id = comprovantes.pagamento_id) AND (p.user_id = auth.uid())))));
DROP POLICY IF EXISTS comunidades_delete_admin ON public.comunidades;
CREATE POLICY comunidades_delete_admin ON public.comunidades AS PERMISSIVE FOR DELETE TO public USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS comunidades_insert_admin ON public.comunidades;
CREATE POLICY comunidades_insert_admin ON public.comunidades AS PERMISSIVE FOR INSERT TO public WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS comunidades_select ON public.comunidades;
CREATE POLICY comunidades_select ON public.comunidades AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS comunidades_update_admin ON public.comunidades;
CREATE POLICY comunidades_update_admin ON public.comunidades AS PERMISSIVE FOR UPDATE TO public USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS config_gateway_all ON public.configuracoes_gateway;
CREATE POLICY config_gateway_all ON public.configuracoes_gateway AS PERMISSIVE FOR ALL TO public USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS config_gateway_select ON public.configuracoes_gateway;
CREATE POLICY config_gateway_select ON public.configuracoes_gateway AS PERMISSIVE FOR SELECT TO public USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS paroquia_insert_super_admin ON public.configuracoes_paroquia;
CREATE POLICY paroquia_insert_super_admin ON public.configuracoes_paroquia AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS paroquia_select_super_admin ON public.configuracoes_paroquia;
CREATE POLICY paroquia_select_super_admin ON public.configuracoes_paroquia AS PERMISSIVE FOR SELECT TO public USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS paroquia_update_super_admin ON public.configuracoes_paroquia;
CREATE POLICY paroquia_update_super_admin ON public.configuracoes_paroquia AS PERMISSIVE FOR UPDATE TO public USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS super_admin_tef_insert ON public.configuracoes_tef;
CREATE POLICY super_admin_tef_insert ON public.configuracoes_tef AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS super_admin_tef_select ON public.configuracoes_tef;
CREATE POLICY super_admin_tef_select ON public.configuracoes_tef AS PERMISSIVE FOR SELECT TO public USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS super_admin_tef_update ON public.configuracoes_tef;
CREATE POLICY super_admin_tef_update ON public.configuracoes_tef AS PERMISSIVE FOR UPDATE TO public USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS itens_pedido_insert ON public.itens_pedido;
CREATE POLICY itens_pedido_insert ON public.itens_pedido AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM pedidos
  WHERE ((pedidos.id = itens_pedido.pedido_id) AND ((pedidos.user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'totem'::app_role) OR has_role(auth.uid(), 'dizimista'::app_role))))));
DROP POLICY IF EXISTS itens_pedido_select_admin ON public.itens_pedido;
CREATE POLICY itens_pedido_select_admin ON public.itens_pedido AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS itens_pedido_select_own ON public.itens_pedido;
CREATE POLICY itens_pedido_select_own ON public.itens_pedido AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM pedidos
  WHERE ((pedidos.id = itens_pedido.pedido_id) AND (pedidos.user_id = auth.uid())))));
DROP POLICY IF EXISTS logs_auditoria_insert ON public.logs_auditoria;
CREATE POLICY logs_auditoria_insert ON public.logs_auditoria AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() IS NOT NULL));
DROP POLICY IF EXISTS logs_auditoria_select ON public.logs_auditoria;
CREATE POLICY logs_auditoria_select ON public.logs_auditoria AS PERMISSIVE FOR SELECT TO public USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS logs_terminal_insert_system ON public.logs_terminal;
CREATE POLICY logs_terminal_insert_system ON public.logs_terminal AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS logs_terminal_select_admin ON public.logs_terminal;
CREATE POLICY logs_terminal_select_admin ON public.logs_terminal AS PERMISSIVE FOR SELECT TO public USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS logs_webhook_insert ON public.logs_webhook;
CREATE POLICY logs_webhook_insert ON public.logs_webhook AS PERMISSIVE FOR INSERT TO public WITH CHECK (((auth.uid() IS NOT NULL) OR true));
DROP POLICY IF EXISTS logs_webhook_select ON public.logs_webhook;
CREATE POLICY logs_webhook_select ON public.logs_webhook AS PERMISSIVE FOR SELECT TO public USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS membros_familia_delete_admin ON public.membros_familia;
CREATE POLICY membros_familia_delete_admin ON public.membros_familia AS PERMISSIVE FOR DELETE TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS membros_familia_insert_own ON public.membros_familia;
CREATE POLICY membros_familia_insert_own ON public.membros_familia AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((paroquiano_id IN ( SELECT paroquianos.id
   FROM paroquianos
  WHERE (paroquianos.user_id = auth.uid()))) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS membros_familia_select_admin ON public.membros_familia;
CREATE POLICY membros_familia_select_admin ON public.membros_familia AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS membros_familia_select_own ON public.membros_familia;
CREATE POLICY membros_familia_select_own ON public.membros_familia AS PERMISSIVE FOR SELECT TO authenticated USING ((paroquiano_id IN ( SELECT paroquianos.id
   FROM paroquianos
  WHERE (paroquianos.user_id = auth.uid()))));
DROP POLICY IF EXISTS membros_familia_update ON public.membros_familia;
CREATE POLICY membros_familia_update ON public.membros_familia AS PERMISSIVE FOR UPDATE TO authenticated USING (((paroquiano_id IN ( SELECT paroquianos.id
   FROM paroquianos
  WHERE (paroquianos.user_id = auth.uid()))) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS mensagens_delete_admin ON public.mensagens_personalizadas;
CREATE POLICY mensagens_delete_admin ON public.mensagens_personalizadas AS PERMISSIVE FOR DELETE TO public USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS mensagens_insert_admin ON public.mensagens_personalizadas;
CREATE POLICY mensagens_insert_admin ON public.mensagens_personalizadas AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS mensagens_select ON public.mensagens_personalizadas;
CREATE POLICY mensagens_select ON public.mensagens_personalizadas AS PERMISSIVE FOR SELECT TO authenticated USING ((ativo = true));
DROP POLICY IF EXISTS mensagens_update_admin ON public.mensagens_personalizadas;
CREATE POLICY mensagens_update_admin ON public.mensagens_personalizadas AS PERMISSIVE FOR UPDATE TO public USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS notificacoes_delete_admin ON public.notificacoes_admin;
CREATE POLICY notificacoes_delete_admin ON public.notificacoes_admin AS PERMISSIVE FOR DELETE TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS notificacoes_insert_admin ON public.notificacoes_admin;
CREATE POLICY notificacoes_insert_admin ON public.notificacoes_admin AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS notificacoes_select_admin ON public.notificacoes_admin;
CREATE POLICY notificacoes_select_admin ON public.notificacoes_admin AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS notificacoes_update_admin ON public.notificacoes_admin;
CREATE POLICY notificacoes_update_admin ON public.notificacoes_admin AS PERMISSIVE FOR UPDATE TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS pagamentos_insert ON public.pagamentos;
CREATE POLICY pagamentos_insert ON public.pagamentos AS PERMISSIVE FOR INSERT TO public WITH CHECK (((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'totem'::app_role) OR has_role(auth.uid(), 'dizimista'::app_role) OR ((origem = 'totem'::text) AND (user_id IS NULL))));
DROP POLICY IF EXISTS pagamentos_select_admin ON public.pagamentos;
CREATE POLICY pagamentos_select_admin ON public.pagamentos AS PERMISSIVE FOR SELECT TO public USING ((has_role(auth.uid(), 'super_admin'::app_role) OR (has_role(auth.uid(), 'admin'::app_role) AND ((get_servo_comunidade(auth.uid()) IS NULL) OR (paroquiano_id IN ( SELECT paroquianos.id
   FROM paroquianos
  WHERE (paroquianos.comunidade_id = get_servo_comunidade(auth.uid())))) OR (paroquiano_id IS NULL)))));
DROP POLICY IF EXISTS pagamentos_select_own ON public.pagamentos;
CREATE POLICY pagamentos_select_own ON public.pagamentos AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS pagamentos_select_own_paroquiano ON public.pagamentos;
CREATE POLICY pagamentos_select_own_paroquiano ON public.pagamentos AS PERMISSIVE FOR SELECT TO public USING ((paroquiano_id IN ( SELECT paroquianos.id
   FROM paroquianos
  WHERE (paroquianos.user_id = auth.uid()))));
DROP POLICY IF EXISTS pagamentos_select_totem ON public.pagamentos;
CREATE POLICY pagamentos_select_totem ON public.pagamentos AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'totem'::app_role) AND (origem = 'totem'::text)));
DROP POLICY IF EXISTS pagamentos_update_admin ON public.pagamentos;
CREATE POLICY pagamentos_update_admin ON public.pagamentos AS PERMISSIVE FOR UPDATE TO public USING ((has_role(auth.uid(), 'super_admin'::app_role) OR (has_role(auth.uid(), 'admin'::app_role) AND ((get_servo_comunidade(auth.uid()) IS NULL) OR (paroquiano_id IN ( SELECT paroquianos.id
   FROM paroquianos
  WHERE (paroquianos.comunidade_id = get_servo_comunidade(auth.uid())))) OR (paroquiano_id IS NULL)))));
DROP POLICY IF EXISTS pagamentos_update_own ON public.pagamentos;
CREATE POLICY pagamentos_update_own ON public.pagamentos AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS paroquianos_delete_admin ON public.paroquianos;
CREATE POLICY paroquianos_delete_admin ON public.paroquianos AS PERMISSIVE FOR DELETE TO public USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS paroquianos_insert ON public.paroquianos;
CREATE POLICY paroquianos_insert ON public.paroquianos AS PERMISSIVE FOR INSERT TO public WITH CHECK (((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS paroquianos_select_admin ON public.paroquianos;
CREATE POLICY paroquianos_select_admin ON public.paroquianos AS PERMISSIVE FOR SELECT TO public USING ((has_role(auth.uid(), 'super_admin'::app_role) OR (has_role(auth.uid(), 'admin'::app_role) AND ((get_servo_comunidade(auth.uid()) IS NULL) OR (comunidade_id = get_servo_comunidade(auth.uid()))))));
DROP POLICY IF EXISTS paroquianos_select_own ON public.paroquianos;
CREATE POLICY paroquianos_select_own ON public.paroquianos AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS paroquianos_update_admin ON public.paroquianos;
CREATE POLICY paroquianos_update_admin ON public.paroquianos AS PERMISSIVE FOR UPDATE TO public USING ((has_role(auth.uid(), 'super_admin'::app_role) OR (has_role(auth.uid(), 'admin'::app_role) AND ((get_servo_comunidade(auth.uid()) IS NULL) OR (comunidade_id = get_servo_comunidade(auth.uid()))))));
DROP POLICY IF EXISTS paroquianos_update_own ON public.paroquianos;
CREATE POLICY paroquianos_update_own ON public.paroquianos AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS pedidos_insert ON public.pedidos;
CREATE POLICY pedidos_insert ON public.pedidos AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'totem'::app_role) OR has_role(auth.uid(), 'dizimista'::app_role)));
DROP POLICY IF EXISTS pedidos_select_admin ON public.pedidos;
CREATE POLICY pedidos_select_admin ON public.pedidos AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS pedidos_select_own ON public.pedidos;
CREATE POLICY pedidos_select_own ON public.pedidos AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS pedidos_select_totem ON public.pedidos;
CREATE POLICY pedidos_select_totem ON public.pedidos AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'totem'::app_role) AND (origem = 'totem'::text)));
DROP POLICY IF EXISTS pedidos_update_admin ON public.pedidos;
CREATE POLICY pedidos_update_admin ON public.pedidos AS PERMISSIVE FOR UPDATE TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS produtos_delete_admin ON public.produtos;
CREATE POLICY produtos_delete_admin ON public.produtos AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS produtos_insert_admin ON public.produtos;
CREATE POLICY produtos_insert_admin ON public.produtos AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS produtos_select_admin ON public.produtos;
CREATE POLICY produtos_select_admin ON public.produtos AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS produtos_select_public ON public.produtos;
CREATE POLICY produtos_select_public ON public.produtos AS PERMISSIVE FOR SELECT TO public USING ((ativo = true));
DROP POLICY IF EXISTS produtos_update_admin ON public.produtos;
CREATE POLICY produtos_update_admin ON public.produtos AS PERMISSIVE FOR UPDATE TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
CREATE POLICY profiles_insert ON public.profiles AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = id));
DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
CREATE POLICY profiles_select_admin ON public.profiles AS PERMISSIVE FOR SELECT TO public USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = id));
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin ON public.profiles AS PERMISSIVE FOR UPDATE TO public USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = id));
DROP POLICY IF EXISTS servos_delete_super_admin ON public.servos;
CREATE POLICY servos_delete_super_admin ON public.servos AS PERMISSIVE FOR DELETE TO public USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS servos_insert_super_admin ON public.servos;
CREATE POLICY servos_insert_super_admin ON public.servos AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS servos_select_super_admin ON public.servos;
CREATE POLICY servos_select_super_admin ON public.servos AS PERMISSIVE FOR SELECT TO public USING ((has_role(auth.uid(), 'super_admin'::app_role) OR (auth.uid() = user_id)));
DROP POLICY IF EXISTS servos_update_super_admin ON public.servos;
CREATE POLICY servos_update_super_admin ON public.servos AS PERMISSIVE FOR UPDATE TO public USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS tokens_delete_super_admin ON public.tokens_client;
CREATE POLICY tokens_delete_super_admin ON public.tokens_client AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS tokens_insert_super_admin ON public.tokens_client;
CREATE POLICY tokens_insert_super_admin ON public.tokens_client AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS tokens_select_super_admin ON public.tokens_client;
CREATE POLICY tokens_select_super_admin ON public.tokens_client AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS tokens_update_super_admin ON public.tokens_client;
CREATE POLICY tokens_update_super_admin ON public.tokens_client AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS totens_delete_super_admin ON public.totens;
CREATE POLICY totens_delete_super_admin ON public.totens AS PERMISSIVE FOR DELETE TO public USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS totens_insert_super_admin ON public.totens;
CREATE POLICY totens_insert_super_admin ON public.totens AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS totens_select_super_admin ON public.totens;
CREATE POLICY totens_select_super_admin ON public.totens AS PERMISSIVE FOR SELECT TO public USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS totens_update_super_admin ON public.totens;
CREATE POLICY totens_update_super_admin ON public.totens AS PERMISSIVE FOR UPDATE TO public USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS user_roles_delete_admin ON public.user_roles;
CREATE POLICY user_roles_delete_admin ON public.user_roles AS PERMISSIVE FOR DELETE TO public USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS user_roles_insert_admin ON public.user_roles;
CREATE POLICY user_roles_insert_admin ON public.user_roles AS PERMISSIVE FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS user_roles_select_admin ON public.user_roles;
CREATE POLICY user_roles_select_admin ON public.user_roles AS PERMISSIVE FOR SELECT TO public USING (has_role(auth.uid(), 'super_admin'::app_role));
DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
CREATE POLICY user_roles_select_own ON public.user_roles AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS user_roles_update_admin ON public.user_roles;
CREATE POLICY user_roles_update_admin ON public.user_roles AS PERMISSIVE FOR UPDATE TO public USING (has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================================================
-- STORAGE: buckets e políticas
-- ============================================================================

INSERT INTO storage.buckets (id, name, public) VALUES
  ('logos-termicos',    'logos-termicos',    true),
  ('banners-campanhas', 'banners-campanhas', true),
  ('produtos',          'produtos',          true),
  ('avisos-totem',      'avisos-totem',      true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS avisos_totem_storage_delete ON storage.objects;
CREATE POLICY avisos_totem_storage_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'avisos-totem'::text) AND has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS avisos_totem_storage_insert ON storage.objects;
CREATE POLICY avisos_totem_storage_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'avisos-totem'::text) AND has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS avisos_totem_storage_select ON storage.objects;
CREATE POLICY avisos_totem_storage_select ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'avisos-totem'::text));
DROP POLICY IF EXISTS avisos_totem_storage_update ON storage.objects;
CREATE POLICY avisos_totem_storage_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'avisos-totem'::text) AND has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS banners_campanhas_delete_admin ON storage.objects;
CREATE POLICY banners_campanhas_delete_admin ON storage.objects AS PERMISSIVE FOR DELETE TO public USING (((bucket_id = 'banners-campanhas'::text) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))));
DROP POLICY IF EXISTS banners_campanhas_insert_admin ON storage.objects;
CREATE POLICY banners_campanhas_insert_admin ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK (((bucket_id = 'banners-campanhas'::text) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))));
DROP POLICY IF EXISTS banners_campanhas_select_public ON storage.objects;
CREATE POLICY banners_campanhas_select_public ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'banners-campanhas'::text));
DROP POLICY IF EXISTS banners_campanhas_update_admin ON storage.objects;
CREATE POLICY banners_campanhas_update_admin ON storage.objects AS PERMISSIVE FOR UPDATE TO public USING (((bucket_id = 'banners-campanhas'::text) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))));
DROP POLICY IF EXISTS logos_termicos_public_read ON storage.objects;
CREATE POLICY logos_termicos_public_read ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'logos-termicos'::text));
DROP POLICY IF EXISTS logos_termicos_super_admin_delete ON storage.objects;
CREATE POLICY logos_termicos_super_admin_delete ON storage.objects AS PERMISSIVE FOR DELETE TO public USING (((bucket_id = 'logos-termicos'::text) AND has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS logos_termicos_super_admin_update ON storage.objects;
CREATE POLICY logos_termicos_super_admin_update ON storage.objects AS PERMISSIVE FOR UPDATE TO public USING (((bucket_id = 'logos-termicos'::text) AND has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS logos_termicos_super_admin_upload ON storage.objects;
CREATE POLICY logos_termicos_super_admin_upload ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK (((bucket_id = 'logos-termicos'::text) AND has_role(auth.uid(), 'super_admin'::app_role)));
DROP POLICY IF EXISTS produtos_images_delete ON storage.objects;
CREATE POLICY produtos_images_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'produtos'::text) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))));
DROP POLICY IF EXISTS produtos_images_insert ON storage.objects;
CREATE POLICY produtos_images_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'produtos'::text) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))));
DROP POLICY IF EXISTS produtos_images_select ON storage.objects;
CREATE POLICY produtos_images_select ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'produtos'::text));
DROP POLICY IF EXISTS produtos_images_update ON storage.objects;
CREATE POLICY produtos_images_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'produtos'::text) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))));


-- ============================================================================
-- HARDENING DE SEGURANÇA (2026-06-24)
-- ============================================================================
-- 1) Garante coluna webhook_hmac_obrigatorio (caso o backup seja aplicado
--    sobre um banco antigo já populado).
ALTER TABLE public.configuracoes_gateway
  ADD COLUMN IF NOT EXISTS webhook_hmac_obrigatorio boolean NOT NULL DEFAULT true;

-- 2) Revoga EXECUTE de funções administrativas SECURITY DEFINER do papel
--    anon/PUBLIC. Mantém apenas authenticated e service_role.
REVOKE EXECUTE ON FUNCTION public.get_dashboard_resumo(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_gateway_metrics(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_resumo(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_gateway_metrics(integer) TO authenticated, service_role;

-- 3) Restringe INSERT em logs_terminal a service_role (triggers SECURITY
--    DEFINER continuam funcionando). Evita injeção de logs por clientes.
DROP POLICY IF EXISTS logs_terminal_insert_system ON public.logs_terminal;
CREATE POLICY logs_terminal_insert_system ON public.logs_terminal
  FOR INSERT TO service_role WITH CHECK (true);

-- ============================================================================
-- FIM DO BACKUP
-- ============================================================================
-- Próximos passos:
--   1. Promover super_admin:
--      UPDATE public.user_roles SET role='super_admin' WHERE user_id='<uuid>';
--   2. Inserir registro inicial de configuração (se vazio):
--      INSERT INTO public.configuracoes_paroquia (nome) VALUES ('Minha Paróquia')
--      ON CONFLICT DO NOTHING;
--   3. Configurar Edge Functions secrets e deploy.
-- ============================================================================


-- ============================================================================
-- DELTA Clone-Ready (2026-06-26)
-- ============================================================================
-- Garante que um banco clonado a partir deste arquivo esteja 100% pronto para
-- uma nova paróquia, com PWA + push notifications + perfil dizimista + regras
-- antiduplicidade + bootstrap automático.
-- ============================================================================

-- 1) Coluna foto_url / melhor_dia / notificações no cadastro do paroquiano
ALTER TABLE public.paroquianos
  ADD COLUMN IF NOT EXISTS foto_url                 text,
  ADD COLUMN IF NOT EXISTS melhor_dia_pagamento     smallint
    CHECK (melhor_dia_pagamento IS NULL OR melhor_dia_pagamento BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS notificacoes_push_ativas boolean NOT NULL DEFAULT true;

-- 2) CPF do contribuinte avulso no pagamento (para comprovante / nota)
ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS cpf_contribuinte text;

-- 3) Web Push: subscriptions e log de envio
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint     text NOT NULL UNIQUE,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  user_agent   text,
  platform     text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subs_select_self  ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subs_insert_self  ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subs_update_self  ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subs_delete_self  ON public.push_subscriptions;
CREATE POLICY push_subs_select_self ON public.push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY push_subs_insert_self ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY push_subs_update_self ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY push_subs_delete_self ON public.push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.notificacoes_enviadas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  tipo        text NOT NULL,
  referencia  date NOT NULL,
  enviada_em  timestamptz NOT NULL DEFAULT now(),
  payload     jsonb,
  UNIQUE (user_id, tipo, referencia)
);
GRANT ALL ON public.notificacoes_enviadas TO service_role;
ALTER TABLE public.notificacoes_enviadas ENABLE ROW LEVEL SECURITY;
-- somente service_role acessa (edge functions) — nenhuma policy para anon/authenticated

-- 4) Rate limit de edge functions
CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  bucket_key   text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits         integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.edge_rate_limits TO service_role;
ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

-- 5) Índice único: impede dois dízimos PAGOS para o mesmo paroquiano/mês
CREATE UNIQUE INDEX IF NOT EXISTS uniq_dizimo_pago_mes
  ON public.pagamentos (paroquiano_id, mes_referencia)
  WHERE tipo = 'dizimo' AND status = 'pago' AND paroquiano_id IS NOT NULL;

-- 6) Trigger: ao marcar um dízimo como pago, cancela pendentes do mesmo mês
CREATE OR REPLACE FUNCTION public.cancelar_pendentes_mesmo_mes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'dizimo'
     AND NEW.status = 'pago'
     AND NEW.mes_referencia IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pago') THEN
    UPDATE public.pagamentos
       SET status = 'cancelado',
           gateway_status = COALESCE(gateway_status, 'auto_cancelado_mes_ja_pago'),
           updated_at = now()
     WHERE id <> NEW.id
       AND tipo = 'dizimo'
       AND mes_referencia = NEW.mes_referencia
       AND status IN ('criado', 'aguardando_pagamento')
       AND (
         (NEW.paroquiano_id IS NOT NULL AND paroquiano_id = NEW.paroquiano_id)
         OR (NEW.user_id IS NOT NULL AND user_id = NEW.user_id)
       );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_cancelar_pendentes_mesmo_mes ON public.pagamentos;
CREATE TRIGGER trg_cancelar_pendentes_mesmo_mes
  AFTER INSERT OR UPDATE OF status ON public.pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.cancelar_pendentes_mesmo_mes();

-- 7) Realtime: pagamentos (para UI sincronizar app/totem/painel)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pagamentos'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.pagamentos';
  END IF;
END $$;
ALTER TABLE public.pagamentos REPLICA IDENTITY FULL;

-- 8) Bucket privado para avatares dos paroquianos
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatares-paroquianos', 'avatares-paroquianos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS avatares_select_self ON storage.objects;
DROP POLICY IF EXISTS avatares_insert_self ON storage.objects;
DROP POLICY IF EXISTS avatares_update_self ON storage.objects;
DROP POLICY IF EXISTS avatares_delete_self ON storage.objects;
CREATE POLICY avatares_select_self ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatares-paroquianos'
         AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY avatares_insert_self ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatares-paroquianos'
              AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY avatares_update_self ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatares-paroquianos'
         AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY avatares_delete_self ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatares-paroquianos'
         AND (storage.foldername(name))[1] = auth.uid()::text);

-- 9) Cron diário de push (09:00 BRT = 12:00 UTC) — requer pg_cron habilitado
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('diziline-push-diario')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'diziline-push-diario');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 10) Bootstrap function — promove super_admin + popula tudo
CREATE OR REPLACE FUNCTION public.setup_nova_paroquia(
  _email          text,
  _nome_paroquia  text DEFAULT 'Minha Paróquia',
  _cnpj           text DEFAULT NULL,
  _site           text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _uid IS NULL THEN
    RETURN json_build_object('ok', false,
      'erro', 'Crie o usuário em Authentication → Users antes de rodar setup_nova_paroquia.');
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.user_roles SET role = 'super_admin'
   WHERE user_id = _uid AND role <> 'super_admin';

  INSERT INTO public.configuracoes_paroquia (nome, cnpj, site)
  SELECT _nome_paroquia, _cnpj, _site
  WHERE NOT EXISTS (SELECT 1 FROM public.configuracoes_paroquia);

  INSERT INTO public.configuracoes_gateway (provedor_ativo, ambiente, ativo)
  SELECT 'rede', 'sandbox', false
  WHERE NOT EXISTS (SELECT 1 FROM public.configuracoes_gateway);

  INSERT INTO public.configuracoes_tef (provedor_tef, modo, ativo)
  SELECT 'connect_tef', 'sandbox', false
  WHERE NOT EXISTS (SELECT 1 FROM public.configuracoes_tef);

  INSERT INTO public.comunidades (nome, ativo)
  SELECT 'Matriz', true
  WHERE NOT EXISTS (SELECT 1 FROM public.comunidades);

  INSERT INTO public.categorias_pagamento (nome, ativo)
  VALUES ('Dízimo', true), ('Oferta', true), ('Doação', true), ('Campanha', true)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.mensagens_personalizadas (chave, titulo, conteudo, ativo) VALUES
    ('totem_boas_vindas', 'Bem-vindo(a)!',
     'Que a paz do Senhor esteja com você. Contribua com seu dízimo ou oferta.', true),
    ('totem_agradecimento', 'Obrigado pela sua contribuição!',
     'Que Deus abençoe abundantemente sua generosidade.', true),
    ('email_agradecimento', 'Obrigado pelo seu dízimo!',
     'Olá {{nome}}, recebemos sua contribuição de {{valor}}. Que Deus te abençoe!', true)
  ON CONFLICT DO NOTHING;

  RETURN json_build_object('ok', true, 'super_admin_id', _uid,
    'mensagem', 'Pronto! Faça login e configure logo, cores, gateway e TEF em /admin/configuracoes.');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.setup_nova_paroquia(text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.setup_nova_paroquia(text,text,text,text) TO service_role;

-- ============================================================================
-- COMO INSTALAR UMA NOVA PARÓQUIA (Diziline)
-- ============================================================================
--   1) Crie um projeto Supabase novo.
--   2) SQL Editor → cole este arquivo inteiro → Run.
--   3) Authentication → Users → adicione o e-mail do pároco/responsável
--      (com senha) e copie o UUID.
--   4) SQL Editor → execute:
--        SELECT public.setup_nova_paroquia(
--          'padre@minhaparoquia.org',
--          'Paróquia São João Batista',
--          '00.000.000/0001-00',
--          'https://saojoao.org'
--        );
--   5) Deploy do app (Cloudflare Pages) com VITE_SUPABASE_URL /
--      VITE_SUPABASE_PUBLISHABLE_KEY da nova instância.
--   6) Deploy das Edge Functions: supabase functions deploy
--      e configure secrets (REDE_*, RESEND_API_KEY, VAPID_*, etc).
--   7) Faça login no app → /admin/configuracoes → personalize logo,
--      cores, slogan, gateway, TEF, mensagens. Pronto!
-- ============================================================================
