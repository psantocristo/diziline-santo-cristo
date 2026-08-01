ALTER PUBLICATION supabase_realtime ADD TABLE public.pagamentos;
ALTER TABLE public.pagamentos REPLICA IDENTITY FULL;