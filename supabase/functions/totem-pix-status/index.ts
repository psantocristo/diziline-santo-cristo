import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProviderId, providerGetStatus } from '../_shared/payment-providers.ts'
import { checkRateLimit, clientIdFromRequest } from '../_shared/rate-limit.ts'

const ALLOWED_ORIGINS = [
  'https://dizimosc.lovable.app',
  'https://dizimo.paroquiasantocristo.com.br',
  'https://id-preview--be297df8-e844-4a40-996f-6d06ce5ac690.lovable.app',
  'http://localhost:5173',
  'http://localhost:8080',
]

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // ── Autenticação JWT ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(token)
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Service role para operações
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Rate-limit: até 120 consultas/min por IP (polling agressivo do totem)
    const rlOk = await checkRateLimit(supabase, 'totem-pix-status', clientIdFromRequest(req), 120, 60)
    if (!rlOk) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { pagamento_id, incluir_qrcode } = await req.json()

    if (!pagamento_id) {
      return new Response(JSON.stringify({ error: 'pagamento_id obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const campos = incluir_qrcode
      ? 'id, status, gateway_id, gateway_status, pago_em, origem, pix_qrcode, pix_copia_cola'
      : 'id, status, gateway_id, gateway_status, pago_em, origem'

    const { data: pagamento, error: pagErr } = await supabase
      .from('pagamentos')
      .select(campos)
      .eq('id', pagamento_id)
      .eq('origem', 'totem')
      .maybeSingle()

    if (pagErr || !pagamento) {
      return new Response(JSON.stringify({ error: 'Pagamento não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (pagamento.status === 'pago') {
      return new Response(JSON.stringify({
        status: 'pago',
        pago_em: pagamento.pago_em,
        ...(incluir_qrcode && { pix_qrcode: pagamento.pix_qrcode, pix_copia_cola: pagamento.pix_copia_cola }),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Se há gateway_id real, consultar status na Rede
    if (pagamento.gateway_id && !pagamento.gateway_id.startsWith('SIM_')) {
      const { data: config } = await supabase
        .from('configuracoes_gateway')
        .select('*')
        .limit(1)
        .single()

      if (config && config.modo !== 'simulacao') {
        // Dispatcher para provedores alternativos
        const provId = getProviderId(config)
        if (provId !== 'rede') {
          const r = await providerGetStatus(config, pagamento.gateway_id)
          if (r.status === 'pago') {
            const pagoEm = new Date().toISOString()
            await supabase.from('pagamentos').update({
              status: 'pago', pago_em: pagoEm, gateway_status: 'aprovado', provedor: provId,
            }).eq('id', pagamento_id)
            return new Response(JSON.stringify({ status: 'pago', pago_em: pagoEm }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          return new Response(JSON.stringify({
            status: r.status === 'cancelado' ? 'cancelado' : 'aguardando',
            gateway_status: r.status,
            provedor: provId,
            ...(incluir_qrcode && { pix_qrcode: pagamento.pix_qrcode, pix_copia_cola: pagamento.pix_copia_cola }),
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        try {
          const oauthUrl = config.modo === 'producao'
            ? (config.oauth_url_producao || 'https://api.userede.com.br/redelabs/oauth2/token')
            : (config.oauth_url_sandbox || 'https://rl7-sandbox-api.useredecloud.com.br/oauth2/token')

          const credentials = btoa(`${config.client_id}:${config.client_secret}`)
          const tokenResp = await fetch(oauthUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${credentials}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'grant_type=client_credentials',
          })

          if (tokenResp.ok) {
            const tokenData = await tokenResp.json()
            const accessToken = tokenData.access_token

            const baseUrl = config.modo === 'producao'
              ? (config.producao_url || 'https://api.userede.com.br/erede')
              : (config.sandbox_url || 'https://sandbox-erede.useredecloud.com.br')

            const statusResp = await fetch(`${baseUrl}/v2/transactions/${pagamento.gateway_id}`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            })

            if (statusResp.ok) {
              const statusData = await statusResp.json()
              const gatewayStatus = statusData.pix?.status || statusData.status

              if (['PAID', 'APPROVED', 'CONCLUIDO', 'COMPLETED'].includes(String(gatewayStatus).toUpperCase())) {
                const pagoEm = new Date().toISOString()
                await supabase
                  .from('pagamentos')
                  .update({ status: 'pago', pago_em: pagoEm, gateway_status: gatewayStatus })
                  .eq('id', pagamento_id)

                return new Response(JSON.stringify({ status: 'pago', pago_em: pagoEm }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
              }

              return new Response(JSON.stringify({
                status: 'aguardando',
                gateway_status: gatewayStatus,
                ...(incluir_qrcode && { pix_qrcode: pagamento.pix_qrcode, pix_copia_cola: pagamento.pix_copia_cola }),
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              })
            }
          }
        } catch (_) {
          // Falha ao consultar Rede — retornar status atual do banco
        }
      }
    }

    return new Response(JSON.stringify({
      status: pagamento.status,
      gateway_status: pagamento.gateway_status,
      ...(incluir_qrcode && { pix_qrcode: pagamento.pix_qrcode, pix_copia_cola: pagamento.pix_copia_cola }),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('Erro no totem-pix-status:', err.message)
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
