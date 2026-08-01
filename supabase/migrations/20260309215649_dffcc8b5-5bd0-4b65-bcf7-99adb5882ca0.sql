
-- ═══════════════════════════════════════════════════════
-- MÓDULO LOJA DE PRODUTOS
-- ═══════════════════════════════════════════════════════

-- 1. Coluna loja_ativa em configuracoes_paroquia
ALTER TABLE public.configuracoes_paroquia
  ADD COLUMN IF NOT EXISTS loja_ativa boolean NOT NULL DEFAULT false;

-- 2. Tabela de produtos
CREATE TABLE public.produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  preco numeric NOT NULL CHECK (preco > 0),
  estoque integer NOT NULL DEFAULT 0,
  slug text NOT NULL UNIQUE,
  imagem_url text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- Todos podem ver produtos ativos
CREATE POLICY "produtos_select_public" ON public.produtos
  FOR SELECT USING (ativo = true);

-- Admin/super_admin podem ver todos (incluindo inativos)
CREATE POLICY "produtos_select_admin" ON public.produtos
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- CRUD admin
CREATE POLICY "produtos_insert_admin" ON public.produtos
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "produtos_update_admin" ON public.produtos
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "produtos_delete_admin" ON public.produtos
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER set_produtos_updated_at
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. Tabela de pedidos
CREATE TABLE public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_retirada text NOT NULL UNIQUE DEFAULT ('PED-' || upper(substr(md5(random()::text), 1, 6))),
  paroquiano_id uuid REFERENCES public.paroquianos(id),
  user_id uuid,
  nome_cliente text,
  origem text NOT NULL DEFAULT 'web' CHECK (origem IN ('web', 'totem')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'retirado', 'cancelado')),
  total numeric NOT NULL CHECK (total > 0),
  retirado_em timestamptz,
  cancelado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- Admin pode ver todos os pedidos
CREATE POLICY "pedidos_select_admin" ON public.pedidos
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Dizimista pode ver seus próprios pedidos
CREATE POLICY "pedidos_select_own" ON public.pedidos
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Totem pode ver pedidos que criou (pela origem)
CREATE POLICY "pedidos_select_totem" ON public.pedidos
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'totem'::app_role) AND origem = 'totem');

-- Insert: dizimista, totem, admin
CREATE POLICY "pedidos_insert" ON public.pedidos
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'totem'::app_role)
    OR has_role(auth.uid(), 'dizimista'::app_role)
  );

-- Update: admin (marcar retirado/cancelado)
CREATE POLICY "pedidos_update_admin" ON public.pedidos
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER set_pedidos_updated_at
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4. Tabela de itens do pedido
CREATE TABLE public.itens_pedido (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id),
  quantidade integer NOT NULL CHECK (quantidade > 0),
  preco_unitario numeric NOT NULL CHECK (preco_unitario >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;

-- Mesmas políticas do pedido pai
CREATE POLICY "itens_pedido_select_admin" ON public.itens_pedido
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "itens_pedido_select_own" ON public.itens_pedido
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedidos WHERE id = itens_pedido.pedido_id AND user_id = auth.uid()));

CREATE POLICY "itens_pedido_insert" ON public.itens_pedido
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pedidos WHERE id = itens_pedido.pedido_id
      AND (
        user_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
        OR has_role(auth.uid(), 'totem'::app_role)
        OR has_role(auth.uid(), 'dizimista'::app_role)
      )
    )
  );

-- 5. Bucket para imagens de produtos
INSERT INTO storage.buckets (id, name, public)
VALUES ('produtos', 'produtos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "produtos_images_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'produtos');

CREATE POLICY "produtos_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'produtos' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));

CREATE POLICY "produtos_images_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'produtos' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));

CREATE POLICY "produtos_images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'produtos' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));

-- 6. Função para abater estoque ao criar pedido
CREATE OR REPLACE FUNCTION public.abater_estoque_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

CREATE TRIGGER trg_abater_estoque
  AFTER INSERT ON public.itens_pedido
  FOR EACH ROW EXECUTE FUNCTION public.abater_estoque_pedido();

-- 7. Função para gerar slug a partir do nome
CREATE OR REPLACE FUNCTION public.gerar_slug_produto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

CREATE TRIGGER trg_gerar_slug_produto
  BEFORE INSERT OR UPDATE OF nome ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.gerar_slug_produto();

-- 8. Habilitar extensão unaccent (necessária para slug)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 9. Função RPC para obter configuração de loja (acessível pelo totem)
CREATE OR REPLACE FUNCTION public.get_loja_config()
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object('loja_ativa', loja_ativa)
  FROM public.configuracoes_paroquia
  LIMIT 1;
$$;
