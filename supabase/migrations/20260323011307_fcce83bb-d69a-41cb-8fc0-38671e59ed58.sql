
-- Add columns to avisos_totem
ALTER TABLE public.avisos_totem ADD COLUMN imagem_url text;
ALTER TABLE public.avisos_totem ADD COLUMN link_url text;

-- Create storage bucket for avisos images
INSERT INTO storage.buckets (id, name, public) VALUES ('avisos-totem', 'avisos-totem', true);

-- RLS: public read
CREATE POLICY "avisos_totem_storage_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avisos-totem');

-- RLS: super_admin upload
CREATE POLICY "avisos_totem_storage_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avisos-totem' AND public.has_role(auth.uid(), 'super_admin'));

-- RLS: super_admin update
CREATE POLICY "avisos_totem_storage_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avisos-totem' AND public.has_role(auth.uid(), 'super_admin'));

-- RLS: super_admin delete
CREATE POLICY "avisos_totem_storage_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avisos-totem' AND public.has_role(auth.uid(), 'super_admin'));
