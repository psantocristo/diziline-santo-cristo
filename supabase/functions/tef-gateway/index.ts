import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { tefCreatePayment, tefCheckStatus, tefTestConnection } from '../_shared/tef-providers.ts'

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
      return jsonResp({ success: false, error: 'Unauthorized' }, 401, corsHeaders)
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(token)
    if (claimsErr || !claimsData?.claims) {
      return jsonResp({ success: false, error: 'Unauthorized' }, 401, corsHeaders)
    }

    const userId = claimsData.claims.sub as string

    // Verificar role (totem, admin ou super_admin)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['totem', 'admin', 'super_admin'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const userRole = roleData?.role ?? null

    if (!userRole) {
      return jsonResp({ success: false, error: 'Forbidden' }, 403, corsHeaders)
    }

    const body = await req.json()
    const { action } = body

    // Buscar configuração TEF
    const { data: config, error: cfgErr } = await supabase
      .from('configuracoes_tef')
      .select('*')
      .limit(1)
      .single()

    if (cfgErr || !config) {
      return jsonResp({ success: false, message: 'Configurações TEF não encontradas' }, 500, corsHeaders)
    }

    if (action === 'get-config') {
      // SEGURANÇA: NÃO expor middleware_token ao frontend
      return jsonResp({
        success: true,
        config: {
          modo: config.modo,
          timeout_segundos: config.timeout_segundos,
          // Apenas informações não-sensíveis
          credito_ativo: config.credito_ativo,
          debito_ativo: config.debito_ativo,
        },
      }, 200, corsHeaders)
    }

    if (action === 'test-connection') {
      // Somente super_admin pode testar conexão
      if (userRole !== 'super_admin') {
        return jsonResp({ success: false, error: 'Forbidden: apenas super_admin' }, 403, corsHeaders)
      }
      return await testarConexao(supabase, config, corsHeaders)
    }

    if (action === 'create-payment') {
      return await criarPagamento(supabase, config, body, corsHeaders)
    }

    if (action === 'check-status') {
      return await verificarStatus(supabase, config, body, corsHeaders)
    }

    if (action === 'update-payment') {
      // Somente admin/super_admin pode atualizar manualmente
      if (userRole !== 'admin' && userRole !== 'super_admin') {
        return jsonResp({ success: false, error: 'Forbidden: sem permissão para atualizar' }, 403, corsHeaders)
      }
      return await atualizarPagamento(supabase, body, corsHeaders)
    }

    if (action === 'log-tef') {
      return await logTef(supabase, body, corsHeaders)
    }

    return jsonResp({ success: false, message: `Ação desconhecida: ${action}` }, 400, corsHeaders)

  } catch (err: any) {
    console.error('Erro no tef-gateway:', err.message)
    return jsonResp({ success: false, message: err.message || 'Erro interno' }, 500, corsHeaders)
  }
})

function jsonResp(data: any, status = 200, corsHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function logTef(supabase: any, body: any, corsHeaders: Record<string, string>) {
  const { tipo, mensagem, detalhes, pagamento_id } = body

  if (!mensagem) {
    return jsonResp({ success: false, message: 'mensagem obrigatória' }, 400, corsHeaders)
  }

  await supabase.from('logs_terminal').insert({
    tipo: tipo || 'info',
    origem: 'tef-local',
    mensagem,
    detalhes: detalhes || null,
    pagamento_id: pagamento_id || null,
  })

  return jsonResp({ success: true }, 200, corsHeaders)
}

async function testarConexao(supabase: any, config: any, corsHeaders: Record<string, string>) {
  if (config.modo === 'simulacao') {
    await supabase.from('configuracoes_tef').update({
      status_conexao: 'conectado',
      ultimo_teste: new Date().toISOString(),
    }).eq('id', config.id)

    return jsonResp({
      success: true,
      status: 'conectado',
      message: 'Modo simulação — conexão simulada com sucesso',
      simulacao: true,
    }, 200, corsHeaders)
  }

  const result = await tefTestConnection(config)
  await supabase.from('configuracoes_tef').update({
    status_conexao: result.ok ? 'conectado' : 'erro',
    ultimo_teste: new Date().toISOString(),
  }).eq('id', config.id)
  return jsonResp({
    success: result.ok,
    status: result.ok ? 'conectado' : 'erro',
    message: result.message,
    provedor_tef: config.provedor_tef || 'connect_tef',
  }, 200, corsHeaders)
}

async function criarPagamento(supabase: any, config: any, body: any, corsHeaders: Record<string, string>) {
  const { pagamento_id } = body

  if (!pagamento_id) return jsonResp({ success: false, message: 'pagamento_id obrigatório' }, 400, corsHeaders)

  const { data: pagamento, error: pagErr } = await supabase
    .from('pagamentos')
    .select('id, status, origem, valor, metodo, tipo')
    .eq('id', pagamento_id)
    .in('origem', ['totem', 'maquininha'])
    .maybeSingle()

  if (pagErr || !pagamento) return jsonResp({ success: false, message: 'Pagamento não encontrado' }, 404, corsHeaders)
  if (pagamento.status !== 'aguardando_pagamento') return jsonResp({ success: false, message: 'Pagamento já processado' }, 400, corsHeaders)

  if (config.modo === 'simulacao') {
    const tefId = `SIM_TEF_${Date.now()}`
    await supabase.from('pagamentos').update({
      gateway_id: tefId,
      gateway_status: 'simulacao_aguardando_maquininha',
      provedor: `tef:${config.provedor_tef || 'connect_tef'}`,
    }).eq('id', pagamento.id)

    return jsonResp({ success: true, simulacao: true, tef_transaction_id: tefId, message: 'Pagamento enviado para maquininha (simulação)' }, 200, corsHeaders)
  }

  const r = await tefCreatePayment(config, {
    amount: Math.round(Number(pagamento.valor) * 100),
    type: pagamento.metodo === 'credito' ? 'credit' : 'debit',
    installments: 1,
    reference: pagamento.id,
    terminalId: config.terminal_id || undefined,
  })
  if (!r.success) return jsonResp({ success: false, message: r.message }, 500, corsHeaders)
  const tefId = r.transactionId || `TEF_${Date.now()}`
  await supabase.from('pagamentos').update({
    gateway_id: tefId,
    gateway_status: 'aguardando_maquininha',
    gateway_payload: r.raw,
    provedor: `tef:${config.provedor_tef || 'connect_tef'}`,
  }).eq('id', pagamento.id)
  return jsonResp({
    success: true,
    tef_transaction_id: tefId,
    message: 'Pagamento enviado para maquininha',
    provedor_tef: config.provedor_tef || 'connect_tef',
  }, 200, corsHeaders)
}

async function verificarStatus(supabase: any, config: any, body: any, corsHeaders: Record<string, string>) {
  const { pagamento_id, tef_transaction_id } = body

  if (!pagamento_id) return jsonResp({ success: false, message: 'pagamento_id obrigatório' }, 400, corsHeaders)

  if (config.modo === 'simulacao') {
    const { data: pagamento } = await supabase
      .from('pagamentos')
      .select('id, status, gateway_id, created_at')
      .eq('id', pagamento_id)
      .maybeSingle()

    if (!pagamento) return jsonResp({ success: false, message: 'Pagamento não encontrado' }, 404, corsHeaders)
    if (pagamento.status === 'pago') return jsonResp({ success: true, status: 'aprovado', message: 'Pagamento já confirmado' }, 200, corsHeaders)

    const diffSec = (Date.now() - new Date(pagamento.created_at).getTime()) / 1000
    if (diffSec >= 5) {
      const pagoEm = new Date().toISOString()
      await supabase.from('pagamentos').update({
        status: 'pago',
        pago_em: pagoEm,
        gateway_status: 'simulacao_aprovado_maquininha',
      }).eq('id', pagamento.id)
      return jsonResp({ success: true, status: 'aprovado', simulacao: true, pago_em: pagoEm, message: 'Pagamento aprovado na maquininha (simulação)' }, 200, corsHeaders)
    }

    return jsonResp({ success: true, status: 'aguardando', simulacao: true, message: 'Aguardando pagamento na maquininha (simulação)' }, 200, corsHeaders)
  }

  const txId = tef_transaction_id || pagamento_id
  const r = await tefCheckStatus(config, txId)
  if (!r.success) return jsonResp({ success: false, message: r.message }, 500, corsHeaders)

  if (r.status === 'aprovado') {
    const pagoEm = new Date().toISOString()
    await supabase.from('pagamentos').update({
      status: 'pago',
      pago_em: pagoEm,
      gateway_status: 'aprovado_maquininha',
      gateway_payload: r.raw,
    }).eq('id', pagamento_id)
    return jsonResp({ success: true, status: 'aprovado', pago_em: pagoEm }, 200, corsHeaders)
  }
  if (r.status === 'recusado') {
    await supabase.from('pagamentos').update({
      status: 'cancelado',
      gateway_status: 'recusado_maquininha',
      gateway_payload: r.raw,
    }).eq('id', pagamento_id)
    return jsonResp({ success: false, status: 'recusado', message: r.message || 'Pagamento recusado na maquininha' }, 200, corsHeaders)
  }
  return jsonResp({ success: true, status: 'aguardando', message: 'Aguardando pagamento na maquininha' }, 200, corsHeaders)
}

async function atualizarPagamento(supabase: any, body: any, corsHeaders: Record<string, string>) {
  const { pagamento_id, updates } = body

  if (!pagamento_id || !updates) return jsonResp({ success: false, message: 'pagamento_id e updates obrigatórios' }, 400, corsHeaders)

  // Verificar que o pagamento não está em estado final irreversível
  const { data: existing } = await supabase
    .from('pagamentos')
    .select('status')
    .eq('id', pagamento_id)
    .maybeSingle()

  if (existing?.status === 'pago') {
    return jsonResp({ success: false, message: 'Pagamento já confirmado, não pode ser alterado' }, 400, corsHeaders)
  }

  const allowedFields = ['status', 'pago_em', 'gateway_id', 'gateway_status', 'gateway_payload', 'cancelado_em']
  const safeUpdates: Record<string, any> = {}
  for (const key of allowedFields) {
    if (updates[key] !== undefined) safeUpdates[key] = updates[key]
  }

  if (Object.keys(safeUpdates).length === 0) return jsonResp({ success: false, message: 'Nenhum campo válido para atualizar' }, 400, corsHeaders)

  const { error } = await supabase
    .from('pagamentos')
    .update(safeUpdates)
    .eq('id', pagamento_id)

  if (error) return jsonResp({ success: false, message: error.message }, 500, corsHeaders)
  return jsonResp({ success: true, message: 'Pagamento atualizado' }, 200, corsHeaders)
}
