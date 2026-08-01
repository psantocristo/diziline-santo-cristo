import React, { useState, useEffect, useCallback, useRef } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  getLocalHealth, invalidateHealthCache, printTestPage,
  type LocalHealthResponse,
} from '@/lib/local-client';
import GatewayHealthPanel from '@/components/admin/GatewayHealthPanel';
import SicrediPanel from '@/components/admin/SicrediPanel';

import AutoDetectPanel from '@/components/admin/AutoDetectPanel';
import {
  WifiOff, Printer, CreditCard, Database, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, Server, Loader2,
  Key, Copy, Trash2, Plus, Eye, EyeOff, Shield,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ConnectionStatus = 'checking' | 'connected' | 'disconnected' | 'degraded';

const statusConfig: Record<ConnectionStatus, { color: string; icon: React.ElementType; label: string }> = {
  checking: { color: 'text-muted-foreground', icon: Loader2, label: 'Verificando...' },
  connected: { color: 'text-green-600', icon: CheckCircle, label: 'Conectado' },
  disconnected: { color: 'text-destructive', icon: XCircle, label: 'Desconectado' },
  degraded: { color: 'text-yellow-600', icon: AlertTriangle, label: 'Degradado' },
};

interface StatusItemProps {
  label: string;
  icon: React.ElementType;
  status: ConnectionStatus;
  detail?: string;
  extraDetails?: string[];
  action?: { label: string; onClick: () => void; loading?: boolean };
}

const StatusItem: React.FC<StatusItemProps> = ({ label, icon: Icon, status, detail, extraDetails, action }) => {
  const cfg = statusConfig[status];
  const StatusIcon = cfg.icon;
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Icon className="h-5 w-5 text-foreground/70" />
          </div>
          <div>
            <p className="font-medium text-sm">{label}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <StatusIcon className={`h-3.5 w-3.5 ${cfg.color} ${status === 'checking' ? 'animate-spin' : ''}`} />
              <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
            </div>
            {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
            {extraDetails?.map((d, i) => (
              <p key={i} className="text-xs text-muted-foreground">{d}</p>
            ))}
          </div>
        </div>
        {action && (
          <Button variant="outline" size="sm" onClick={action.onClick} disabled={action.loading}>
            {action.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

// ── Token type ──
interface TokenClient {
  id: string;
  nome: string;
  token: string;
  ativo: boolean;
  created_at: string;
  ultimo_uso: string | null;
  ip_ultimo_uso: string | null;
}

/** Gera token aleatório no formato UUID-like */
function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

const AdminDiagnostico: React.FC = () => {
  const { toast } = useToast();
  const [clientStatus, setClientStatus] = useState<ConnectionStatus>('checking');
  const [dbStatus, setDbStatus] = useState<ConnectionStatus>('checking');
  const [printerStatus, setPrinterStatus] = useState<ConnectionStatus>('checking');
  const [pinpadStatus, setPinpadStatus] = useState<ConnectionStatus>('checking');
  const [health, setHealth] = useState<LocalHealthResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [testingPrinter, setTestingPrinter] = useState(false);
  const [dbLatency, setDbLatency] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const prevStatusRef = useRef<{ client: ConnectionStatus; printer: ConnectionStatus; pinpad: ConnectionStatus; db: ConnectionStatus } | null>(null);
  const isFirstCheck = useRef(true);

  // ── Token state ──
  const [tokens, setTokens] = useState<TokenClient[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [creatingToken, setCreatingToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [visibleTokens, setVisibleTokens] = useState<Set<string>>(new Set());

  const checkAll = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);

    let newDbStatus: ConnectionStatus = 'checking';
    const dbStart = Date.now();
    try {
      const { error } = await supabase.from('configuracoes_paroquia').select('id').limit(1).maybeSingle();
      setDbLatency(Date.now() - dbStart);
      newDbStatus = error ? 'disconnected' : 'connected';
    } catch {
      setDbLatency(null);
      newDbStatus = 'disconnected';
    }
    setDbStatus(newDbStatus);

    invalidateHealthCache();
    const h = await getLocalHealth();
    setHealth(h);

    let newClientStatus: ConnectionStatus;
    let newPrinterStatus: ConnectionStatus;
    let newPinpadStatus: ConnectionStatus;

    if (!h) {
      newClientStatus = 'disconnected';
      newPrinterStatus = 'disconnected';
      newPinpadStatus = 'disconnected';
    } else {
      newClientStatus = h.status === 'ok' ? 'connected' : h.status === 'degraded' ? 'degraded' : 'disconnected';
      newPrinterStatus = h.devices.printer.connected ? 'connected' : 'disconnected';
      newPinpadStatus = h.devices.pinpad.connected ? 'connected' : 'disconnected';
    }

    setClientStatus(newClientStatus);
    setPrinterStatus(newPrinterStatus);
    setPinpadStatus(newPinpadStatus);

    if (!isFirstCheck.current && prevStatusRef.current) {
      const prev = prevStatusRef.current;
      const changes: { device: string; from: ConnectionStatus; to: ConnectionStatus }[] = [];
      if (prev.client !== newClientStatus) changes.push({ device: 'Client Local', from: prev.client, to: newClientStatus });
      if (prev.printer !== newPrinterStatus) changes.push({ device: 'Impressora', from: prev.printer, to: newPrinterStatus });
      if (prev.pinpad !== newPinpadStatus) changes.push({ device: 'PINPad', from: prev.pinpad, to: newPinpadStatus });
      if (prev.db !== newDbStatus) changes.push({ device: 'Banco de Dados', from: prev.db, to: newDbStatus });

      for (const c of changes) {
        const connected = c.to === 'connected';
        toast({
          title: connected ? `✅ ${c.device} conectado` : `⚠️ ${c.device} desconectado`,
          description: connected ? `${c.device} está online novamente.` : `${c.device} ficou offline.`,
          variant: connected ? 'default' : 'destructive',
        });
      }
    }

    prevStatusRef.current = { client: newClientStatus, printer: newPrinterStatus, pinpad: newPinpadStatus, db: newDbStatus };
    isFirstCheck.current = false;
    if (!silent) setRefreshing(false);
  }, [toast]);

  useEffect(() => { checkAll(); }, [checkAll]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => checkAll(true), 10_000);
    return () => clearInterval(id);
  }, [autoRefresh, checkAll]);

  // ── Token CRUD ──
  const fetchTokens = useCallback(async () => {
    setLoadingTokens(true);
    const { data } = await supabase
      .from('tokens_client' as any)
      .select('*')
      .order('created_at', { ascending: false });
    setTokens((data as any as TokenClient[]) || []);
    setLoadingTokens(false);
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  const handleCreateToken = async () => {
    if (!newTokenName.trim()) {
      toast({ title: 'Informe um nome para o token', variant: 'destructive' });
      return;
    }
    setCreatingToken(true);
    const token = generateToken();
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('tokens_client' as any).insert({
      nome: newTokenName.trim(),
      token,
      created_by: userData?.user?.id,
    } as any);
    if (error) {
      toast({ title: 'Erro ao gerar token', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Token gerado com sucesso!' });
      setNewTokenName('');
      setShowNewForm(false);
      await fetchTokens();
      // Auto-show the new token
      const { data: newData } = await supabase.from('tokens_client' as any).select('id').eq('token', token).maybeSingle();
      if (newData) setVisibleTokens(prev => new Set(prev).add((newData as any).id));
    }
    setCreatingToken(false);
  };

  const handleToggleToken = async (id: string, ativo: boolean) => {
    await supabase.from('tokens_client' as any).update({ ativo: !ativo } as any).eq('id', id);
    fetchTokens();
  };

  const handleDeleteToken = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este token? Clients que usam este token perderão acesso.')) return;
    await supabase.from('tokens_client' as any).delete().eq('id', id);
    fetchTokens();
    toast({ title: 'Token excluído' });
  };

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast({ title: '📋 Token copiado!' });
  };

  const toggleTokenVisibility = (id: string) => {
    setVisibleTokens(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const maskToken = (token: string) => token.slice(0, 8) + '••••••••••••••••' + token.slice(-4);

  const handleTestPrinter = async () => {
    setTestingPrinter(true);
    const result = await printTestPage();
    toast({
      title: result.success ? '✅ Página de teste impressa!' : '❌ Erro ao imprimir',
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    });
    setTestingPrinter(false);
  };

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  };

  const pinpadExtras: string[] = [];
  if (health?.devices.pinpad.firmware) pinpadExtras.push(`Firmware: ${health.devices.pinpad.firmware}`);
  if (health?.devices.pinpad.serial) pinpadExtras.push(`Serial: ${health.devices.pinpad.serial}`);
  if (health?.devices.pinpad.lastTransaction) {
    const lt = health.devices.pinpad.lastTransaction;
    const time = new Date(lt.at).toLocaleTimeString('pt-BR');
    pinpadExtras.push(`Última tx: ${lt.status} às ${time}${lt.nsu ? ` (NSU ${lt.nsu})` : ''}`);
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Diagnóstico do Sistema</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Status de conexão com periféricos e banco de dados
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Auto-refresh</span>
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            </div>
            <Button onClick={() => checkAll()} disabled={refreshing} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Client Local', status: clientStatus, icon: Server },
            { label: 'Banco de Dados', status: dbStatus, icon: Database },
            { label: 'Impressora', status: printerStatus, icon: Printer },
            { label: 'PINPad', status: pinpadStatus, icon: CreditCard },
          ].map(({ label, status, icon: Icon }) => {
            const cfg = statusConfig[status];
            const SIcon = cfg.icon;
            return (
              <Card key={label}>
                <CardContent className="flex flex-col items-center justify-center p-4 text-center">
                  <Icon className="h-6 w-6 text-foreground/60 mb-2" />
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <SIcon className={`h-3.5 w-3.5 ${cfg.color} ${status === 'checking' ? 'animate-spin' : ''}`} />
                    <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Detailed status */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Detalhes</h2>

          <StatusItem
            label="Client Local (localhost:3847)"
            icon={Server}
            status={clientStatus}
            detail={health ? `v${health.version} • Uptime: ${formatUptime(health.uptime)}` : 'Certifique-se de que o DízimoSC Client está rodando na máquina'}
          />

          <StatusItem
            label="Banco de Dados (Supabase)"
            icon={Database}
            status={dbStatus}
            detail={dbLatency !== null ? `Latência: ${dbLatency}ms` : undefined}
          />

          <StatusItem
            label="Impressora Térmica"
            icon={Printer}
            status={printerStatus}
            detail={health?.devices.printer.model ? `Modelo: ${health.devices.printer.model}` : health?.devices.printer.error || undefined}
            action={printerStatus === 'connected' ? { label: 'Imprimir Teste', onClick: handleTestPrinter, loading: testingPrinter } : undefined}
          />

          <StatusItem
            label="PINPad / TEF"
            icon={CreditCard}
            status={pinpadStatus}
            detail={health?.devices.pinpad.model ? `Terminal: ${health.devices.pinpad.model}` : health?.devices.pinpad.error || undefined}
            extraDetails={pinpadExtras.length > 0 ? pinpadExtras : undefined}
          />

          <GatewayHealthPanel />

          <SicrediPanel />


          <AutoDetectPanel />
        </div>

        {/* ── Tokens do Client Local ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Tokens do Client Local</h2>
            </div>
            {!showNewForm && (
              <Button size="sm" onClick={() => setShowNewForm(true)}>
                <Plus className="h-4 w-4 mr-1" /> Gerar Token
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Tokens de autenticação para vincular instâncias do Client Local ao sistema.
            Copie o token e insira no arquivo <code className="bg-muted px-1 rounded">.env</code> do client como <code className="bg-muted px-1 rounded">API_TOKEN=...</code>
          </p>

          {/* New token form */}
          {showNewForm && (
            <Card className="border-primary/30">
              <CardContent className="p-4 space-y-3">
                <Label>Nome do Client / Máquina</Label>
                <Input
                  placeholder="Ex: Totem Recepção, PC Secretaria..."
                  value={newTokenName}
                  onChange={e => setNewTokenName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateToken()}
                />
                <div className="flex gap-2">
                  <Button onClick={handleCreateToken} disabled={creatingToken}>
                    {creatingToken ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Key className="h-4 w-4 mr-1" />}
                    Gerar
                  </Button>
                  <Button variant="ghost" onClick={() => { setShowNewForm(false); setNewTokenName(''); }}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Token list */}
          {loadingTokens ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : tokens.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground text-sm">
                Nenhum token gerado. Crie um token para vincular o Client Local.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {tokens.map(t => (
                <Card key={t.id} className={!t.ativo ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-medium text-sm">{t.nome}</span>
                          <Badge variant={t.ativo ? 'default' : 'secondary'} className="text-xs">
                            {t.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono truncate max-w-[300px]">
                            {visibleTokens.has(t.id) ? t.token : maskToken(t.token)}
                          </code>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toggleTokenVisibility(t.id)}>
                            {visibleTokens.has(t.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleCopyToken(t.token)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                          <span>Criado em {new Date(t.created_at).toLocaleDateString('pt-BR')}</span>
                          {t.ultimo_uso && (
                            <span>Último uso: {new Date(t.ultimo_uso).toLocaleString('pt-BR')}</span>
                          )}
                          {t.ip_ultimo_uso && <span>IP: {t.ip_ultimo_uso}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <Switch checked={t.ativo} onCheckedChange={() => handleToggleToken(t.id, t.ativo)} />
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteToken(t.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        {clientStatus === 'disconnected' && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                <WifiOff className="h-4 w-4" />
                Client Local não detectado
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Para conectar periféricos (impressora e PINPad), instale o módulo local:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Copie a pasta <code className="bg-muted px-1 rounded text-xs">client-local</code> para a máquina Windows</li>
                <li>Execute <code className="bg-muted px-1 rounded text-xs">npm install</code> dentro da pasta</li>
                <li>Gere um token acima e insira no <code className="bg-muted px-1 rounded text-xs">.env</code> como <code className="bg-muted px-1 rounded text-xs">API_TOKEN=seu_token</code></li>
                <li>Configure as portas da impressora no <code className="bg-muted px-1 rounded text-xs">.env</code></li>
                <li>Inicie com <code className="bg-muted px-1 rounded text-xs">npm run dev</code> ou instale como serviço Windows</li>
              </ol>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminDiagnostico;
