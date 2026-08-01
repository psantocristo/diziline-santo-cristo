-- Criar bucket para banners de campanhas (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners-campanhas', 'banners-campanhas', true)
ON CONFLICT (id) DO NOTHING;

-- Política de leitura pública
CREATE POLICY "banners_campanhas_select_public"
ON storage.objects FOR SELECT
USING (bucket_id = 'banners-campanhas');

-- Política de upload para admins
CREATE POLICY "banners_campanhas_insert_admin"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'banners-campanhas' AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

-- Política de update/delete para admins
CREATE POLICY "banners_campanhas_update_admin"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'banners-campanhas' AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "banners_campanhas_delete_admin"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'banners-campanhas' AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);