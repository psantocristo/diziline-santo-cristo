/**
 * Rate-limit simples baseado em tabela `edge_rate_limits`.
 * Uso típico:
 *   const ok = await checkRateLimit(supabase, 'totem-pix-status', clientIp, 30, 60)
 *   if (!ok) return new Response('Too Many Requests', { status: 429 })
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function checkRateLimit(
  supabase: SupabaseClient,
  bucket: string,
  key: string,
  maxHits: number,
  windowSeconds: number,
): Promise<boolean> {
  if (!key) key = 'unknown'
  const now = new Date()
  const cutoff = new Date(now.getTime() - windowSeconds * 1000).toISOString()

  // Tenta carregar o bucket atual
  const { data: row } = await supabase
    .from('edge_rate_limits')
    .select('hits, window_start')
    .eq('bucket', bucket)
    .eq('key', key)
    .maybeSingle()

  // Sem registro ou janela expirada → recomeça
  if (!row || row.window_start < cutoff) {
    await supabase.from('edge_rate_limits').upsert({
      bucket, key, hits: 1, window_start: now.toISOString(),
    }, { onConflict: 'bucket,key' })
    return true
  }

  if (row.hits >= maxHits) return false

  await supabase
    .from('edge_rate_limits')
    .update({ hits: row.hits + 1 })
    .eq('bucket', bucket)
    .eq('key', key)
  return true
}

/** Extrai o melhor identificador do cliente para chave de rate-limit. */
export function clientIdFromRequest(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') || ''
  const ip = xff.split(',')[0]?.trim()
  return ip || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'anon'
}