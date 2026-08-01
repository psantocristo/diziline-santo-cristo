
-- Adicionar coluna de foto no paroquiano
ALTER TABLE public.paroquianos ADD COLUMN IF NOT EXISTS foto_url text;

-- Policies do bucket avatares-paroquianos: cada usuário só gerencia seus próprios arquivos
-- Convenção: nome do arquivo começa com o user_id, ex: <user_id>/avatar.jpg
DROP POLICY IF EXISTS "Avatares: usuário lê o próprio" ON storage.objects;
CREATE POLICY "Avatares: usuário lê o próprio"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'avatares-paroquianos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Avatares: usuário insere o próprio" ON storage.objects;
CREATE POLICY "Avatares: usuário insere o próprio"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatares-paroquianos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Avatares: usuário atualiza o próprio" ON storage.objects;
CREATE POLICY "Avatares: usuário atualiza o próprio"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatares-paroquianos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Avatares: usuário deleta o próprio" ON storage.objects;
CREATE POLICY "Avatares: usuário deleta o próprio"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatares-paroquianos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Avatares: admin lê todos" ON storage.objects;
CREATE POLICY "Avatares: admin lê todos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'avatares-paroquianos'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  );
