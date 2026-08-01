-- Enable realtime for pagamentos, logs_webhook and logs_auditoria tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.pagamentos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.logs_webhook;
ALTER PUBLICATION supabase_realtime ADD TABLE public.logs_auditoria;