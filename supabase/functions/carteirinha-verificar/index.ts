// Verifica token assinado da carteirinha e retorna dados públicos do dizimista.
// Endpoint PÚBLICO — não exige JWT. Valida HMAC + expiração.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VERSION = 'v1';

function b64urlDecodeToBytes(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const str = atob(b64);
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i);
  return out;
}

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

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const token = url.searchParams.get('t');
  if (!token) {
    return new Response(JSON.stringify({ valid: false, error: 'missing_token' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const secret = Deno.env.get('CARTEIRINHA_HMAC_SECRET');
  if (!secret) {
    return new Response(JSON.stringify({ valid: false, error: 'missing_secret' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== VERSION) {
    return new Response(JSON.stringify({ valid: false, error: 'invalid_format' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const [ver, payloadB64, sig] = parts;
  const signingInput = `${ver}.${payloadB64}`;
  const expectedSig = await hmacSign(secret, signingInput);
  if (!timingSafeEq(expectedSig, sig)) {
    return new Response(JSON.stringify({ valid: false, error: 'bad_signature' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload: { v: number; sub: string; mp?: string; iat: number; exp: number };
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecodeToBytes(payloadB64)));
  } catch {
    return new Response(JSON.stringify({ valid: false, error: 'invalid_payload' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) {
    return new Response(JSON.stringify({ valid: false, error: 'expired' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (payload.v !== 1 || !payload.sub) {
    return new Response(JSON.stringify({ valid: false, error: 'invalid_payload' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: p } = await admin
    .from('paroquianos')
    .select('id, nome_completo, matricula_paroquial, status, data_inicio_dizimista, foto_url, comunidade_id')
    .eq('id', payload.sub)
    .maybeSingle();

  if (!p) {
    return new Response(JSON.stringify({ valid: false, error: 'not_found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Sanity: matricula no token deve bater com a do banco (impede reciclagem após reemissão)
  if (payload.mp && payload.mp !== p.matricula_paroquial) {
    return new Response(JSON.stringify({ valid: false, error: 'revoked' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let comunidade: string | null = null;
  if (p.comunidade_id) {
    const { data: c } = await admin
      .from('comunidades').select('nome').eq('id', p.comunidade_id).maybeSingle();
    comunidade = c?.nome ?? null;
  }

  let fotoSigned: string | null = null;
  if (p.foto_url) {
    const path = p.foto_url.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/(public|sign)\/avatares-paroquianos\//, '');
    const { data } = await admin.storage.from('avatares-paroquianos').createSignedUrl(path, 60 * 10);
    fotoSigned = data?.signedUrl ?? null;
  }

  const { data: paroquia } = await admin
    .from('configuracoes_paroquia').select('nome, site, logo_url').limit(1).maybeSingle();

  return new Response(JSON.stringify({
    valid: true,
    emitido_em: payload.iat,
    expira_em: payload.exp,
    dizimista: {
      id: p.id,
      nome_completo: p.nome_completo,
      matricula_paroquial: p.matricula_paroquial,
      status: p.status,
      data_inicio_dizimista: p.data_inicio_dizimista,
      foto_url: fotoSigned,
      comunidade: comunidade,
    },
    paroquia: paroquia ?? null,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
});
