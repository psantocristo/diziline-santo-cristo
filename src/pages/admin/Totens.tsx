import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, RefreshCw, Plus, UserCheck, UserX, Monitor, Activity, Settings2, Smartphone, CreditCard, Wallet, MonitorSmartphone, Save, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

type Totem = {
  id: string;
  user_id: string | null;
  nome: string;
  cor: string;
  ativo: boolean;
  created_at: string;
  email?: string;
  pix_ativo: boolean;
  credito_ativo: boolean;
  debito_ativo: boolean;
  tef_ativo: boolean;
};

type PagamentoTotem = {
  id: string;
  created_at: string;
  valor: number;
  tipo: string;
  metodo: string;
  status: string;
  nome_contribuinte: string | null;
  origem: string | null;
};

const AdminTotens: React.FC = () => {
  const [totens, setTotens] = useState<Totem[]>([]);
  const [loadingTotens, setLoadingTotens] = useState(false);
  const [cadastrandoTotem, setCadastrandoTotem] = useState(false);
  const [formTotem, setFormTotem] = useState({ nome: '', email: '', senha: '', cor: '#7B1C2A' });
  const [showSenhaTotem, setShowSenhaTotem] = useState(false);
  const [totemRegistros, setTotemRegistros] = useState<Totem | null>(null);
  const [registros, setRegistros] = useState<PagamentoTotem[]>([]);
  const [loadingRegistros, setLoadingRegistros] = useState(false);
  const [totemConfig, setTotemConfig] = useState<Totem | null>(null);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [senhaTotem, setSenhaTotem] = useState<Totem | null>(null);
  const [novaSenha, setNovaSenha] = useState('');
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTotens();
  }, []);

  const fetchTotens = async () => {
    setLoadingTotens(true);
    const { data } = await (supabase as any).from('totens').select('*').order('created_at', { ascending: false });
    if (data && data.length > 0) {
      const userIds = data.filter((t: any) => t.user_id).map((t: any) => t.user_id);
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, email').in('id', userIds);
        const emailMap: Record<string, string> = {};
        (profiles || []).forEach((p: any) => { emailMap[p.id] = p.email || ''; });
        setTotens(data.map((t: any) => ({ ...t, email: emailMap[t.user_id] || '' })));
      } else {
        setTotens(data);
      }
    } else {
      setTotens(data || []);
    }
    setLoadingTotens(false);
  };

  const cadastrarTotem = async () => {
    if (!formTotem.nome.trim() || !formTotem.email.trim() || !formTotem.senha) {
      toast({ title: 'Preencha nome, e-mail e senha', variant: 'destructive' }); return;
    }
    if (formTotem.senha.length < 6) {
      toast({ title: 'Senha deve ter no mínimo 6 caracteres', variant: 'destructive' }); return;
    }
    setCadastrandoTotem(true);
    try {
      const resp = await supabase.functions.invoke('create-totem', {
        body: {
          nome: formTotem.nome.trim(),
          email: formTotem.email.trim().toLowerCase(),
          senha: formTotem.senha,
          cor: formTotem.cor,
        },
      });
      if (resp.error || resp.data?.error) {
        throw new Error(resp.data?.error || resp.error?.message || 'Erro desconhecido');
      }
      toast({ title: '✅ Totem cadastrado!', description: `${formTotem.nome} está pronto para uso.` });
      setFormTotem({ nome: '', email: '', senha: '', cor: '#7B1C2A' });
      fetchTotens();
    } catch (err: any) {
      toast({ title: 'Erro ao cadastrar totem', description: err.message, variant: 'destructive' });
    }
    setCadastrandoTotem(false);
  };

  const toggleTotemAtivo = async (totem: Totem) => {
    const novoAtivo = !totem.ativo;
    const { error } = await (supabase as any).from('totens').update({ ativo: novoAtivo }).eq('id', totem.id);
    if (!error) {
      toast({ title: novoAtivo ? `✅ ${totem.nome} ativado` : `🔒 ${totem.nome} inativado` });
      fetchTotens();
    }
  };

  const abrirConfig = (totem: Totem) => {
    setTotemConfig({ ...totem });
  };

  const salvarConfig = async () => {
    if (!totemConfig) return;
    setSalvandoConfig(true);
    const { error } = await (supabase as any).from('totens').update({
      pix_ativo: totemConfig.pix_ativo,
      credito_ativo: totemConfig.credito_ativo,
      debito_ativo: totemConfig.debito_ativo,
      tef_ativo: totemConfig.tef_ativo,
    }).eq('id', totemConfig.id);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `✅ Métodos de pagamento de ${totemConfig.nome} atualizados!` });
      setTotemConfig(null);
      fetchTotens();
    }
    setSalvandoConfig(false);
  };

  const alterarSenhaTotem = async () => {
    if (!senhaTotem?.user_id || !novaSenha) return;
    if (novaSenha.length < 6) {
      toast({ title: 'Senha deve ter no mínimo 6 caracteres', variant: 'destructive' });
      return;
    }
    setSalvandoSenha(true);
    try {
      const resp = await supabase.functions.invoke('admin-reset-password', {
        body: { user_id: senhaTotem.user_id, nova_senha: novaSenha },
      });
      if (resp.error || resp.data?.error) {
        throw new Error(resp.data?.error || resp.error?.message || 'Erro desconhecido');
      }
      toast({ title: `✅ Senha de ${senhaTotem.nome} alterada com sucesso!` });
      setSenhaTotem(null);
      setNovaSenha('');
    } catch (err: any) {
      toast({ title: 'Erro ao alterar senha', description: err.message, variant: 'destructive' });
    }
    setSalvandoSenha(false);
  };

  const abrirRegistros = async (totem: Totem) => {
    setTotemRegistros(totem);
    setLoadingRegistros(true);
    setRegistros([]);
    const { data } = await supabase
      .from('pagamentos')
      .select('id, created_at, valor, tipo, metodo, status, nome_contribuinte, origem')
      .eq('origem', 'totem')
      .order('created_at', { ascending: false })
      .limit(30);
    setRegistros((data as any) || []);
    setLoadingRegistros(false);

    supabase
      .channel(`totem-registros-${totem.id}`)
      .on('postgres_changes' as any, {
        event: 'INSERT',
        schema: 'public',
        table: 'pagamentos',
        filter: `origem=eq.totem`,
      }, (payload: any) => {
        setRegistros(prev => [payload.new as PagamentoTotem, ...prev]);
      })
      .subscribe();
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Monitor className="h-6 w-6 text-primary" />
            Totens de Pagamento
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Terminais físicos com acesso restrito apenas para recebimento de contribuições.
          </p>
        </div>

        {/* Formulário de cadastro */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Cadastrar Novo Totem
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Cada totem possui login próprio com acesso exclusivo à tela de pagamento.
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome do Totem *</Label>
              <Input
                value={formTotem.nome}
                onChange={e => setFormTotem(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Totem Entrada Principal"
              />
            </div>
            <div>
              <Label>E-mail de acesso *</Label>
              <Input
                type="email"
                value={formTotem.email}
                onChange={e => setFormTotem(f => ({ ...f, email: e.target.value }))}
                placeholder="totem1@paroquia.com"
              />
            </div>
            <div>
              <Label>Senha *</Label>
              <div className="relative">
                <Input
                  type={showSenhaTotem ? 'text' : 'password'}
                  value={formTotem.senha}
                  onChange={e => setFormTotem(f => ({ ...f, senha: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowSenhaTotem(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showSenhaTotem ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Cor do Totem</Label>
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="color"
                  value={formTotem.cor}
                  onChange={e => setFormTotem(f => ({ ...f, cor: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5"
                />
                <Input
                  value={formTotem.cor}
                  onChange={e => setFormTotem(f => ({ ...f, cor: e.target.value }))}
                  placeholder="#7B1C2A"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button onClick={cadastrarTotem} disabled={cadastrandoTotem}>
                {cadastrandoTotem ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Cadastrando...</>
                ) : (
                  <><Plus className="h-4 w-4 mr-2" />Cadastrar Totem</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de totens */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Totens Cadastrados</CardTitle>
            <Button variant="outline" size="sm" onClick={fetchTotens} disabled={loadingTotens}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingTotens ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loadingTotens ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : totens.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Monitor className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum totem cadastrado ainda.</p>
                <p className="text-sm mt-1">Cadastre o primeiro totem usando o formulário acima.</p>
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-border">
                  {totens.map(totem => (
                    <div key={totem.id} className={`p-4 space-y-3 ${!totem.ativo ? 'opacity-60' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-4 h-4 rounded-full border border-border/40 shrink-0" style={{ background: totem.cor }} />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{totem.nome}</p>
                            <p className="text-xs text-muted-foreground truncate">{totem.email || '-'}</p>
                          </div>
                        </div>
                        {totem.ativo ? (
                          <Badge className="bg-green-100 text-green-800 border-green-300 border text-xs shrink-0">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs shrink-0">Inativo</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Desde {format(new Date(totem.created_at), 'dd/MM/yy', { locale: ptBR })}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <Button variant="outline" size="sm" onClick={() => abrirConfig(totem)} className="flex-1">
                          <Settings2 className="h-3.5 w-3.5 mr-1.5" />Pagamentos
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setSenhaTotem(totem); setNovaSenha(''); setShowNovaSenha(false); }} className="flex-1">
                          <KeyRound className="h-3.5 w-3.5 mr-1.5" />Senha
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => abrirRegistros(totem)} className="flex-1">
                          <Activity className="h-3.5 w-3.5 mr-1.5" />Registros
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          onClick={() => toggleTotemAtivo(totem)}
                          className={totem.ativo ? 'text-destructive border-destructive/30' : 'text-green-700 border-green-300'}
                        >
                          {totem.ativo ? <><UserX className="h-3.5 w-3.5 mr-1.5" />Inativar</> : <><UserCheck className="h-3.5 w-3.5 mr-1.5" />Ativar</>}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Totem</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Desde</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {totens.map(totem => (
                        <TableRow key={totem.id} className={!totem.ativo ? 'opacity-60' : ''}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full border border-border/40 shrink-0" style={{ background: totem.cor }} />
                              <span className="font-medium text-sm">{totem.nome}</span>
                              {totem.ativo && (
                                <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Ativo</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{totem.email || '-'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(totem.created_at), 'dd/MM/yy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {totem.ativo ? (
                              <Badge className="bg-green-100 text-green-800 border-green-300 border text-xs">Ativo</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Inativo</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm" onClick={() => abrirConfig(totem)}>
                                <Settings2 className="h-3.5 w-3.5 mr-1.5" />Pagamentos
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => { setSenhaTotem(totem); setNovaSenha(''); setShowNovaSenha(false); }}>
                                <KeyRound className="h-3.5 w-3.5 mr-1.5" />Senha
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => abrirRegistros(totem)}>
                                <Activity className="h-3.5 w-3.5 mr-1.5" />Registros
                              </Button>
                              <Button
                                variant="outline" size="sm"
                                onClick={() => toggleTotemAtivo(totem)}
                                className={totem.ativo ? 'text-destructive border-destructive/30 hover:bg-destructive/10' : 'text-green-700 border-green-300 hover:bg-green-50'}
                              >
                                {totem.ativo ? <><UserX className="h-3.5 w-3.5 mr-1.5" />Inativar</> : <><UserCheck className="h-3.5 w-3.5 mr-1.5" />Ativar</>}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sheet de Registros do Totem */}
      <Sheet open={!!totemRegistros} onOpenChange={(open) => { if (!open) { setTotemRegistros(null); setRegistros([]); } }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: totemRegistros?.cor || '#7B1C2A' }} />
              Registros — {totemRegistros?.nome}
              <span className="ml-auto flex items-center gap-1 text-xs font-normal text-green-600">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Tempo real
              </span>
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {loadingRegistros ? (
              <div className="p-8 text-center text-muted-foreground">
                <RefreshCw className="h-6 w-6 mx-auto animate-spin mb-2" />
                Carregando registros...
              </div>
            ) : registros.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-sm">Nenhum registro encontrado.</p>
                <p className="text-xs mt-1">Os pagamentos realizados neste totem aparecerão aqui em tempo real.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {registros.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          R$ {Number(r.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${
                          r.status === 'pago' ? 'bg-green-50 text-green-700 border-green-200' :
                          r.status === 'aguardando_pagamento' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                          r.status === 'cancelado' || r.status === 'expirado' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                          'bg-muted text-muted-foreground border-border'
                        }`}>
                          {r.status === 'aguardando_pagamento' ? 'aguardando' : r.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground capitalize">{r.tipo}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground uppercase">{r.metodo}</span>
                        {r.nome_contribuinte && (
                          <>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground truncate">{r.nome_contribuinte}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground ml-3 shrink-0">
                      {format(new Date(r.created_at), 'HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet de Configuração de Pagamentos do Totem */}
      <Sheet open={!!totemConfig} onOpenChange={(open) => { if (!open) setTotemConfig(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Métodos de Pagamento — {totemConfig?.nome}
            </SheetTitle>
          </SheetHeader>
          {totemConfig && (
            <div className="mt-6 space-y-6">
              <p className="text-sm text-muted-foreground">
                Controle quais formas de pagamento ficam disponíveis neste totem. Métodos desativados globalmente não aparecerão mesmo se ativados aqui.
              </p>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Pagamento Online</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">PIX</p>
                        <p className="text-xs text-muted-foreground">QR Code via gateway online</p>
                      </div>
                    </div>
                    <Switch
                      checked={totemConfig.pix_ativo}
                      onCheckedChange={v => setTotemConfig(c => c ? { ...c, pix_ativo: v } : c)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">Crédito Online</p>
                        <p className="text-xs text-muted-foreground">Dados do cartão na tela</p>
                      </div>
                    </div>
                    <Switch
                      checked={totemConfig.credito_ativo}
                      onCheckedChange={v => setTotemConfig(c => c ? { ...c, credito_ativo: v } : c)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Wallet className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">Débito Online</p>
                        <p className="text-xs text-muted-foreground">Dados do cartão na tela</p>
                      </div>
                    </div>
                    <Switch
                      checked={totemConfig.debito_ativo}
                      onCheckedChange={v => setTotemConfig(c => c ? { ...c, debito_ativo: v } : c)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Maquininha (TEF)</Label>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <MonitorSmartphone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">Maquininha TEF</p>
                      <p className="text-xs text-muted-foreground">Pagamento na maquininha física</p>
                    </div>
                  </div>
                  <Switch
                    checked={totemConfig.tef_ativo}
                    onCheckedChange={v => setTotemConfig(c => c ? { ...c, tef_ativo: v } : c)}
                  />
                </div>
              </div>

              {!totemConfig.pix_ativo && !totemConfig.credito_ativo && !totemConfig.debito_ativo && !totemConfig.tef_ativo && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-xs text-destructive">
                  <strong>Atenção:</strong> Nenhum método de pagamento está ativo. O totem não poderá processar pagamentos.
                </div>
              )}

              <Button onClick={salvarConfig} disabled={salvandoConfig} className="w-full gap-2">
                <Save className="h-4 w-4" />
                {salvandoConfig ? 'Salvando...' : 'Salvar Configuração'}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog de Alterar Senha */}
      <Dialog open={!!senhaTotem} onOpenChange={(open) => { if (!open) setSenhaTotem(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Alterar Senha — {senhaTotem?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nova Senha</Label>
              <div className="relative">
                <Input
                  type={showNovaSenha ? 'text' : 'password'}
                  value={novaSenha}
                  onChange={e => setNovaSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNovaSenha(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNovaSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                E-mail: {senhaTotem?.email || 'não disponível'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSenhaTotem(null)}>Cancelar</Button>
            <Button onClick={alterarSenhaTotem} disabled={salvandoSenha || novaSenha.length < 6} className="gap-2">
              <KeyRound className="h-4 w-4" />
              {salvandoSenha ? 'Salvando...' : 'Alterar Senha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminTotens;
