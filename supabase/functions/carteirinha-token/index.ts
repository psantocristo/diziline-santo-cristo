// Emite token HMAC assinado para a carteirinha do dizimista.
// Requer autenticação. O próprio dizimista (dono) ou admin/super_admin pode emitir.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VERSION = 'v1';
const TTL_SECONDS = 60 * 60 * 24 * 365 * 5; // 5 anos

function b64urlEncode(bytes: Uint8Array): string {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return b64urlEncode(new Uint8Array(sig));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const hmacSecret = Deno.env.get('CARTEIRINHA_HMAC_SECRET');
  if (!hmacSecret) {
    return new Response(JSON.stringify({ error: 'missing_secret' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sbAuth = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace('Bearer ', '');
  const { data: claims, error: cErr } = await sbAuth.auth.getClaims(token);
  if (cErr || !claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userId = claims.claims.sub as string;

  let body: { paroquiano_id?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  if (!body.paroquiano_id || typeof body.paroquiano_id !== 'string') {
    return new Response(JSON.stringify({ error: 'paroquiano_id obrigatório' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: paroquiano, error: pErr } = await admin
    .from('paroquianos')
    .select('id, user_id, matricula_paroquial, status')
    .eq('id', body.paroquiano_id)
    .maybeSingle();

  if (pErr || !paroquiano) {
    return new Response(JSON.stringify({ error: 'paroquiano_nao_encontrado' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Autorização: dono OU admin/super_admin
  const { data: roles } = await admin
    .from('user_roles').select('role').eq('user_id', userId);
  const isAdmin = (roles || []).some((r: any) => r.role === 'admin' || r.role === 'super_admin');
  const isOwner = paroquiano.user_id === userId;
  if (!isAdmin && !isOwner) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    sub: paroquiano.id,
    mp: paroquiano.matricula_paroquial,
    iat: now,
    exp: now + TTL_SECONDS,
  };
  const payloadB64 = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${VERSION}.${payloadB64}`;
  const sig = await hmacSign(hmacSecret, signingInput);
  const fullToken = `${signingInput}.${sig}`;

  return new Response(JSON.stringify({ token: fullToken, exp: payload.exp }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
