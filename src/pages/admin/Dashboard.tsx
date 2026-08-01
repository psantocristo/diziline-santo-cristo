import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '@/components/layouts/AdminLayout';
import GatewayMetricsCard from '@/components/admin/GatewayMetricsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import {
  TrendingUp, DollarSign, CreditCard, Target, Users, QrCode, AlertCircle, CheckCircle2,
  Settings, MapPin, CalendarRange, ArrowUpRight, ArrowDownRight, Loader2,
  Clock, HandCoins, Heart, Megaphone, Receipt, Banknote, Smartphone, Landmark,
  Gift, Trophy
} from 'lucide-react';
import { format, subMonths, getYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

const COLORS_TIPO = {
  dizimo: 'hsl(var(--primary))',
  oferta: 'hsl(var(--chart-2, 173 58% 39%))',
  campanha: 'hsl(var(--chart-3, 197 37% 24%))',
  eventual: 'hsl(var(--chart-4, 43 74% 66%))',
};

const COLORS_ORIGEM = {
  web: 'hsl(var(--primary))',
  totem: 'hsl(var(--chart-2, 173 58% 39%))',
  admin: 'hsl(var(--chart-3, 197 37% 24%))',
  kiosk: 'hsl(var(--chart-4, 43 74% 66%))',
};

const COMMUNITY_COLORS = [
  'hsl(var(--primary))', 'hsl(var(--chart-2, 173 58% 39%))', 'hsl(var(--chart-3, 197 37% 24%))',
  'hsl(var(--chart-4, 43 74% 66%))', 'hsl(var(--chart-5, 27 87% 67%))', '#6366f1', '#ec4899', '#14b8a6',
];

const TIPO_LABELS: Record<string, string> = { dizimo: 'Dízimo', oferta: 'Oferta', campanha: 'Campanha', eventual: 'Eventual' };
const METODO_LABELS: Record<string, string> = { pix: 'PIX', credito: 'Crédito', debito: 'Débito' };
const STATUS_LABELS: Record<string, string> = { criado: 'Criado', aguardando_pagamento: 'Aguardando', pago: 'Pago', cancelado: 'Cancelado', expirado: 'Expirado', estornado: 'Estornado' };

const TIPO_ICONS: Record<string, React.ElementType> = { dizimo: Landmark, oferta: Heart, campanha: Megaphone, eventual: Gift };
const METODO_ICONS: Record<string, React.ElementType> = { pix: Smartphone, credito: CreditCard, debito: Banknote };

const fetchAdminDashboard = async (comunidadeId: string | null) => {
  const { data, error } = await (supabase as any).rpc('get_dashboard_resumo', {
    _comunidade_id: comunidadeId,
  });
  if (error) throw error;

  const result = data as any;
  const campanhas = result.campanhas || [];
  const totalMeta = campanhas.reduce((acc: number, c: any) => acc + (Number(c.meta_financeira) || 0), 0);
  const totalArrecadadoCampanhas = campanhas.reduce((acc: number, c: any) => acc + (Number(c.total_arrecadado) || 0), 0);
  const metaAtingida = totalMeta > 0 ? Math.round((totalArrecadadoCampanhas / totalMeta) * 100) : 0;

  return {
    resumo: {
      totalMes: Number(result.total_mes) || 0,
      totalAprovados: Number(result.total_aprovados) || 0,
      totalPix: Number(result.total_pix) || 0,
      totalCartao: Number(result.total_cartao) || 0,
      metaAtingida,
      totalDizimistas: Number(result.total_dizimistas) || 0,
    },
    pagamentos12m: result.pagamentos_12m || [],
  };
};

const fetchGatewayStatus = async () => {
  const { data } = await supabase
    .from('configuracoes_gateway')
    .select('modo, ativo, nome')
    .limit(1)
    .maybeSingle();
  return (data as any)?.modo || 'simulacao';
};

const fetchUltimosPagamentos = async () => {
  const { data, error } = await supabase
    .from('pagamentos')
    .select('id, valor, tipo, metodo, status, nome_contribuinte, paroquiano_id, user_id, created_at, origem, paroquianos(nome_completo)')
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data || [];
};


const fetchCampanhasAtivas = async () => {
  const { data, error } = await supabase
    .from('campanhas')
    .select('id, nome, meta_financeira, total_arrecadado, data_inicio, data_fim, banner_url')
    .eq('ativo', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

const AdminDashboard: React.FC = () => {
  const { isSuperAdmin, comunidadeIdServo } = useAuth();
  const filtrarComunidade = !isSuperAdmin() && comunidadeIdServo ? comunidadeIdServo : null;
  const [pagamentoSelecionado, setPagamentoSelecionado] = useState<any>(null);


  const { data: dashData, isLoading: loading, isPlaceholderData } = useQuery({
    queryKey: ['admin-dashboard', filtrarComunidade],
    queryFn: () => fetchAdminDashboard(filtrarComunidade),
    placeholderData: (prev) => prev,
  });

  const { data: gatewayModo } = useQuery({
    queryKey: ['gateway-status'],
    queryFn: fetchGatewayStatus,
    staleTime: 10 * 60 * 1000,
  });

  const { data: ultimosPagamentos } = useQuery({
    queryKey: ['ultimos-pagamentos'],
    queryFn: fetchUltimosPagamentos,
    staleTime: 2 * 60 * 1000,
  });

  const { data: campanhasAtivas } = useQuery({
    queryKey: ['campanhas-ativas-dash'],
    queryFn: fetchCampanhasAtivas,
    staleTime: 5 * 60 * 1000,
  });

  const resumo = dashData?.resumo || { totalMes: 0, totalAprovados: 0, totalPix: 0, totalCartao: 0, metaAtingida: 0, totalDizimistas: 0 };
  const pagamentos12m = dashData?.pagamentos12m || [];

  const now = new Date();
  const anoAtual = getYear(now);
  const anoAnterior = anoAtual - 1;

  // Dados processados
  const dadosMensais = useMemo(() => {
    const mesesMap: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const mes = subMonths(now, i);
      mesesMap[format(mes, 'MMM/yy', { locale: ptBR })] = 0;
    }
    pagamentos12m.forEach((p: any) => {
      const key = format(new Date(p.created_at), 'MMM/yy', { locale: ptBR });
      if (key in mesesMap) mesesMap[key] += Number(p.valor);
    });
    return Object.entries(mesesMap).map(([mes, valor]) => ({ mes, valor }));
  }, [pagamentos12m]);

  const dadosTipo = useMemo(() => {
    const tipoMap: Record<string, number> = {};
    pagamentos12m.forEach((p: any) => { tipoMap[p.tipo] = (tipoMap[p.tipo] || 0) + Number(p.valor); });
    return Object.entries(tipoMap).map(([tipo, valor]) => ({ name: TIPO_LABELS[tipo] || tipo, valor, tipo }));
  }, [pagamentos12m]);

  const dadosOrigem = useMemo(() => {
    const origemMap: Record<string, number> = {};
    pagamentos12m.forEach((p: any) => { const o = p.origem || 'web'; origemMap[o] = (origemMap[o] || 0) + Number(p.valor); });
    return Object.entries(origemMap).map(([origem, valor]) => ({ origem, valor }));
  }, [pagamentos12m]);

  const dadosComunidade = useMemo(() => {
    const comMap: Record<string, { nome: string; valor: number }> = {};
    pagamentos12m.forEach((p: any) => {
      const nome = p.comunidade_nome || 'Sem comunidade';
      const key = p.comunidade_nome || '_sem';
      if (!comMap[key]) comMap[key] = { nome, valor: 0 };
      comMap[key].valor += Number(p.valor);
    });
    return Object.values(comMap).sort((a, b) => b.valor - a.valor);
  }, [pagamentos12m]);

  const comparativoMensal = useMemo(() => {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const mapAtual: Record<number, number> = {};
    const mapAnterior: Record<number, number> = {};
    for (let i = 0; i < 12; i++) { mapAtual[i] = 0; mapAnterior[i] = 0; }
    pagamentos12m.forEach((p: any) => {
      const d = new Date(p.created_at);
      const y = d.getFullYear(), m = d.getMonth();
      if (y === anoAtual) mapAtual[m] += Number(p.valor);
      else if (y === anoAnterior) mapAnterior[m] += Number(p.valor);
    });
    return meses.map((mes, i) => ({ mes, [anoAtual]: mapAtual[i], [anoAnterior]: mapAnterior[i] }));
  }, [pagamentos12m, anoAtual, anoAnterior]);

  const comparativoAnual = useMemo(() => {
    const anosMap: Record<number, { dizimo: number; oferta: number; campanha: number; eventual: number; total: number }> = {};
    pagamentos12m.forEach((p: any) => {
      const y = new Date(p.created_at).getFullYear();
      if (!anosMap[y]) anosMap[y] = { dizimo: 0, oferta: 0, campanha: 0, eventual: 0, total: 0 };
      const val = Number(p.valor);
      anosMap[y].total += val;
      const tipo = p.tipo as string;
      if (tipo in anosMap[y]) (anosMap[y] as any)[tipo] += val;
    });
    return Object.entries(anosMap).sort(([a], [b]) => Number(a) - Number(b)).map(([ano, vals]) => ({ ano, ...vals }));
  }, [pagamentos12m]);

  const { evolucaoComunidades, comunidadesNomes } = useMemo(() => {
    const comunidades = new Set<string>();
    const mesComMap: Record<string, Record<string, number>> = {};
    for (let i = 11; i >= 0; i--) {
      const mes = subMonths(now, i);
      mesComMap[format(mes, 'MMM/yy', { locale: ptBR })] = {};
    }
    pagamentos12m.forEach((p: any) => {
      const key = format(new Date(p.created_at), 'MMM/yy', { locale: ptBR });
      const com = p.comunidade_nome || 'Sem comunidade';
      comunidades.add(com);
      if (key in mesComMap) mesComMap[key][com] = (mesComMap[key][com] || 0) + Number(p.valor);
    });
    const nomes = Array.from(comunidades).sort();
    const evolucao = Object.entries(mesComMap).map(([mes, coms]) => ({
      mes, ...Object.fromEntries(nomes.map(n => [n, coms[n] || 0])),
    }));
    return { evolucaoComunidades: evolucao, comunidadesNomes: nomes };
  }, [pagamentos12m]);

  const variacao = useMemo(() => {
    const mesAtualKey = format(now, 'yyyy-MM');
    const mesAnteriorKey = format(subMonths(now, 1), 'yyyy-MM');
    let mesAtualTotal = 0, mesAnteriorTotal = 0;
    pagamentos12m.forEach((p: any) => {
      const k = format(new Date(p.created_at), 'yyyy-MM');
      if (k === mesAtualKey) mesAtualTotal += Number(p.valor);
      else if (k === mesAnteriorKey) mesAnteriorTotal += Number(p.valor);
    });
    const percentual = mesAnteriorTotal > 0
      ? ((mesAtualTotal - mesAnteriorTotal) / mesAnteriorTotal) * 100
      : mesAtualTotal > 0 ? 100 : 0;
    return { mesAtual: mesAtualTotal, mesAnterior: mesAnteriorTotal, percentual };
  }, [pagamentos12m]);

  // Resumo por tipo do mês atual
  const resumoPorTipo = useMemo(() => {
    const mesAtualKey = format(now, 'yyyy-MM');
    const tipos: Record<string, number> = { dizimo: 0, oferta: 0, campanha: 0, eventual: 0 };
    pagamentos12m.forEach((p: any) => {
      const k = format(new Date(p.created_at), 'yyyy-MM');
      if (k === mesAtualKey && p.tipo in tipos) tipos[p.tipo] += Number(p.valor);
    });
    return tipos;
  }, [pagamentos12m]);

  const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatTooltip = (v: number) => formatBRL(v);

  const summaryCards = [
    { title: 'Arrecadado este mês', value: formatBRL(resumo.totalMes), icon: DollarSign, sub: `PIX: ${formatBRL(resumo.totalPix)} | Cartão: ${formatBRL(resumo.totalCartao)}`, color: 'text-primary', extra: variacao.percentual !== 0 ? variacao : null },
    { title: 'Pagamentos aprovados', value: resumo.totalAprovados.toString(), icon: CreditCard, sub: 'Total histórico', color: 'text-green-600', extra: null },
    { title: 'Dizimistas ativos', value: resumo.totalDizimistas.toString(), icon: Users, sub: 'Paroquianos cadastrados', color: 'text-blue-600', extra: null },
    { title: 'Meta campanhas', value: `${resumo.metaAtingida}%`, icon: Target, sub: 'Campanhas ativas', color: 'text-orange-600', extra: null },
  ];

  const gatewayBanner = gatewayModo ? (() => {
    if (gatewayModo === 'producao') return { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-800', label: 'PRODUÇÃO', desc: 'Gateway e.Rede em produção. Pagamentos reais estão sendo processados.', icon: CheckCircle2, iconColor: 'text-green-600' };
    if (gatewayModo === 'sandbox') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500', text: 'text-amber-800', label: 'SANDBOX', desc: 'Gateway e.Rede em modo sandbox. Pagamentos de teste, não reais.', icon: AlertCircle, iconColor: 'text-amber-600' };
    return { bg: 'bg-muted border-border', dot: 'bg-muted-foreground', text: 'text-muted-foreground', label: 'SIMULAÇÃO', desc: 'Gateway em modo de simulação. Nenhuma integração real ativa.', icon: AlertCircle, iconColor: 'text-muted-foreground' };
  })() : null;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pago: 'bg-green-100 text-green-700 border-green-200',
      criado: 'bg-blue-100 text-blue-700 border-blue-200',
      aguardando_pagamento: 'bg-amber-100 text-amber-700 border-amber-200',
      cancelado: 'bg-red-100 text-red-700 border-red-200',
      expirado: 'bg-gray-100 text-gray-600 border-gray-200',
      estornado: 'bg-purple-100 text-purple-700 border-purple-200',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${variants[status] || 'bg-muted text-muted-foreground border-border'}`}>
        {STATUS_LABELS[status] || status}
      </span>
    );
  };

  if (loading && !dashData) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="h-8 w-48 rounded bg-muted animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
          <div className="h-64 rounded-xl bg-muted animate-pulse" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Visão geral das contribuições e arrecadação</p>
        </div>

        {/* Banner status gateway */}
        {gatewayBanner && (
          <div className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${gatewayBanner.bg}`}>
            <div className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${gatewayBanner.dot} animate-pulse`} />
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${gatewayBanner.text}`}>
                  Gateway e.Rede — {gatewayBanner.label}
                </p>
                <p className={`text-xs mt-0.5 ${gatewayBanner.text} opacity-80`}>{gatewayBanner.desc}</p>
              </div>
            </div>
            <Link to="/admin/configuracoes">
              <button className={`text-xs font-medium flex items-center gap-1 underline underline-offset-2 ${gatewayBanner.text} opacity-70 hover:opacity-100 shrink-0`}>
                <Settings className="h-3.5 w-3.5" />
                Configurar
              </button>
            </Link>
          </div>
        )}

        {/* Cards de resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {summaryCards.map((card) => (
            <Card key={card.title}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground font-medium">{card.title}</p>
                    <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                    {card.extra && (
                      <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${card.extra.percentual >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {card.extra.percentual >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                        {Math.abs(card.extra.percentual).toFixed(1)}% vs mês anterior
                      </div>
                    )}
                  </div>
                  <div className={`p-2 rounded-lg bg-muted ${card.color}`}>
                    <card.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── RESUMO POR TIPO DO MÊS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['dizimo', 'oferta', 'campanha', 'eventual'] as const).map((tipo) => {
            const TipoIcon = TIPO_ICONS[tipo];
            const tipoColors: Record<string, string> = {
              dizimo: 'text-primary bg-primary/10 border-primary/20',
              oferta: 'text-rose-600 bg-rose-50 border-rose-200',
              campanha: 'text-violet-600 bg-violet-50 border-violet-200',
              eventual: 'text-emerald-600 bg-emerald-50 border-emerald-200',
            };
            return (
              <Card key={tipo} className={`border ${tipoColors[tipo].split(' ').slice(2).join(' ')}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded-md ${tipoColors[tipo].split(' ').slice(1, 2).join(' ')}`}>
                      <TipoIcon className={`h-4 w-4 ${tipoColors[tipo].split(' ')[0]}`} />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{TIPO_LABELS[tipo]}</span>
                  </div>
                  <p className={`text-lg font-bold ${tipoColors[tipo].split(' ')[0]}`}>
                    {formatBRL(resumoPorTipo[tipo])}
                  </p>
                  <p className="text-xs text-muted-foreground">Este mês</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ── ÚLTIMOS PAGAMENTOS ── */}
        <GatewayMetricsCard dias={30} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              Últimos Pagamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!ultimosPagamentos || ultimosPagamentos.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                Nenhum pagamento registrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Data / Hora</TableHead>
                      <TableHead className="text-xs">Fiel / Dizimista</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Método</TableHead>
                      <TableHead className="text-xs text-right">Valor</TableHead>
                      <TableHead className="text-xs text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ultimosPagamentos.map((p: any) => {
                      const TIcon = TIPO_ICONS[p.tipo] || HandCoins;
                      const MIcon = METODO_ICONS[p.metodo] || CreditCard;
                      return (
                        <TableRow
                          key={p.id}
                          onClick={() => setPagamentoSelecionado(p)}
                          className="cursor-pointer hover:bg-muted/60"
                          title="Clique para ver detalhes"
                        >
                          <TableCell className="text-xs whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              {format(new Date(p.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium max-w-[180px] truncate">
                            {(p as any).paroquianos?.nome_completo || p.nome_contribuinte || 'Anônimo'}
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <TIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs">{TIPO_LABELS[p.tipo] || p.tipo}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <MIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs">{METODO_LABELS[p.metodo] || p.metodo}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-semibold text-right whitespace-nowrap">
                            {formatBRL(Number(p.valor))}
                          </TableCell>
                          <TableCell className="text-center">
                            {getStatusBadge(p.status)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!pagamentoSelecionado} onOpenChange={(o) => !o && setPagamentoSelecionado(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Detalhes do Pagamento
              </DialogTitle>
              <DialogDescription>
                ID: <span className="font-mono">{pagamentoSelecionado?.id?.slice(0, 8)}…</span>
              </DialogDescription>
            </DialogHeader>
            {pagamentoSelecionado && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Valor</p>
                    <p className="text-lg font-semibold">{formatBRL(Number(pagamentoSelecionado.valor))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <div>{getStatusBadge(pagamentoSelecionado.status)}</div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo</p>
                    <p className="font-medium">{TIPO_LABELS[pagamentoSelecionado.tipo] || pagamentoSelecionado.tipo}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Método</p>
                    <p className="font-medium">{METODO_LABELS[pagamentoSelecionado.metodo] || pagamentoSelecionado.metodo}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Origem</p>
                    <p className="font-medium capitalize">{pagamentoSelecionado.origem || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Data / Hora</p>
                    <p className="font-medium">{format(new Date(pagamentoSelecionado.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
                  </div>
                </div>
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground">{pagamentoSelecionado.tipo === 'dizimo' ? 'Dizimista' : 'Fiel'}</p>
                  <p className="font-medium">{pagamentoSelecionado.paroquianos?.nome_completo || pagamentoSelecionado.nome_contribuinte || 'Anônimo'}</p>

                  {pagamentoSelecionado.paroquiano_id && (
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      Paroquiano: {pagamentoSelecionado.paroquiano_id.slice(0, 8)}…
                    </p>
                  )}
                </div>
                <div className="pt-2">
                  <Link
                    to={`/admin/pagamentos?id=${pagamentoSelecionado.id}`}
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Ver na lista de pagamentos
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>


        {/* ── CAMPANHAS ATIVAS ── */}
        {campanhasAtivas && campanhasAtivas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                Campanhas Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {campanhasAtivas.map((c: any) => {
                  const meta = Number(c.meta_financeira) || 0;
                  const arrecadado = Number(c.total_arrecadado) || 0;
                  const pct = meta > 0 ? Math.min(Math.round((arrecadado / meta) * 100), 100) : 0;
                  return (
                    <div key={c.id} className="rounded-lg border bg-card p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-sm text-foreground">{c.nome}</h4>
                          {c.data_fim && (
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <CalendarRange className="h-3 w-3" />
                              até {format(new Date(c.data_fim), 'dd/MM/yyyy')}
                            </p>
                          )}
                        </div>
                        <Megaphone className="h-5 w-5 text-violet-500 shrink-0" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Arrecadado</span>
                          <span className="font-semibold text-foreground">{meta > 0 ? `${pct}%` : '—'}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--gold, 40 75% 50%)))',
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs mt-1.5">
                          <span className="font-medium text-primary">{formatBRL(arrecadado)}</span>
                          {meta > 0 && <span className="text-muted-foreground">Meta: {formatBRL(meta)}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Gráfico de barras — últimos 12 meses */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Arrecadação — últimos 12 meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dadosMensais} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={formatTooltip} />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Arrecadado" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ── COMPARATIVOS ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-primary" />
              Comparativos de Arrecadação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="mes-a-mes" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="mes-a-mes" className="text-xs">Mês a Mês</TabsTrigger>
                <TabsTrigger value="ano-a-ano" className="text-xs">Ano a Ano</TabsTrigger>
                <TabsTrigger value="comunidades" className="text-xs">Por Comunidade</TabsTrigger>
              </TabsList>

              <TabsContent value="mes-a-mes">
                {comparativoMensal.length === 0 ? (
                  <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
                ) : (
                  <div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Comparação mensal: <strong className="text-primary">{anoAtual}</strong> vs <strong className="text-muted-foreground">{anoAnterior}</strong>
                    </p>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={comparativoMensal} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={formatTooltip} />
                        <Legend />
                        <Bar dataKey={anoAtual.toString()} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={`${anoAtual}`} />
                        <Bar dataKey={anoAnterior.toString()} fill="hsl(var(--muted-foreground))" opacity={0.4} radius={[4, 4, 0, 0]} name={`${anoAnterior}`} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="ano-a-ano">
                {comparativoAnual.length === 0 ? (
                  <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
                ) : (
                  <div>
                    <p className="text-xs text-muted-foreground mb-3">Total arrecadado por ano, separado por tipo</p>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={comparativoAnual} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="ano" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={formatTooltip} />
                        <Legend />
                        <Bar dataKey="dizimo" stackId="a" fill={COLORS_TIPO.dizimo} name="Dízimo" />
                        <Bar dataKey="oferta" stackId="a" fill={COLORS_TIPO.oferta} name="Oferta" />
                        <Bar dataKey="campanha" stackId="a" fill={COLORS_TIPO.campanha} name="Campanha" />
                        <Bar dataKey="eventual" stackId="a" fill={COLORS_TIPO.eventual} name="Eventual" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="comunidades">
                {comunidadesNomes.length === 0 ? (
                  <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
                ) : (
                  <div>
                    <p className="text-xs text-muted-foreground mb-3">Evolução mensal de arrecadação por comunidade</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={evolucaoComunidades} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={formatTooltip} />
                        <Legend />
                        {comunidadesNomes.map((nome, i) => (
                          <Area key={nome} type="monotone" dataKey={nome} stackId="1" stroke={COMMUNITY_COLORS[i % COMMUNITY_COLORS.length]} fill={COMMUNITY_COLORS[i % COMMUNITY_COLORS.length]} fillOpacity={0.3} name={nome} />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Gráficos secundários */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <QrCode className="h-4 w-4 text-primary" />
                Distribuição por tipo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dadosTipo.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={dadosTipo} dataKey="valor" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {dadosTipo.map((entry, index) => (
                        <Cell key={entry.tipo} fill={COLORS_TIPO[entry.tipo as keyof typeof COLORS_TIPO] || `hsl(${index * 60}, 60%, 50%)`} />
                      ))}
                    </Pie>
                    <Tooltip formatter={formatTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HandCoins className="h-4 w-4 text-primary" />
                Arrecadação por canal
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dadosOrigem.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dadosOrigem} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <YAxis dataKey="origem" type="category" tick={{ fontSize: 12 }} />
                    <Tooltip formatter={formatTooltip} />
                    <Bar dataKey="valor" radius={[0, 4, 4, 0]} name="Arrecadado">
                      {dadosOrigem.map((entry, index) => (
                        <Cell key={entry.origem} fill={COLORS_ORIGEM[entry.origem as keyof typeof COLORS_ORIGEM] || `hsl(${index * 60}, 60%, 50%)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Arrecadação por Comunidade */}
        {dadosComunidade.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Arrecadação por Comunidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(200, dadosComunidade.length * 40)}>
                <BarChart data={dadosComunidade} layout="vertical" margin={{ left: 30, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="nome" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={formatTooltip} />
                  <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Arrecadado" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
