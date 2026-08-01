import { supabase } from '@/integrations/supabase/client';

/**
 * Solicita um token assinado (HMAC) da carteirinha de um dizimista.
 * Esse token é o que vai dentro do QR Code (URL pública /v/<token>).
 */
export async function gerarTokenCarteirinha(paroquianoId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('carteirinha-token', {
    body: { paroquiano_id: paroquianoId },
  });
  if (error) throw error;
  if (!data?.token) throw new Error('Falha ao gerar token da carteirinha');
  return data.token as string;
}

export function urlVerificacaoCarteirinha(token: string): string {
  return `${window.location.origin}/v/${token}`;
}
