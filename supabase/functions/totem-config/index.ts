import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Se houver usuário autenticado, tenta identificar o totem vinculado.
    // Sem autenticação, retorna apenas a configuração global para não bloquear o totem público.
    let userId: string | null = null;
    if (authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id ?? null;
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Fetch all configs in parallel using service_role (bypasses RLS)
    const [totemRes, gwRes, tefRes] = await Promise.all([
      userId
        ? adminClient.from("totens").select("id, pix_ativo, credito_ativo, debito_ativo, tef_ativo").eq("user_id", userId).eq("ativo", true).limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      adminClient.from("configuracoes_gateway").select("pix_ativo, credito_ativo, debito_ativo").limit(1).maybeSingle(),
      adminClient.from("configuracoes_tef").select("ativo, credito_ativo, debito_ativo").limit(1).maybeSingle(),
    ]);

    const totem = totemRes.data;
    const gw = gwRes.data;
    const tef = tefRes.data;

    // Global gateway settings
    const globalPix = gw?.pix_ativo ?? true;
    const globalCredito = gw?.credito_ativo ?? true;
    const globalDebito = gw?.debito_ativo ?? true;
    const globalTef = tef?.ativo === true;

    // Per-totem overrides (if totem exists)
    const totemPix = totem?.pix_ativo ?? true;
    const totemCredito = totem?.credito_ativo ?? true;
    const totemDebito = totem?.debito_ativo ?? true;
    const totemTef = totem?.tef_ativo ?? false;

    return new Response(JSON.stringify({
      // Online methods: global AND per-totem must both be active
      pix_ativo: globalPix && totemPix,
      credito_ativo: globalCredito && totemCredito,
      debito_ativo: globalDebito && totemDebito,
      // TEF: controlled only by per-totem setting (global TEF config is for middleware connection, not visibility)
      tef_ativo: totemTef,
      tef_credito_ativo: tef?.credito_ativo ?? true,
      tef_debito_ativo: tef?.debito_ativo ?? true,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
