-- 1. Adicionar coluna logo_termico_url na tabela configuracoes_paroquia
ALTER TABLE public.configuracoes_paroquia
  ADD COLUMN IF NOT EXISTS logo_termico_url text;

-- 2. Atualizar a função get_tema_paroquia para retornar logo_termico_url
CREATE OR REPLACE FUNCTION public.get_tema_paroquia()
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'nome', nome,
    'logo_url', logo_url,
    'logo_termico_url', logo_termico_url,
    'cor_primaria', cor_primaria,
    'cor_secundaria', cor_secundaria,
    'slogan', slogan
  )
  FROM public.configuracoes_paroquia
  LIMIT 1;
$$;

-- 3. Criar bucket público para logos térmicos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos-termicos', 'logos-termicos', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Política: leitura pública do bucket (necessário para janela de impressão sem auth)
CREATE POLICY "logos_termicos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos-termicos');

-- 5. Política: apenas super_admin pode fazer upload
CREATE POLICY "logos_termicos_super_admin_upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'logos-termicos'
  AND has_role(auth.uid(), 'super_admin'::app_role)
);

-- 6. Política: apenas super_admin pode atualizar/substituir
CREATE POLICY "logos_termicos_super_admin_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'logos-termicos'
  AND has_role(auth.uid(), 'super_admin'::app_role)
);

-- 7. Política: apenas super_admin pode excluir
CREATE POLICY "logos_termicos_super_admin_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'logos-termicos'
  AND has_role(auth.uid(), 'super_admin'::app_role)
);