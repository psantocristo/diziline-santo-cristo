import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Wifi, WifiOff, RefreshCw, Save, MonitorSmartphone, Eye, EyeOff, AlertCircle, CreditCard, Wallet, Server, Key, ExternalLink, FlaskConical } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { isLocalClientRunning } from '@/lib/local-client';

interface TefConfig {
  id: string;
  middleware_url: string;
  middleware_token: string;
  terminal_id: string;
  ativo: boolean;
  ultimo_teste: string | null;
  status_conexao: string;
  modo: string;
  timeout_segundos: number;
  credito_ativo: boolean;
  debito_ativo: boolean;
  provedor_tef?: string;
  middleware_urls?: Record<string, string>;
}

const PROVEDOR_META: Record<string, { label: string; placeholder: string; help: string }> = {
  connect_tef: {
    label: 'URL do Middleware — Connect TEF (Rede)',
    placeholder: 'http://localhost:8080',
    help: 'API REST do Connect TEF rodando localmente ou em servidor da rede.',
  },
  sipag: {
    label: 'URL do Middleware — Sipag Integrado (Sicredi)',
    placeholder: 'http://localhost:60906',
    help: 'Endpoint do SDK Sipag local. Porta padrão: 60906.',
  },
  pagarme_stone: {
    label: 'URL do Middleware — Pagar.me Maquininha (Stone)',
    placeholder: 'http://localhost:9999',
    help: 'Endpoint do Stone Connect / Stone PoS local. Porta padrão: 9999.',
  },
  paygo: {
    label: 'URL do Middleware — PayGo / SiTef',
    placeholder: 'http://localhost:60906',
    help: 'Endpoint do PayGo CERT ou SiTef genérico.',
  },
};

interface DiagResult {
  ok: boolean;
  message: string;
  provedor?: string;
  modo?: string;
  detalhes?: string[];
  timestamp: string;
}

const ConfiguracoesTEF: React.FC = () => {
  const [config, setConfig] = useState<TefConfig | null>(null);
  const [form, setForm] = useState<Partial<TefConfig>>({});
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [clientLocalAtivo, setClientLocalAtivo] = useState(false);
  const [diagnostico, setDiagnostico] = useState<DiagResult | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();
    isLocalClientRunning().then(setClientLocalAtivo);
  }, []);

  /** Pre-flight: valida que os campos obrigatórios estão preenchidos antes de ir a produção */
  const preflightProducao = (): string[] => {
    const erros: string[] = [];
    if (!form.middleware_url?.trim()) erros.push('URL do middleware vazia');
    else if (!/^https?:\/\//.test(form.middleware_url)) erros.push('URL deve começar com http:// ou https://');
    if (!form.terminal_id?.trim()) erros.push('Terminal ID não definido');
    if (!form.middleware_token?.trim()) erros.push('Token de autenticação ausente (recomendado em produção)');
    if (!form.credito_ativo && !form.debito_ativo) erros.push('Nenhum meio de pagamento ativo (crédito/débito)');
    if ((form.timeout_segundos || 0) < 15) erros.push('Timeout muito baixo (mínimo recomendado: 30s)');
    return erros;
  };

  const fetchConfig = async () => {
    const { data } = await (supabase as any)
      .from('configuracoes_tef')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (data) {
      setConfig(data);
      setForm(data);
      return;
    }
    // Sem registro: cria uma linha default para liberar a edição
    const { data: novo } = await (supabase as any)
      .from('configuracoes_tef')
      .insert({
        middleware_url: '',
        middleware_token: '',
        terminal_id: '',
        ativo: false,
        modo: 'simulacao',
        timeout_segundos: 60,
        credito_ativo: true,
        debito_ativo: true,
        provedor_tef: 'connect_tef',
        middleware_urls: {},
        status_conexao: 'desconectado',
      })
      .select()
      .maybeSingle();
    if (novo) {
      setConfig(novo);
      setForm(novo);
    }
  };


  const salvar = async () => {
    setSalvando(true);
    const provedor = form.provedor_tef || 'connect_tef';
    const urlsAtuais = { ...(config?.middleware_urls || {}), ...(form.middleware_urls || {}) } as Record<string, string>;
    urlsAtuais[provedor] = form.middleware_url || '';

    const payload = {
      middleware_url: form.middleware_url || '',
      middleware_token: form.middleware_token || '',
      terminal_id: form.terminal_id || '',
      ativo: form.ativo ?? false,
      modo: form.modo || 'simulacao',
      timeout_segundos: form.timeout_segundos ? Number(form.timeout_segundos) : 60,
      credito_ativo: form.credito_ativo ?? true,
      debito_ativo: form.debito_ativo ?? true,
      provedor_tef: provedor,
      middleware_urls: urlsAtuais,
    };

    const { error } = await (supabase as any)
      .from('configuracoes_tef')
      .update(payload)
      .eq('id', config?.id);

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Configurações TEF salvas!' });
      fetchConfig();
    }
    setSalvando(false);
  };

  const testarConexao = async () => {
    setTestando(true);
    setDiagnostico(null);
    const inicio = Date.now();
    try {
      const resp = await supabase.functions.invoke('tef-gateway', {
        body: { action: 'test-connection' },
      });
      if (resp.error) throw new Error(resp.error.message);
      const result = resp.data;
      const dur = Date.now() - inicio;
      const diag: DiagResult = {
        ok: !!result?.success,
        message: result?.message || (result?.success ? 'OK' : 'Falha'),
        provedor: result?.provedor_tef || form.provedor_tef,
        modo: form.modo,
        detalhes: [
          `Modo: ${form.modo}`,
          `Provedor: ${result?.provedor_tef || form.provedor_tef}`,
          `URL: ${form.middleware_url || '—'}`,
          `Latência: ${dur}ms`,
          result?.simulacao ? 'Resposta: simulada (modo simulação)' : 'Resposta: middleware real',
        ],
        timestamp: new Date().toISOString(),
      };
      setDiagnostico(diag);
      if (result?.success) {
        toast({ title: '✅ Conexão estabelecida!', description: result.message });
      } else {
        toast({ title: '❌ Falha na conexão', description: result?.message, variant: 'destructive' });
      }
      fetchConfig();
    } catch (e: any) {
      setDiagnostico({
        ok: false,
        message: e.message,
        modo: form.modo,
        provedor: form.provedor_tef,
        detalhes: [`Erro: ${e.message}`, `URL: ${form.middleware_url || '—'}`],
        timestamp: new Date().toISOString(),
      });
      toast({ title: 'Erro ao testar', description: e.message, variant: 'destructive' });
    }
    setTestando(false);
  };

  const statusBadge = () => {
    const status = config?.status_conexao || 'desconectado';
    if (status === 'conectado') {
      return <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 gap-1.5"><Wifi className="h-3 w-3" /> Conectado</Badge>;
    }
    if (status === 'erro') {
      return <Badge variant="destructive" className="gap-1.5"><AlertCircle className="h-3 w-3" /> Erro</Badge>;
    }
    return <Badge variant="secondary" className="gap-1.5"><WifiOff className="h-3 w-3" /> Desconectado</Badge>;
  };

  if (!config) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MonitorSmartphone className="h-5 w-5 text-primary" />
            Integração Maquininha (TEF)
          </CardTitle>
          {statusBadge()}
          {clientLocalAtivo && (
            <Badge className="bg-sky-500/20 text-sky-600 border-sky-500/30 gap-1.5">
              <Server className="h-3 w-3" /> Gerenciado pelo Client Local
            </Badge>
          )}
        </div>
        {config.ultimo_teste && (
          <p className="text-xs text-muted-foreground">
            Último teste: {format(new Date(config.ultimo_teste), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Provedor da Maquininha</Label>
          <Select
            value={form.provedor_tef || 'connect_tef'}
            onValueChange={v => {
              // ao trocar provedor: salvar URL atual no mapa e carregar a URL salva do provedor escolhido
              setForm(f => {
                const urls = { ...(config?.middleware_urls || {}), ...(f.middleware_urls || {}) } as Record<string, string>;
                if (f.provedor_tef) urls[f.provedor_tef] = f.middleware_url || '';
                return {
                  ...f,
                  provedor_tef: v,
                  middleware_urls: urls,
                  middleware_url: urls[v] ?? PROVEDOR_META[v]?.placeholder ?? '',
                };
              });
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="connect_tef">🟠 Connect TEF (Rede)</SelectItem>
              <SelectItem value="sipag">🟢 Sipag Integrado (Sicredi)</SelectItem>
              <SelectItem value="pagarme_stone">🔵 Pagar.me Maquininha (Stone)</SelectItem>
              <SelectItem value="paygo">⚙️ PayGo / SiTef (genérico)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Cada provedor requer seu próprio middleware local instalado na máquina do totem. A URL abaixo aponta para esse middleware.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>{PROVEDOR_META[form.provedor_tef || 'connect_tef']?.label || 'URL do Middleware'}</Label>
            <Input
              value={form.middleware_url || ''}
              onChange={e => setForm(f => ({ ...f, middleware_url: e.target.value }))}
              placeholder={PROVEDOR_META[form.provedor_tef || 'connect_tef']?.placeholder}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {PROVEDOR_META[form.provedor_tef || 'connect_tef']?.help || 'URL da API REST do middleware TEF'}
            </p>
          </div>

          <div>
            <Label>Token de Autenticação</Label>
            <div className="relative">
              <Input
                type={showToken ? 'text' : 'password'}
                value={form.middleware_token || ''}
                onChange={e => setForm(f => ({ ...f, middleware_token: e.target.value }))}
                placeholder="Token ou API Key do middleware"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label>Terminal ID</Label>
            <Input
              value={form.terminal_id || ''}
              onChange={e => setForm(f => ({ ...f, terminal_id: e.target.value }))}
              placeholder="Identificador do terminal/maquininha"
            />
          </div>

          <div>
            <Label>Modo</Label>
            <Select value={form.modo || 'simulacao'} onValueChange={v => setForm(f => ({ ...f, modo: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simulacao">🧪 Simulação</SelectItem>
                <SelectItem value="localhost">🖥️ TEF Local (localhost)</SelectItem>
                <SelectItem value="sandbox">🔬 Sandbox</SelectItem>
                <SelectItem value="producao">🟢 Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Timeout (segundos)</Label>
            <Input
              type="number"
              min={10}
              max={300}
              value={form.timeout_segundos || 60}
              onChange={e => setForm(f => ({ ...f, timeout_segundos: Number(e.target.value) }))}
            />
            <p className="text-xs text-muted-foreground mt-1">Tempo máximo de espera pela maquininha</p>
          </div>

          <div className="flex items-center gap-3 pt-5">
            <Switch
              checked={form.ativo ?? false}
              onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))}
            />
            <Label className="cursor-pointer">Integração ativa</Label>
          </div>
        </div>

        {form.modo === 'simulacao' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400">
            <strong>Modo Simulação:</strong> Nenhuma conexão real será feita. Pagamentos serão aprovados automaticamente após ~5 segundos para testes.
          </div>
        )}

        {form.modo === 'sandbox' && (
          <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-3 text-xs text-violet-700 dark:text-violet-400 space-y-1">
            <p><strong>Modo Sandbox:</strong> O middleware/bridge responde com NSU e código de autorização fake, sem hardware. Valores terminados em <code className="bg-violet-500/20 px-1 rounded">.13</code> recusam, <code className="bg-violet-500/20 px-1 rounded">.99</code> dão timeout, demais aprovam.</p>
            <p>Use para validar fluxo ponta-a-ponta antes de ligar a maquininha real.</p>
          </div>
        )}

        {form.modo === 'producao' && (() => {
          const erros = preflightProducao();
          return (
            <div className={`rounded-lg border p-3 text-xs space-y-2 ${erros.length ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'}`}>
              <p className="font-semibold flex items-center gap-1.5">
                {erros.length ? <><AlertCircle className="h-3.5 w-3.5"/> Produção — pendências detectadas</> : <><Wifi className="h-3.5 w-3.5"/> Produção — pronto para operar</>}
              </p>
              {erros.length > 0 ? (
                <>
                  <p>Corrija antes de ativar transações reais:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {erros.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </>
              ) : (
                <p>Todos os campos obrigatórios preenchidos. Execute <strong>Testar Conexão</strong> abaixo para confirmar o handshake com o middleware do provedor.</p>
              )}
              <p className="opacity-80">⚠️ Em produção, transações são reais e debitam/creditam de verdade. Confirme o ambiente do <code className="bg-current/10 px-1 rounded">{form.provedor_tef || 'connect_tef'}</code> antes de prosseguir.</p>
            </div>
          );
        })()}

        {form.modo === 'localhost' && (
          <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-3 text-xs text-sky-700 dark:text-sky-400 space-y-2">
            <p>
              <strong>Modo TEF Local:</strong> O totem se comunica diretamente com o middleware Connect TEF rodando em <code className="bg-sky-500/20 px-1 rounded">localhost</code> na mesma máquina. A URL acima deve apontar para o endereço local (ex: <code className="bg-sky-500/20 px-1 rounded">http://localhost:8080</code>).
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2 border-sky-500/40 text-sky-700 dark:text-sky-400 hover:bg-sky-500/10"
              disabled={testando || !form.middleware_url}
              onClick={async () => {
                setTestando(true);
                try {
                  const url = (form.middleware_url || '').replace(/\/$/, '');
                  const resp = await fetch(`${url}/status`, {
                    method: 'GET',
                    headers: form.middleware_token ? { 'Authorization': `Bearer ${form.middleware_token}` } : {},
                    signal: AbortSignal.timeout(5000),
                  });
                  if (resp.ok) {
                    toast({ title: '✅ Conectado ao TEF local!', description: `${url} respondeu com sucesso.` });
                  } else {
                    toast({ title: '⚠️ TEF local respondeu com erro', description: `Status ${resp.status}`, variant: 'destructive' });
                  }
                } catch (e: any) {
                  toast({ title: '❌ Não foi possível conectar ao TEF local', description: e.message?.includes('abort') ? 'Timeout — middleware não respondeu em 5s' : e.message, variant: 'destructive' });
                }
                setTestando(false);
              }}
            >
              <Wifi className="h-3.5 w-3.5" />
              {testando ? 'Testando...' : 'Testar Conectividade Local'}
            </Button>
          </div>
        )}

        {/* Meios de pagamento TEF */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Meios de Pagamento na Maquininha</Label>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">Crédito</p>
                <p className="text-xs text-muted-foreground">Aceitar crédito na maquininha</p>
              </div>
            </div>
            <Switch
              checked={form.credito_ativo ?? true}
              onCheckedChange={v => setForm(f => ({ ...f, credito_ativo: v }))}
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <Wallet className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">Débito</p>
                <p className="text-xs text-muted-foreground">Aceitar débito na maquininha</p>
              </div>
            </div>
            <Switch
              checked={form.debito_ativo ?? true}
              onCheckedChange={v => setForm(f => ({ ...f, debito_ativo: v }))}
            />
          </div>
        </div>

        {/* Token do Client Local */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Token do Client Local (Windows)</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Cada máquina que roda o <code className="bg-muted px-1 rounded">DízimoSC-Client.exe</code> precisa
            de um token único. Gere, copie e cole no arquivo <code className="bg-muted px-1 rounded">.env</code>
            como <code className="bg-muted px-1 rounded">API_TOKEN=…</code>.
          </p>
          <Button asChild size="sm" variant="outline" className="gap-2">
            <Link to="/admin/diagnostico#tokens">
              <ExternalLink className="h-3.5 w-3.5" />
              Gerar / gerenciar tokens
            </Link>
          </Button>
        </div>

        {/* Bridges nativas */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              Modo Sandbox disponível para testes ponta-a-ponta
            </p>
          </div>
          <p className="text-xs text-amber-700/90 dark:text-amber-400/90">
            Defina <code className="bg-amber-500/20 px-1 rounded">TEF_MODE=sandbox</code> no
            <code className="bg-amber-500/20 px-1 rounded">.env</code> do client local para
            simular qualquer provedor sem maquininha real. Valores terminados em
            <code className="bg-amber-500/20 px-1 rounded">.13</code> recusam,
            <code className="bg-amber-500/20 px-1 rounded">.99</code> dão timeout, outros aprovam.
          </p>
          <p className="text-xs text-amber-700/90 dark:text-amber-400/90">
            Para a integração física real, instale a bridge do provedor em
            <code className="bg-amber-500/20 px-1 rounded">bridges/&lt;provedor&gt;-bridge</code>
            do repositório — README com instruções por SDK incluso.
          </p>
        </div>

        {diagnostico && (
          <div className={`rounded-lg border p-3 text-xs space-y-1.5 ${diagnostico.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'}`}>
            <p className="font-semibold flex items-center gap-1.5">
              {diagnostico.ok ? <Wifi className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              Diagnóstico: {diagnostico.ok ? 'Sucesso' : 'Falha'} — {diagnostico.message}
            </p>
            {diagnostico.detalhes && (
              <ul className="list-disc list-inside opacity-90 space-y-0.5">
                {diagnostico.detalhes.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            )}
            <p className="opacity-70">{format(new Date(diagnostico.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2 flex-wrap">
          <Button onClick={testarConexao} disabled={testando} variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${testando ? 'animate-spin' : ''}`} />
            {testando ? 'Testando...' : 'Testar Conexão'}
          </Button>
          <Button
            onClick={salvar}
            disabled={salvando || (form.modo === 'producao' && preflightProducao().length > 0)}
            className="gap-2"
            title={form.modo === 'producao' && preflightProducao().length > 0 ? 'Corrija as pendências de produção antes de salvar' : ''}
          >
            <Save className="h-4 w-4" />
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConfiguracoesTEF;
