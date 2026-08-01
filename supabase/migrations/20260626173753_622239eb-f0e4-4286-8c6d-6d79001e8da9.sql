
-- ============================================================================
-- setup_nova_paroquia: bootstrap idempotente para clonagem multi-paróquia
-- ============================================================================
-- Promove o primeiro usuário a super_admin, popula configurações padrão
-- (paróquia, gateway, TEF), comunidade Matriz, categorias e mensagens.
-- Pode ser executada em qualquer momento; tudo é ON CONFLICT DO NOTHING.

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
DECLARE
  _uid uuid;
  _comunidade_id uuid;
BEGIN
  -- 1) Localiza usuário pelo email
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _uid IS NULL THEN
    RETURN json_build_object(
      'ok', false,
      'erro', 'Usuário não encontrado. Crie a conta em Authentication → Users antes de chamar setup_nova_paroquia.'
    );
  END IF;

  -- 2) Promove a super_admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.user_roles
     SET role = 'super_admin'
   WHERE user_id = _uid AND role <> 'super_admin';

  -- 3) Configuração principal da paróquia
  INSERT INTO public.configuracoes_paroquia (nome, cnpj, site)
  SELECT _nome_paroquia, _cnpj, _site
  WHERE NOT EXISTS (SELECT 1 FROM public.configuracoes_paroquia);

  -- 4) Gateway padrão (rede sandbox, desativado até config real)
  INSERT INTO public.configuracoes_gateway (provedor_ativo, ambiente, ativo)
  SELECT 'rede', 'sandbox', false
  WHERE NOT EXISTS (SELECT 1 FROM public.configuracoes_gateway);

  -- 5) Configuração TEF padrão
  INSERT INTO public.configuracoes_tef (provedor_tef, modo, ativo)
  SELECT 'connect_tef', 'sandbox', false
  WHERE NOT EXISTS (SELECT 1 FROM public.configuracoes_tef);

  -- 6) Comunidade padrão Matriz
  INSERT INTO public.comunidades (nome, ativo)
  SELECT 'Matriz', true
  WHERE NOT EXISTS (SELECT 1 FROM public.comunidades);

  -- 7) Categorias padrão
  INSERT INTO public.categorias_pagamento (nome, ativo)
  VALUES ('Dízimo', true), ('Oferta', true), ('Doação', true), ('Campanha', true)
  ON CONFLICT DO NOTHING;

  -- 8) Mensagens personalizadas padrão (tela inicial do totem)
  INSERT INTO public.mensagens_personalizadas (chave, titulo, conteudo, ativo)
  VALUES
    ('totem_boas_vindas', 'Bem-vindo(a)!',
     'Que a paz do Senhor esteja com você. Contribua com seu dízimo ou oferta.', true),
    ('totem_agradecimento', 'Obrigado pela sua contribuição!',
     'Que Deus abençoe abundantemente sua generosidade.', true),
    ('email_agradecimento', 'Obrigado pelo seu dízimo!',
     'Olá {{nome}}, recebemos sua contribuição de {{valor}}. Que Deus te abençoe!', true)
  ON CONFLICT DO NOTHING;

  RETURN json_build_object(
    'ok', true,
    'super_admin_id', _uid,
    'paroquia', _nome_paroquia,
    'mensagem', 'Paróquia inicializada. Faça login e configure logo, cores, gateway e TEF em /admin/configuracoes.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.setup_nova_paroquia(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.setup_nova_paroquia(text, text, text, text) TO service_role;

COMMENT ON FUNCTION public.setup_nova_paroquia(text, text, text, text) IS
  'Bootstrap de instância multi-paróquia. Rode no SQL Editor após criar o primeiro usuário em Auth → Users. Ex: SELECT public.setup_nova_paroquia(''pe.joao@paroquia.org'', ''Paróquia São João'', ''00.000.000/0001-00'', ''https://saojoao.org'');';
