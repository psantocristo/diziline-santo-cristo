import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { pin } = await req.json()

    if (!pin || typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) {
      return new Response(JSON.stringify({ valid: false, error: 'PIN inválido' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data, error } = await supabase
      .from('configuracoes_paroquia')
      .select('pin_totem')
      .limit(1)
      .maybeSingle()

    if (error) throw error

    // Se não há PIN configurado, o totem está aberto (sem restrição)
    if (!data || !data.pin_totem) {
      return new Response(JSON.stringify({ valid: true, sem_pin: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const valid = data.pin_totem === pin

    return new Response(JSON.stringify({ valid }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('Erro no totem-pin:', err)
    return new Response(JSON.stringify({ valid: false, error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
