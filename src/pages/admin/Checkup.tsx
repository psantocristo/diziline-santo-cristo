import React, { useCallback, useState } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  CheckCircle2, XCircle, AlertTriangle, Loader2, PlayCircle, Circle,
  Database, Cloud, HardDrive, Radio, Bell, ClipboardList, ChevronDown,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   /admin/checkup — Página de verificação da instalação
   Roda os testes AUTOMÁTICOS de plataforma (banco, RPCs, storage,
   edge functions, realtime, push) e lista os passos MANUAIS que
   precisam ser feitos fora do app (Supabase/Cloudflare/provedores).
   Nenhum teste aqui grava dados nem dispara cobrança real.
   ───────────────────────────────────────────────────────────── */

type Status = 'idle' | 'running' | 'pass' | 'warn' | 'fail';

interface CheckResult { status: Status; message: string }

interface Check {
  id: string;
  group: string;
  label: string;
  /** O que este teste valida e o que fazer se falhar. */
  descricao: string;
  run: () => Promise<CheckResult>;
}

const ok = (message: string): CheckResult => ({ status: 'pass', message });
const warn = (message: string): CheckResult => ({ status: 'warn', message });
const fail = (message: string): CheckResult => ({ status: 'fail', message });

/** Invoca uma edge function e considera "deployada" mesmo se retornar erro de negócio. */
async function pingFunction(name: string, body: Record<string, unknown>): Promise<CheckResult> {
  try {
    const { error } = await supabase.functions.invoke(name, { body });
    if (error) {
      const msg = String(error.message || error);
      if (/Failed to send a request|Failed to fetch|not found|404/i.test(msg)) {
        return fail(`Função "${name}" não respondeu — verifique o deploy`);
      }
      return warn(`Função "${name}" respondeu com erro: ${msg.slice(0, 120)}`);
    }
    return ok(`Função "${name}" respondendo`);
  } catch (e: any) {
    return fail(`Função "${name}" indisponível: ${e?.message ?? e}`);
  }
}

const CHECKS: Check[] = [
  // ── Banco de dados ──────────────────────────────────────────
  {
    id: 'db-conn',
    group: 'Banco de dados',
    label: 'Conexão com o Supabase',
    descricao:
      'Faz uma leitura simples para confirmar que a URL e a chave publicável (anon) do projeto estão corretas no build. Se falhar, revise as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY e refaça o deploy.',
    run: async () => {
      const t0 = Date.now();
      const { error } = await supabase.from('configuracoes_paroquia').select('id').limit(1);
      if (error) return fail(error.message);
      return ok(`Conectado (${Date.now() - t0}ms)`);
    },
  },
  {
    id: 'db-config',
    group: 'Banco de dados',
    label: 'Configuração da paróquia criada',
    descricao:
      'Verifica se existe uma linha em configuracoes_paroquia — é ela que guarda nome, CNPJ, logos, cores e PIN do totem. Criada automaticamente pela função setup_nova_paroquia ou manualmente em Configurações.',
    run: async () => {
      const { data, error } = await supabase.from('configuracoes_paroquia').select('id, nome').limit(1).maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail('Nenhuma linha em configuracoes_paroquia — rode setup_nova_paroquia');
      if (!data.nome) return warn('Linha existe, mas o nome da paróquia está vazio');
      return ok(`Paróquia: ${data.nome}`);
    },
  },
  {
    id: 'db-super-admin',
    group: 'Banco de dados',
    label: 'Existe ao menos um super admin',
    descricao:
      'Conta os registros com papel super_admin em user_roles. Sem ele ninguém acessa Configurações, Totens, Diagnóstico e Auditoria. Criado por setup_nova_paroquia após o usuário existir em Authentication → Users.',
    run: async () => {
      const { count, error } = await supabase
        .from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'super_admin');
      if (error) return fail(error.message);
      if (!count) return fail('Nenhum super_admin cadastrado');
      return ok(`${count} super admin(s)`);
    },
  },
  {
    id: 'db-seed',
    group: 'Banco de dados',
    label: 'Dados iniciais (comunidades e categorias)',
    descricao:
      'Confere se a comunidade padrão e as categorias de contribuição foram semeadas. Sem elas o cadastro de dizimista e o totem ficam sem opções para selecionar.',
    run: async () => {
      const [com, cat] = await Promise.all([
        supabase.from('comunidades').select('id', { count: 'exact', head: true }),
        supabase.from('categorias_pagamento').select('id', { count: 'exact', head: true }),
      ]);
      if (com.error || cat.error) return fail(com.error?.message || cat.error!.message);
      if (!com.count) return fail('Nenhuma comunidade cadastrada');
      if (!cat.count) return warn('Nenhuma categoria de pagamento cadastrada');
      return ok(`${com.count} comunidade(s) · ${cat.count} categoria(s)`);
    },
  },
  {
    id: 'db-gateway-row',
    group: 'Banco de dados',
    label: 'Configuração de gateway e TEF',
    descricao:
      'Verifica se existem as linhas de configuracoes_gateway (pagamento online) e configuracoes_tef (maquininha). Elas são criadas desativadas e devem ser preenchidas em Configurações antes de operar.',
    run: async () => {
      const [g, t] = await Promise.all([
        supabase.from('configuracoes_gateway').select('provedor, ativo').limit(1).maybeSingle(),
        supabase.from('configuracoes_tef').select('provedor_tef, ativo').limit(1).maybeSingle(),
      ]);
      if (g.error || t.error) return fail(g.error?.message || t.error!.message);
      if (!g.data) return fail('configuracoes_gateway vazia');
      if (!t.data) return warn('configuracoes_tef vazia — maquininha não vai funcionar');
      const partes = [
        `Gateway: ${g.data.provedor}${g.data.ativo ? ' (ativo)' : ' (inativo)'}`,
        `TEF: ${t.data.provedor_tef}${t.data.ativo ? ' (ativo)' : ' (inativo)'}`,
      ];
      if (!g.data.ativo && !t.data.ativo) return warn(partes.join(' · '));
      return ok(partes.join(' · '));
    },
  },

  // ── Funções SQL ─────────────────────────────────────────────
  {
    id: 'rpc-paroquia',
    group: 'Funções SQL (RPC)',
    label: 'get_paroquia_publica',
    descricao:
      'Função usada na carteirinha, no totem e nas páginas públicas para ler nome, logos e cores sem expor a tabela inteira. Se falhar, a migration correspondente não foi aplicada ou faltou GRANT EXECUTE.',
    run: async () => {
      const { data, error } = await supabase.rpc('get_paroquia_publica');
      if (error) return fail(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return warn('Função existe, mas não retornou dados');
      return ok(`Retornou "${(row as any).nome ?? 'sem nome'}"`);
    },
  },
  {
    id: 'rpc-tema',
    group: 'Funções SQL (RPC)',
    label: 'get_tema_paroquia',
    descricao:
      'Alimenta o tema visual (cores, logo, slogan, cadastro aberto) carregado no boot do app. Se falhar, o app cai para o tema padrão.',
    run: async () => {
      const { error } = await supabase.rpc('get_tema_paroquia');
      if (error) return fail(error.message);
      return ok('Tema carregado');
    },
  },
  {
    id: 'rpc-loja',
    group: 'Funções SQL (RPC)',
    label: 'get_loja_config',
    descricao: 'Indica se o módulo Loja está habilitado para o totem e para o app do dizimista.',
    run: async () => {
      const { data, error } = await supabase.rpc('get_loja_config');
      if (error) return fail(error.message);
      const ativa = (data as any)?.loja_ativa;
      return ok(`Loja ${ativa ? 'ativa' : 'desativada'}`);
    },
  },
  {
    id: 'rpc-dashboard',
    group: 'Funções SQL (RPC)',
    label: 'get_dashboard_resumo',
    descricao:
      'Agrega os números do painel administrativo (totais do mês, PIX x cartão, campanhas, série de 12 meses). Exige usuário autenticado com papel administrativo.',
    run: async () => {
      const { error } = await supabase.rpc('get_dashboard_resumo', { _comunidade_id: null });
      if (error) return fail(error.message);
      return ok('Resumo do dashboard calculado');
    },
  },
  {
    id: 'rpc-gateway-metrics',
    group: 'Funções SQL (RPC)',
    label: 'get_gateway_metrics',
    descricao: 'Métricas de aprovação por provedor usadas no card de gateway do dashboard.',
    run: async () => {
      const { error } = await supabase.rpc('get_gateway_metrics', { _dias: 30 });
      if (error) return fail(error.message);
      return ok('Métricas disponíveis');
    },
  },

  // ── Storage ─────────────────────────────────────────────────
  {
    id: 'storage-buckets',
    group: 'Storage',
    label: 'Buckets de arquivos criados',
    descricao:
      'Confere os buckets usados por logos térmicos, banners de campanha, produtos, avisos do totem e fotos de dizimistas. O bucket de fotos (avatares-paroquianos) deve permanecer privado.',
    run: async () => {
      const esperados = ['logos-termicos', 'banners-campanhas', 'produtos', 'avisos-totem', 'avatares-paroquianos'];
      const { data, error } = await supabase.storage.listBuckets();
      if (error) return warn(`Não foi possível listar buckets: ${error.message}`);
      const nomes = (data ?? []).map(b => b.name);
      const faltando = esperados.filter(e => !nomes.includes(e));
      if (faltando.length) return fail(`Faltando: ${faltando.join(', ')}`);
      const privado = data!.find(b => b.name === 'avatares-paroquianos');
      if (privado?.public) return warn('Bucket avatares-paroquianos está PÚBLICO — deve ser privado');
      return ok(`${esperados.length} buckets presentes`);
    },
  },

  // ── Edge Functions ──────────────────────────────────────────
  {
    id: 'fn-totem-config',
    group: 'Edge Functions',
    label: 'totem-config',
    descricao:
      'Entrega ao totem a configuração de métodos de pagamento habilitados. É a função pública mais simples — se ela não responder, provavelmente nenhuma função foi deployada.',
    run: () => pingFunction('totem-config', {}),
  },
  {
    id: 'fn-gateway',
    group: 'Edge Functions',
    label: 'rede-gateway (teste de conexão)',
    descricao:
      'Executa apenas o handshake de credenciais do provedor ativo (Rede, Sicredi ou Pagar.me). Não cria cobrança. Se o gateway ainda não foi configurado, o resultado "aviso" é esperado.',
    run: () => pingFunction('rede-gateway', { action: 'test-connection' }),
  },
  {
    id: 'fn-tef',
    group: 'Edge Functions',
    label: 'tef-gateway',
    descricao:
      'Ponte com a maquininha/bridge local. Um aviso aqui costuma significar que o TEF ainda está desativado nas Configurações.',
    run: () => pingFunction('tef-gateway', { action: 'status' }),
  },
  {
    id: 'fn-carteirinha',
    group: 'Edge Functions',
    label: 'carteirinha-verificar',
    descricao:
      'Valida a assinatura HMAC do QR Code da carteirinha. O teste envia um token inválido de propósito: a resposta esperada é uma recusa — isso prova que a função está no ar e que o segredo está configurado.',
    run: async () => {
      const r = await pingFunction('carteirinha-verificar', { token: 'v1.checkup.invalido' });
      if (r.status === 'warn') return ok('Função no ar (token de teste recusado, como esperado)');
      return r;
    },
  },
  {
    id: 'fn-push',
    group: 'Edge Functions',
    label: 'push-subscribe',
    descricao:
      'Registra o dispositivo para notificações push. Depende dos segredos VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT estarem configurados no projeto.',
    run: async () => {
      const r = await pingFunction('push-subscribe', {});
      if (r.status === 'warn') return ok('Função no ar (payload de teste recusado, como esperado)');
      return r;
    },
  },

  // ── Realtime ────────────────────────────────────────────────
  {
    id: 'realtime',
    group: 'Realtime',
    label: 'Canal realtime de pagamentos',
    descricao:
      'Abre uma inscrição no canal de mudanças da tabela de pagamentos — é o que faz o calendário do dizimista e o painel admin atualizarem sozinhos. Exige a tabela publicada em supabase_realtime.',
    run: () =>
      new Promise<CheckResult>(resolve => {
        const canal = supabase.channel(`checkup-${Date.now()}`).on(
          'postgres_changes', { event: '*', schema: 'public', table: 'pagamentos' }, () => undefined,
        );
        const timer = setTimeout(() => {
          supabase.removeChannel(canal);
          resolve(fail('Timeout ao inscrever no canal realtime'));
        }, 8000);
        canal.subscribe(status => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timer);
            supabase.removeChannel(canal);
            resolve(ok('Inscrição realtime confirmada'));
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            clearTimeout(timer);
            supabase.removeChannel(canal);
            resolve(fail(`Realtime indisponível (${status})`));
          }
        });
      }),
  },

  // ── PWA / Push no dispositivo ───────────────────────────────
  {
    id: 'pwa-sw',
    group: 'PWA e notificações',
    label: 'Service Worker registrado',
    descricao:
      'O service worker é obrigatório para instalar o app e receber push. Exige HTTPS (ou localhost) e o arquivo sw.js servido na raiz do domínio.',
    run: async () => {
      if (!('serviceWorker' in navigator)) return fail('Navegador sem suporte a Service Worker');
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return warn('Nenhum service worker registrado nesta origem');
      return ok('Service worker ativo');
    },
  },
  {
    id: 'pwa-push',
    group: 'PWA e notificações',
    label: 'Permissão de notificação neste dispositivo',
    descricao:
      'Estado da permissão no navegador atual. No iOS só funciona depois que o usuário adiciona o app à Tela de Início. Este teste não pede permissão — apenas informa.',
    run: async () => {
      if (!('Notification' in window)) return warn('Navegador sem suporte a notificações');
      const p = Notification.permission;
      if (p === 'granted') return ok('Permissão concedida');
      if (p === 'denied') return warn('Permissão negada pelo usuário neste dispositivo');
      return warn('Permissão ainda não solicitada');
    },
  },
];

/* ── Passos manuais ──────────────────────────────────────────── */
interface PassoManual { titulo: string; onde: string; descricao: string }

const PASSOS_MANUAIS: PassoManual[] = [
  {
    titulo: '1. Criar o projeto Supabase da paróquia',
    onde: 'app.supabase.com',
    descricao:
      'Crie um projeto novo e anote a Project URL, a chave publicável (anon) e a service-role key. Cada paróquia usa um projeto próprio — é isso que garante isolamento total dos dados e gateways independentes.',
  },
  {
    titulo: '2. Aplicar as migrations',
    onde: 'Terminal — supabase link + supabase db push',
    descricao:
      'Faça o link com o ref do projeto novo e rode o push. As migrations em supabase/migrations criam todas as tabelas, enums, RLS, GRANTs, funções e triggers na ordem cronológica correta. Nada precisa ser rodado à mão.',
  },
  {
    titulo: '3. Criar o usuário super admin',
    onde: 'Supabase → Authentication → Users, depois SQL Editor',
    descricao:
      'Crie o usuário pelo painel de Authentication e em seguida rode select setup_nova_paroquia(\'email@paroquia.org\', \'Nome da Paróquia\', \'CNPJ\', \'site\'). A função promove o usuário a super_admin e semeia configurações, comunidade padrão, categorias e mensagens.',
  },
  {
    titulo: '4. Configurar os segredos das Edge Functions',
    onde: 'Supabase → Settings → Edge Functions → Secrets',
    descricao:
      'Gere um CARTEIRINHA_HMAC_SECRET NOVO (nunca reaproveite o de outra paróquia, senão QR codes de uma instalação validariam na outra), as chaves VAPID para push, o segredo de webhook do gateway e as credenciais do provedor de pagamento. Nenhum desses valores vai para o repositório.',
  },
  {
    titulo: '5. Deploy das Edge Functions',
    onde: 'Terminal — supabase functions deploy',
    descricao:
      'Deploy de todas as funções da pasta supabase/functions. Depois volte aqui e rode o checkup: o bloco "Edge Functions" confirma que cada uma responde.',
  },
  {
    titulo: '6. Agendar os jobs de cron',
    onde: 'Supabase → SQL Editor (pg_cron)',
    descricao:
      'Os agendamentos não vivem nas migrations. Crie os jobs diários que chamam enviar-push-notificacoes, enviar-email-aniversario e enviar-lembrete-pagamento, sempre em horário de Brasília. Sem isso, aniversários e lembretes de dízimo nunca disparam sozinhos.',
  },
  {
    titulo: '7. Publicar o front-end',
    onde: 'Cloudflare Pages / Workers',
    descricao:
      'Configure VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY e VITE_SUPABASE_PROJECT_ID como variáveis de build e publique. Confirme que o domínio final está em HTTPS — é requisito para PWA e push.',
  },
  {
    titulo: '8. Registrar o webhook no provedor de pagamento',
    onde: 'Painel do provedor (Rede / Sicredi / Pagar.me)',
    descricao:
      'Aponte o webhook para a função webhook-pagamento e cadastre o mesmo segredo salvo no passo 4. A validação HMAC recusa qualquer notificação sem assinatura válida, então o segredo precisa ser idêntico dos dois lados.',
  },
  {
    titulo: '9. Personalizar a identidade visual',
    onde: 'Sistema → /admin/configuracoes',
    descricao:
      'Envie logo do app, logo térmico da impressora e logo da carteirinha, defina cores, slogan, CNPJ, endereço e telefone, e ajuste o layout do comprovante (campos visíveis e corte da guilhotina).',
  },
  {
    titulo: '10. Instalar e vincular o Client Local',
    onde: 'PC do totem — pasta client-local',
    descricao:
      'Gere um token em /admin/diagnostico, coloque no .env do client como API_TOKEN, configure impressora e PINPad pelo wizard do client e valide tudo em /admin/diagnostico (impressão de teste e handshake do PINPad).',
  },
  {
    titulo: '11. Transação de ponta a ponta em sandbox',
    onde: 'Totem e app do dizimista',
    descricao:
      'Com o gateway em sandbox, faça um PIX e um cartão, confirme que o pagamento aparece como pago, que o mês fica verde no calendário do dizimista, que o comprovante imprime e que o histórico registra. Só depois disso troque o ambiente para produção.',
  },
];

/* ── UI ──────────────────────────────────────────────────────── */
const statusUI: Record<Status, { icon: React.ElementType; className: string; label: string }> = {
  idle: { icon: Circle, className: 'text-muted-foreground', label: 'Não testado' },
  running: { icon: Loader2, className: 'text-muted-foreground animate-spin', label: 'Testando...' },
  pass: { icon: CheckCircle2, className: 'text-green-600', label: 'OK' },
  warn: { icon: AlertTriangle, className: 'text-yellow-600', label: 'Atenção' },
  fail: { icon: XCircle, className: 'text-destructive', label: 'Falhou' },
};

const groupIcons: Record<string, React.ElementType> = {
  'Banco de dados': Database,
  'Funções SQL (RPC)': Database,
  'Storage': HardDrive,
  'Edge Functions': Cloud,
  'Realtime': Radio,
  'PWA e notificações': Bell,
};

const AdminCheckup: React.FC = () => {
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [running, setRunning] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);

  const runOne = useCallback(async (check: Check) => {
    setResults(prev => ({ ...prev, [check.id]: { status: 'running', message: '' } }));
    try {
      const r = await check.run();
      setResults(prev => ({ ...prev, [check.id]: r }));
    } catch (e: any) {
      setResults(prev => ({ ...prev, [check.id]: fail(e?.message ?? 'Erro inesperado') }));
    }
  }, []);

  const runAll = useCallback(async () => {
    setRunning(true);
    for (const check of CHECKS) {
      // sequencial de propósito: evita rajada de requisições e facilita a leitura
      await runOne(check);
    }
    setRunning(false);
  }, [runOne]);

  const grupos = Array.from(new Set(CHECKS.map(c => c.group)));
  const totais = CHECKS.reduce(
    (acc, c) => {
      const s = results[c.id]?.status ?? 'idle';
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Checkup da Instalação</h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
              Testes automáticos de plataforma e a lista de procedimentos manuais para colocar uma
              paróquia nova no ar. Nenhum teste grava dados nem gera cobrança real.
            </p>
          </div>
          <Button onClick={runAll} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
            Rodar todos os testes
          </Button>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['pass', 'warn', 'fail', 'idle'] as Status[]).map(s => {
            const cfg = statusUI[s];
            const Icon = cfg.icon;
            return (
              <Card key={s}>
                <CardContent className="flex flex-col items-center justify-center p-4 text-center">
                  <Icon className={`h-6 w-6 mb-1 ${cfg.className}`} />
                  <span className="text-2xl font-bold">{totais[s] ?? 0}</span>
                  <span className="text-xs text-muted-foreground">{cfg.label}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Testes automáticos */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Testes automáticos</h2>
          {grupos.map(grupo => {
            const GIcon = groupIcons[grupo] ?? Database;
            return (
              <Card key={grupo}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <GIcon className="h-4 w-4 text-primary" />
                    {grupo}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {CHECKS.filter(c => c.group === grupo).map(check => {
                    const r = results[check.id] ?? { status: 'idle' as Status, message: '' };
                    const cfg = statusUI[r.status];
                    const Icon = cfg.icon;
                    const expandido = aberto === check.id;
                    return (
                      <div key={check.id} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            className="flex items-start gap-2 text-left flex-1 min-w-0"
                            onClick={() => setAberto(expandido ? null : check.id)}
                          >
                            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.className}`} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium flex items-center gap-1">
                                {check.label}
                                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expandido ? 'rotate-180' : ''}`} />
                              </p>
                              {r.message && (
                                <p className="text-xs text-muted-foreground mt-0.5 break-words">{r.message}</p>
                              )}
                            </div>
                          </button>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant={r.status === 'fail' ? 'destructive' : r.status === 'pass' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {cfg.label}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => runOne(check)}
                              disabled={running || r.status === 'running'}
                            >
                              Testar
                            </Button>
                          </div>
                        </div>
                        {expandido && (
                          <p className="text-xs text-muted-foreground mt-3 leading-relaxed border-t pt-3">
                            {check.descricao}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Passos manuais */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Procedimentos manuais
          </h2>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Estes passos acontecem fora do sistema (Supabase, Cloudflare e provedores) e não podem ser
            automatizados pelo app, porque envolvem credenciais e criação de infraestrutura. Siga na ordem.
          </p>
          <Card>
            <CardContent className="p-0 divide-y">
              {PASSOS_MANUAIS.map(p => (
                <div key={p.titulo} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{p.titulo}</p>
                    <Badge variant="secondary" className="text-xs font-normal">{p.onde}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{p.descricao}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminCheckup;
