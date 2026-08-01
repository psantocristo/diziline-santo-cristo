import { supabase } from '@/integrations/supabase/client';

interface AuditoriaParams {
  acao: string;
  entidade?: string;
  entidade_id?: string;
  detalhes?: Record<string, any>;
}

export async function registrarAuditoria({ acao, entidade, entidade_id, detalhes }: AuditoriaParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('logs_auditoria').insert({
      acao,
      entidade: entidade || null,
      entidade_id: entidade_id || null,
      detalhes: detalhes || null,
      user_id: user.id,
      user_agent: navigator.userAgent,
    } as any);
  } catch {
    // Falha silenciosa — não deve interromper o fluxo principal
  }
}
