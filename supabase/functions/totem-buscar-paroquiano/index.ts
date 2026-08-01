import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, clientIdFromRequest } from '../_shared/rate-limit.ts'

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

    // Rate-limit: até 30 buscas/min por IP (protege CPF/matricula contra enumeração)
    const rlOk = await checkRateLimit(supabase, 'totem-buscar-paroquiano', clientIdFromRequest(req), 30, 60)
    if (!rlOk) {
      return new Response(JSON.stringify({ error: 'Muitas requisições. Tente novamente em instantes.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { valor } = await req.json()

    if (!valor || typeof valor !== 'string' || valor.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Parâmetros inválidos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const digits = valor.replace(/\D/g, '')

    if (digits.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum dígito informado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let query = supabase
      .from('paroquianos')
      .select('id, nome_completo, valor_sugerido, matricula_paroquial')
      .eq('status', 'ativo')
      .limit(1)

    let modo: string

    if (digits.length === 11) {
      // Auto-detect: 11 dígitos = CPF
      modo = 'cpf'
      query = query.eq('cpf', digits)
    } else {
      // Qualquer outra quantidade = código de matrícula
      modo = 'matricula'
      const matricula = 'DIZSC-' + digits
      query = query.eq('matricula_paroquial', matricula)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      console.error('Erro ao buscar paroquiano:', error)
      return new Response(JSON.stringify({ error: 'Erro interno ao buscar' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!data) {
      return new Response(JSON.stringify({
        encontrado: false,
        modo,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      encontrado: true,
      modo,
      paroquiano: {
        id: data.id,
        nome_completo: data.nome_completo,
        valor_sugerido: data.valor_sugerido,
        matricula_paroquial: data.matricula_paroquial,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('Erro no totem-buscar-paroquiano:', err)
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
