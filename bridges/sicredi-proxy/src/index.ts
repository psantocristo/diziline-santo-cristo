/**
 * Proxy mTLS Sicredi — Cloudflare Worker
 *
 * As Edge Functions do Supabase (Deno Deploy) não conseguem enviar certificado
 * de cliente (mTLS) exigido pela API PIX do Sicredi. Este Worker faz esse papel:
 *
 *   Edge Function ──(x-proxy-secret)──► Worker ──(mTLS)──► api-pix.sicredi.com.br
 *
 * Deploy: `npx wrangler deploy` (ver README.md).
 */

export interface Env {
  /** Binding mTLS configurado em wrangler.toml ([[mtls_certificates]]). */
  SICREDI_CERT: Fetcher;
  /** Segredo compartilhado com a Edge Function (`wrangler secret put PROXY_SECRET`). */
  PROXY_SECRET: string;
  /** Ex.: https://api-pix.sicredi.com.br  (homologação: https://api-pix-h.sicredi.com.br) */
  SICREDI_HOST: string;
}

/** Somente estes caminhos são repassados ao Sicredi. */
const ALLOWED = [
  /^\/oauth\/token$/,
  /^\/auth\/oauth\/v2\/token$/,
  /^\/api\/v2\/cob(\/|$)/,
  /^\/api\/v2\/cobv(\/|$)/,
  /^\/api\/v2\/pix(\/|$)/,
  /^\/api\/v2\/loc(\/|$)/,
  /^\/api\/v2\/webhook(\/|$)/,
];

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // 1) Autenticação entre Edge Function ↔ Worker
    const provided = req.headers.get('x-proxy-secret') || '';
    if (!env.PROXY_SECRET || !timingSafeEqual(provided, env.PROXY_SECRET)) {
      return json({ error: 'forbidden' }, 403);
    }

    // 2) Health-check usado pelo painel /admin/diagnostico
    if (url.pathname === '/status') {
      return json({ ok: true, host: env.SICREDI_HOST, ts: new Date().toISOString() });
    }

    // 3) Allowlist de rotas
    if (!ALLOWED.some((re) => re.test(url.pathname))) {
      return json({ error: 'path not allowed', path: url.pathname }, 404);
    }

    // 4) Repasse com certificado de cliente
    const target = env.SICREDI_HOST.replace(/\/$/, '') + url.pathname + url.search;
    const headers = new Headers(req.headers);
    headers.delete('x-proxy-secret');
    headers.delete('host');
    headers.delete('cf-connecting-ip');

    try {
      const upstream = await env.SICREDI_CERT.fetch(target, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer(),
      });

      const out = new Headers(upstream.headers);
      out.delete('content-encoding');
      out.delete('content-length');
      return new Response(upstream.body, { status: upstream.status, headers: out });
    } catch (e: any) {
      return json({ error: 'upstream_error', detail: String(e?.message || e) }, 502);
    }
  },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
