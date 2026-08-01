import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/contexts/ThemeContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search, FileDown, Plus, MoreHorizontal, Copy, CheckCircle2,
  XCircle, Ban, RefreshCw, User, Calendar, CreditCard, Hash, MapPin,
  ShieldCheck, ImageDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { gerarComprovantePNG } from '@/components/admin/ComprovanteCanvas';
import { registrarAuditoria } from '@/lib/audit';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
type Pagamento = {
  id: string;
  created_at: string;
  valor: number;
  tipo: string;
  metodo: string;
  status: string;
  origem: string | null;
  paroquiano_id: string | null;
  campanha_id: string | null;
  pago_em: string | null;
  cancelado_em: string | null;
  codigo_autenticacao: string | null;
  nome_contribuinte: string | null;
  descricao: string | null;
  mes_referencia: string | null;
  paroquianos?: { nome_completo: string } | null;
  campanhas?: { nome: string } | null;
};

type Paroquiano = { id: string; nome_completo: string; cpf: string | null };
type Campanha = { id: string; nome: string };
type Comunidade = { id: string; nome: string };

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pago: 'bg-green-100 text-green-700 border-green-200',
  criado: 'bg-blue-100 text-blue-700 border-blue-200',
  aguardando_pagamento: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  cancelado: 'bg-red-100 text-red-700 border-red-200',
  expirado: 'bg-gray-100 text-gray-600 border-gray-200',
  estornado: 'bg-purple-100 text-purple-700 border-purple-200',
};

const TIPO_LABELS: Record<string, string> = {
  dizimo: 'Dízimo', oferta: 'Oferta', campanha: 'Campanha', eventual: 'Eventual'
};
const METODO_LABELS: Record<string, string> = {
  pix: 'PIX', credito: 'Crédito', debito: 'Débito'
};
const ORIGEM_LABELS: Record<string, string> = {
  web: 'Web', totem: 'Totem', admin: 'Admin', kiosk: 'Kiosk'
};

// ────────────────────────────────────────────────────────────
// Helper components
// ────────────────────────────────────────────────────────────
const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
    <span className="text-sm font-medium text-foreground">{value}</span>
  </div>
);

// ────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────
const AdminPagamentos: React.FC = () => {
  const { isSuperAdmin, comunidadeIdServo } = useAuth();
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    tipo: 'todos', status: 'todos', metodo: 'todos', origem: 'todos', comunidade: 'todos', busca: ''
  });
  const [comunidades, setComunidades] = useState<Comunidade[]>([]);
  const [pagina, setPagina] = useState(0);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const POR_PAGINA = 30;

  // Sheet de detalhes
  const [sheetAberto, setSheetAberto] = useState(false);
  const [pagamentoSelecionado, setPagamentoSelecionado] = useState<Pagamento | null>(null);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [processandoAcao, setProcessandoAcao] = useState(false);
  const [gerandoPNG, setGerandoPNG] = useState(false);

  // Modal de criação
  const [modalCriar, setModalCriar] = useState(false);
  const [buscaDizimista, setBuscaDizimista] = useState('');
  const [paroquianos, setParoquianos] = useState<Paroquiano[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loadingDizimistas, setLoadingDizimistas] = useState(false);
  const [form, setForm] = useState({
    paroquiano_id: '',
    tipo: 'dizimo' as string,
    campanha_id: '',
    valor: '',
    metodo: 'pix' as string,
    status: 'pago' as string,
    observacao: '',
  });
  const [salvando, setSalvando] = useState(false);

  const { toast } = useToast();
  const { tema } = useTheme();

  // ── fetch ──────────────────────────────────────────────────
  const fetchPagamentos = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('pagamentos')
      .select('*, mes_referencia, paroquianos(nome_completo, comunidade_id, comunidades(id, nome)), campanhas(nome)', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply server-side filters
    if (filtros.tipo !== 'todos') query = query.eq('tipo', filtros.tipo as any);
    if (filtros.status !== 'todos') query = query.eq('status', filtros.status as any);
    if (filtros.metodo !== 'todos') query = query.eq('metodo', filtros.metodo as any);
    if (filtros.origem !== 'todos') query = query.eq('origem', filtros.origem);

    // Colaboradores vêem apenas pagamentos da sua comunidade
    if (!isSuperAdmin() && comunidadeIdServo) {
      const { data: pIds } = await supabase
        .from('paroquianos')
        .select('id')
        .eq('comunidade_id', comunidadeIdServo);
      const ids = (pIds || []).map((p: any) => p.id);
      if (ids.length > 0) {
        query = query.in('paroquiano_id', ids);
      } else {
        setPagamentos([]);
        setTotalRegistros(0);
        setLoading(false);
        return;
      }
    }

    // Pagination
    const from = pagina * POR_PAGINA;
    const to = from + POR_PAGINA - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      toast({ title: 'Erro ao carregar pagamentos', variant: 'destructive' });
    } else {
      setPagamentos((data as any) || []);
      setTotalRegistros(count || 0);
    }
    setLoading(false);
  }, [toast, comunidadeIdServo, filtros.tipo, filtros.status, filtros.metodo, filtros.origem, pagina]);

  useEffect(() => { fetchPagamentos(); }, [fetchPagamentos]);

  // Reset page when filters change
  useEffect(() => { setPagina(0); }, [filtros.tipo, filtros.status, filtros.metodo, filtros.origem]);

  // Fetch communities
  useEffect(() => {
    supabase.from('comunidades').select('id, nome').eq('ativo', true).order('nome')
      .then(({ data }) => setComunidades((data as any) || []));
  }, []);

  // Autocomplete de dizimistas
  useEffect(() => {
    if (!modalCriar) return;
    const delay = setTimeout(async () => {
      if (buscaDizimista.length < 2) { setParoquianos([]); return; }
      setLoadingDizimistas(true);
      const { data } = await supabase
        .from('paroquianos')
        .select('id, nome_completo, cpf')
        .or(`nome_completo.ilike.%${buscaDizimista}%,cpf.ilike.%${buscaDizimista}%`)
        .eq('status', 'ativo')
        .limit(10);
      setParoquianos((data as any) || []);
      setLoadingDizimistas(false);
    }, 300);
    return () => clearTimeout(delay);
  }, [buscaDizimista, modalCriar]);

  // Campanhas ativas
  useEffect(() => {
    if (!modalCriar) return;
    supabase.from('campanhas').select('id, nome').eq('ativo', true).order('nome')
      .then(({ data }) => setCampanhas((data as any) || []));
  }, [modalCriar]);

  // ── filtros (only client-side for busca and comunidade now) ──
  const pagamentosFiltrados = pagamentos.filter(p => {
    if (filtros.comunidade !== 'todos') {
      const comId = (p.paroquianos as any)?.comunidade_id;
      if (filtros.comunidade === 'sem_comunidade') {
        if (comId) return false;
      } else {
        if (comId !== filtros.comunidade) return false;
      }
    }
    if (filtros.busca) {
      const nome = (p.paroquianos as any)?.nome_completo?.toLowerCase()
        || p.nome_contribuinte?.toLowerCase()
        || '';
      if (!nome.includes(filtros.busca.toLowerCase()) && !p.id.includes(filtros.busca)) return false;
    }
    return true;
  });

  const totalFiltrado = pagamentosFiltrados
    .filter(p => p.status === 'pago')
    .reduce((acc, p) => acc + Number(p.valor), 0);

  const totalPaginas = Math.ceil(totalRegistros / POR_PAGINA);

  // ── export PDF ─────────────────────────────────────────────
  const exportPDF = () => {
    const totalAprovado = pagamentosFiltrados
      .filter(p => p.status === 'pago')
      .reduce((acc, p) => acc + Number(p.valor), 0);

    const linhas = pagamentosFiltrados.map(p => `
      <tr style="border-bottom:1px solid #f0eae2">
        <td style="padding:5px 6px;font-size:11px">${format(new Date(p.created_at), 'dd/MM/yy HH:mm')}</td>
        <td style="padding:5px 6px;font-size:11px">${(p.paroquianos as any)?.nome_completo || p.nome_contribuinte || 'Anônimo'}</td>
        <td style="padding:5px 6px;font-size:11px">${TIPO_LABELS[p.tipo] || p.tipo}</td>
        <td style="padding:5px 6px;font-size:11px;text-align:right;font-weight:600;color:#6b1a2a">${Number(p.valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
        <td style="padding:5px 6px;font-size:11px">${METODO_LABELS[p.metodo] || p.metodo}</td>
        <td style="padding:5px 6px;font-size:10px">
          <span style="background:${p.status==='pago'?'#dcfce7':p.status==='cancelado'?'#fee2e2':'#fef9c3'};color:${p.status==='pago'?'#166534':p.status==='cancelado'?'#991b1b':'#854d0e'};padding:2px 6px;border-radius:9999px">
            ${p.status.replace(/_/g,' ')}
          </span>
        </td>
        <td style="padding:5px 6px;font-size:11px;text-transform:capitalize">${ORIGEM_LABELS[p.origem||'web']||p.origem||'web'}</td>
      </tr>`).join('');

    const filtrosAtivos = [
      filtros.tipo !== 'todos' ? `Tipo: ${TIPO_LABELS[filtros.tipo]}` : '',
      filtros.status !== 'todos' ? `Status: ${filtros.status}` : '',
      filtros.metodo !== 'todos' ? `Método: ${METODO_LABELS[filtros.metodo]}` : '',
      filtros.origem !== 'todos' ? `Origem: ${ORIGEM_LABELS[filtros.origem]}` : '',
      filtros.busca ? `Busca: "${filtros.busca}"` : '',
    ].filter(Boolean).join(' · ');

    const html = `
      <div style="font-family:Georgia,serif;color:#1a0a0a;padding:20px;max-width:960px;margin:0 auto">
        <div style="text-align:center;border-bottom:2px solid #8a6a1e;padding-bottom:12px;margin-bottom:16px">
          <h2 style="font-size:18px;margin:0;color:#6b1a2a">${tema.nome || 'Paróquia'}</h2>
          <h3 style="font-size:14px;margin:8px 0 0;color:#1a0a0a">RELATÓRIO DE PAGAMENTOS</h3>
          ${filtrosAtivos ? `<p style="font-size:11px;margin:4px 0;color:#888">Filtros: ${filtrosAtivos}</p>` : ''}
          <p style="font-size:11px;margin:4px 0;color:#555">Gerado em ${format(new Date(),"dd/MM/yyyy 'às' HH:mm",{locale:ptBR})}</p>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#6b1a2a;color:#fff">
              <th style="padding:7px 6px;text-align:left;font-size:11px">Data</th>
              <th style="padding:7px 6px;text-align:left;font-size:11px">Fiel</th>
              <th style="padding:7px 6px;text-align:left;font-size:11px">Tipo</th>
              <th style="padding:7px 6px;text-align:right;font-size:11px">Valor</th>
              <th style="padding:7px 6px;text-align:left;font-size:11px">Método</th>
              <th style="padding:7px 6px;text-align:left;font-size:11px">Status</th>
              <th style="padding:7px 6px;text-align:left;font-size:11px">Origem</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
        <div style="border-top:2px solid #8a6a1e;margin-top:12px;padding-top:10px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:12px;color:#555">${pagamentosFiltrados.length} registros · ${pagamentosFiltrados.filter(p=>p.status==='pago').length} aprovados</span>
          <span style="font-size:14px;font-weight:bold;color:#6b1a2a">Total aprovado: ${totalAprovado.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
        </div>
      </div>`;

    const div = document.createElement('div');
    div.id = 'pagamentos-print-root';
    div.innerHTML = html;
    div.style.display = 'none';
    document.body.appendChild(div);
    document.body.classList.add('print-pagamentos');

    const afterPrint = () => {
      document.body.classList.remove('print-pagamentos');
      document.body.removeChild(div);
      window.removeEventListener('afterprint', afterPrint);
    };
    window.addEventListener('afterprint', afterPrint);
    window.print();
  };

  // ── sheet detalhes ─────────────────────────────────────────
  const abrirDetalhes = (p: Pagamento) => {
    setPagamentoSelecionado(p);
    setSheetAberto(true);
  };

  const copiarId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast({ title: 'ID copiado!' });
  };

  const cancelarPagamento = async () => {
    if (!pagamentoSelecionado) return;
    setProcessandoAcao(true);
    const { error } = await (supabase
      .from('pagamentos')
      .update({ status: 'cancelado', cancelado_em: new Date().toISOString() })
      .eq('id', pagamentoSelecionado.id) as any);

    if (error) {
      toast({ title: 'Erro ao cancelar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Pagamento cancelado' });
      await registrarAuditoria({ acao: 'cancelar_pagamento', entidade: 'pagamentos', entidade_id: pagamentoSelecionado.id, detalhes: { valor: pagamentoSelecionado.valor, tipo: pagamentoSelecionado.tipo } });
      setConfirmandoCancelar(false);
      setSheetAberto(false);
      fetchPagamentos();
    }
    setProcessandoAcao(false);
  };

  const marcarComoPago = async () => {
    if (!pagamentoSelecionado) return;
    setProcessandoAcao(true);
    const { error } = await (supabase
      .from('pagamentos')
      .update({ status: 'pago', pago_em: new Date().toISOString() })
      .eq('id', pagamentoSelecionado.id) as any);

    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Pagamento marcado como pago!' });
      setSheetAberto(false);
      fetchPagamentos();
    }
    setProcessandoAcao(false);
  };

  // Baixar comprovante PNG
  const baixarComprovantePNG = async () => {
    if (!pagamentoSelecionado) return;
    setGerandoPNG(true);
    try {
      // Buscar dados da paróquia
      const { data: paroquiaData } = await (supabase.from('configuracoes_paroquia' as any) as any)
        .select('nome, cnpj, site, telefone, logo_url')
        .limit(1)
        .maybeSingle();

      await gerarComprovantePNG(
        pagamentoSelecionado as any,
        {
          nome: paroquiaData?.nome || tema.nome || 'Paróquia',
          cnpj: paroquiaData?.cnpj,
          site: paroquiaData?.site,
          telefone: paroquiaData?.telefone,
          logoUrl: paroquiaData?.logo_url || tema.logoUrl,
        }
      );
      toast({ title: 'Comprovante gerado!', description: 'O download foi iniciado automaticamente.' });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar comprovante', description: e.message, variant: 'destructive' });
    }
    setGerandoPNG(false);
  };
  const abrirModalCriar = () => {
    setForm({ paroquiano_id: '', tipo: 'dizimo', campanha_id: '', valor: '', metodo: 'pix', status: 'pago', observacao: '' });
    setBuscaDizimista('');
    setParoquianos([]);
    setModalCriar(true);
  };

  const criarPagamento = async () => {
    const valorNum = parseFloat(form.valor.replace(',', '.'));
    if (!valorNum || valorNum <= 0) {
      toast({ title: 'Informe um valor válido', variant: 'destructive' });
      return;
    }
    if (form.tipo === 'campanha' && !form.campanha_id) {
      toast({ title: 'Selecione uma campanha', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    const pago_em = form.status === 'pago' ? new Date().toISOString() : undefined;
    const insertData = {
      valor: valorNum,
      tipo: form.tipo as "dizimo" | "oferta" | "campanha" | "eventual",
      metodo: form.metodo as "pix" | "credito" | "debito",
      status: form.status as "pago" | "aguardando_pagamento" | "criado" | "cancelado" | "expirado" | "estornado",
      origem: 'admin',
      user_id: null as string | null,
      paroquiano_id: form.paroquiano_id || null as string | null,
      campanha_id: (form.tipo === 'campanha' && form.campanha_id ? form.campanha_id : null) as string | null,
      pago_em: pago_em ?? null,
    };

    const { error } = await supabase.from('pagamentos').insert(insertData as any);
    if (error) {
      toast({ title: 'Erro ao registrar pagamento', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Pagamento registrado com sucesso!' });
      setModalCriar(false);
      fetchPagamentos();
    }
    setSalvando(false);
  };

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pagamentos</h1>
            <p className="text-muted-foreground text-sm">
              {totalRegistros} registros · Total aprovado (página):{' '}
              {totalFiltrado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={exportPDF} variant="outline" size="sm">
              <FileDown className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
            <Button onClick={abrirModalCriar} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Registrar Pagamento
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
              <div className="col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou ID..."
                  className="pl-9"
                  value={filtros.busca}
                  onChange={e => setFiltros(f => ({ ...f, busca: e.target.value }))}
                />
              </div>
              <Select value={filtros.tipo} onValueChange={v => setFiltros(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="dizimo">Dízimo</SelectItem>
                  <SelectItem value="oferta">Oferta</SelectItem>
                  <SelectItem value="campanha">Campanha</SelectItem>
                  <SelectItem value="eventual">Eventual</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtros.status} onValueChange={v => setFiltros(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="aguardando_pagamento">Aguardando</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                  <SelectItem value="expirado">Expirado</SelectItem>
                  <SelectItem value="estornado">Estornado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtros.metodo} onValueChange={v => setFiltros(f => ({ ...f, metodo: v }))}>
                <SelectTrigger><SelectValue placeholder="Método" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos métodos</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtros.origem} onValueChange={v => setFiltros(f => ({ ...f, origem: v }))}>
                <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas origens</SelectItem>
                  <SelectItem value="web">Web</SelectItem>
                  <SelectItem value="totem">Totem</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="kiosk">Kiosk</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtros.comunidade} onValueChange={v => setFiltros(f => ({ ...f, comunidade: v }))}>
                <SelectTrigger><SelectValue placeholder="Comunidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas comunidades</SelectItem>
                  <SelectItem value="sem_comunidade">Sem comunidade</SelectItem>
                  {comunidades.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabela — desktop */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : pagamentosFiltrados.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhum pagamento encontrado.</div>
            ) : (
              <>
                {/* Cards — mobile */}
                <div className="sm:hidden divide-y divide-border">
                  {pagamentosFiltrados.slice(0, 200).map(p => (
                    <div
                      key={p.id}
                      className="p-4 cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => abrirDetalhes(p)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">
                            {(p.paroquianos as any)?.nome_completo || p.nome_contribuinte || 'Anônimo'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(p.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                          </p>
                        </div>
                        <span className="text-base font-bold text-primary shrink-0">
                          {Number(p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[p.status] || 'bg-muted text-foreground'}`}>
                          {p.status.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {TIPO_LABELS[p.tipo] || p.tipo}
                        </span>
                        <span className="text-xs text-muted-foreground">{METODO_LABELS[p.metodo]}</span>
                        <span className="text-xs text-muted-foreground capitalize">{ORIGEM_LABELS[p.origem||'web']}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tabela — desktop */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Fiel</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagamentosFiltrados.slice(0, 200).map(p => (
                        <TableRow
                          key={p.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => abrirDetalhes(p)}
                        >
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(p.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            {(p.paroquianos as any)?.nome_completo || p.nome_contribuinte || (
                              <span className="text-muted-foreground italic">Anônimo</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {(p as any).descricao ? (
                              <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded-full tracking-tight">
                                {(p as any).descricao}
                              </span>
                            ) : (
                              <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                                {TIPO_LABELS[p.tipo] || p.tipo}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold text-primary">
                            {Number(p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </TableCell>
                          <TableCell className="text-xs">{METODO_LABELS[p.metodo] || p.metodo}</TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[p.status] || 'bg-muted text-foreground'}`}>
                              {p.status.replace(/_/g, ' ')}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs capitalize text-muted-foreground">
                            {ORIGEM_LABELS[p.origem || 'web'] || p.origem || 'web'}
                          </TableCell>
                          <TableCell onClick={e => { e.stopPropagation(); abrirDetalhes(p); }}>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination controls */}
                {totalPaginas > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-xs text-muted-foreground">
                      Página {pagina + 1} de {totalPaginas} · {totalRegistros} registros
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagina === 0}
                        onClick={() => setPagina(p => Math.max(0, p - 1))}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagina >= totalPaginas - 1}
                        onClick={() => setPagina(p => p + 1)}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════
          Sheet — Detalhes do Pagamento
      ═══════════════════════════════════════════════════════ */}
      <Sheet open={sheetAberto} onOpenChange={setSheetAberto}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {pagamentoSelecionado && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle>Detalhes do Pagamento</SheetTitle>
                <SheetDescription>
                  Criado em {format(new Date(pagamentoSelecionado.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </SheetDescription>
              </SheetHeader>

              {/* Valor em destaque */}
              <div className="rounded-xl bg-primary/10 border border-primary/20 px-5 py-4 mb-6 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Valor</p>
                <p className="text-3xl font-bold text-primary">
                  {Number(pagamentoSelecionado.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <span className={`mt-2 inline-block text-xs px-3 py-1 rounded-full border font-medium ${STATUS_COLORS[pagamentoSelecionado.status] || 'bg-muted'}`}>
                  {pagamentoSelecionado.status.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {/* ID */}
                <div className="flex items-center justify-between rounded-lg border p-3 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">ID do Pagamento</p>
                    <p className="text-sm font-mono text-foreground mt-0.5">{pagamentoSelecionado.id.slice(0, 18)}...</p>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => copiarId(pagamentoSelecionado.id)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <InfoRow
                     label={pagamentoSelecionado.tipo === 'dizimo' ? 'Dizimista' : 'Fiel'}
                     value={
                       (pagamentoSelecionado.paroquianos as any)?.nome_completo
                       || pagamentoSelecionado.nome_contribuinte
                       || <span className="italic text-muted-foreground">Anônimo</span>
                     }
                   />
                   <InfoRow
                     label="Tipo de Contribuição"
                     value={TIPO_LABELS[pagamentoSelecionado.tipo] || pagamentoSelecionado.tipo}
                   />
                   {(pagamentoSelecionado as any).descricao && (
                     <InfoRow
                       label="Código da Transação"
                       value={<span className="font-mono text-xs tracking-tight">{(pagamentoSelecionado as any).descricao}</span>}
                     />
                   )}
                   {pagamentoSelecionado.tipo === 'dizimo' && pagamentoSelecionado.mes_referencia && (
                     <InfoRow
                       label="📅 Mês de Referência"
                       value={
                         <span className="font-semibold text-primary">
                           {new Date(pagamentoSelecionado.mes_referencia + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                         </span>
                       }
                     />
                   )}
                  <InfoRow
                    label="Método de Pagamento"
                    value={METODO_LABELS[pagamentoSelecionado.metodo] || pagamentoSelecionado.metodo}
                  />
                  <InfoRow
                    label="Origem"
                    value={ORIGEM_LABELS[pagamentoSelecionado.origem || 'web'] || pagamentoSelecionado.origem || 'web'}
                  />
                  {pagamentoSelecionado.pago_em && (
                    <InfoRow
                      label="Data de Pagamento"
                      value={format(new Date(pagamentoSelecionado.pago_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    />
                  )}
                  {pagamentoSelecionado.cancelado_em && (
                    <InfoRow
                      label="Data de Cancelamento"
                      value={format(new Date(pagamentoSelecionado.cancelado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    />
                  )}
                  {pagamentoSelecionado.codigo_autenticacao && (
                    <InfoRow
                      label="Código de Autenticação"
                      value={<span className="font-mono text-xs">{pagamentoSelecionado.codigo_autenticacao}</span>}
                    />
                  )}
                  {(pagamentoSelecionado.campanhas as any)?.nome && (
                    <InfoRow
                      label="Campanha"
                      value={(pagamentoSelecionado.campanhas as any).nome}
                    />
                  )}
                </div>
              </div>

              {/* Ações */}
              <div className="mt-6 space-y-2 border-t pt-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">Ações</p>

                {/* Banner de pagamento confirmado (anti-fraude) */}
                {pagamentoSelecionado.status === 'pago' && (
                  <div className="flex items-center gap-3 rounded-lg bg-accent border border-border px-4 py-3 mb-3">
                    <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Pagamento Confirmado</p>
                      <p className="text-xs text-muted-foreground">
                        Confirmado em {pagamentoSelecionado.pago_em
                          ? format(new Date(pagamentoSelecionado.pago_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                          : '—'}. Nenhuma ação manual é permitida.
                      </p>
                    </div>
                  </div>
                )}

                {/* Botão baixar PNG (apenas pagos) */}
                {pagamentoSelecionado.status === 'pago' && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={baixarComprovantePNG}
                    disabled={gerandoPNG}
                  >
                    {gerandoPNG ? (
                      <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Gerando...</>
                    ) : (
                      <><ImageDown className="h-4 w-4 mr-2" />Baixar Comprovante PNG</>
                    )}
                  </Button>
                )}

                {pagamentoSelecionado.status === 'aguardando_pagamento' && (
                  <Button
                    className="w-full"
                    variant="default"
                    onClick={marcarComoPago}
                    disabled={processandoAcao}
                  >
                    {processandoAcao ? (
                      <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Processando...</>
                    ) : (
                      <><CheckCircle2 className="h-4 w-4 mr-2" />Marcar como Pago</>
                    )}
                  </Button>
                )}

                {pagamentoSelecionado.status !== 'cancelado' &&
                  pagamentoSelecionado.status !== 'expirado' &&
                  pagamentoSelecionado.status !== 'estornado' &&
                  pagamentoSelecionado.status !== 'pago' && (
                    <Button
                      className="w-full"
                      variant="destructive"
                      onClick={() => setConfirmandoCancelar(true)}
                      disabled={processandoAcao}
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Cancelar Pagamento
                    </Button>
                  )}

                {(pagamentoSelecionado.status === 'cancelado' ||
                  pagamentoSelecionado.status === 'expirado') && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Nenhuma ação disponível para este status.
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════════
          AlertDialog — Confirmar cancelamento
      ═══════════════════════════════════════════════════════ */}
      <AlertDialog open={confirmandoCancelar} onOpenChange={setConfirmandoCancelar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O pagamento será marcado como cancelado
              e o contribuinte não será cobrado ou reembolsado automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processandoAcao}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={cancelarPagamento}
              disabled={processandoAcao}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {processandoAcao ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══════════════════════════════════════════════════════
          Dialog — Registrar Pagamento
      ═══════════════════════════════════════════════════════ */}
      <Dialog open={modalCriar} onOpenChange={setModalCriar}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              Registre manualmente uma contribuição. Útil para pagamentos em dinheiro ou situações offline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Dizimista */}
            <div className="space-y-1.5">
              <Label>Dizimista (opcional)</Label>
              <Input
                placeholder="Buscar por nome ou CPF..."
                value={buscaDizimista}
                onChange={e => {
                  setBuscaDizimista(e.target.value);
                  if (!e.target.value) setForm(f => ({ ...f, paroquiano_id: '' }));
                }}
              />
              {loadingDizimistas && (
                <p className="text-xs text-muted-foreground">Buscando...</p>
              )}
              {paroquianos.length > 0 && (
                <div className="border rounded-lg max-h-36 overflow-y-auto divide-y bg-background shadow-sm">
                  {paroquianos.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${form.paroquiano_id === p.id ? 'bg-primary/10 text-primary font-medium' : ''}`}
                      onClick={() => {
                        setForm(f => ({ ...f, paroquiano_id: p.id }));
                        setBuscaDizimista(p.nome_completo + (p.cpf ? ` — CPF: ${p.cpf}` : ''));
                        setParoquianos([]);
                      }}
                    >
                      <span className="font-medium">{p.nome_completo}</span>
                      {p.cpf && <span className="text-muted-foreground ml-2 text-xs">CPF: {p.cpf}</span>}
                    </button>
                  ))}
                </div>
              )}
              {form.paroquiano_id && (
                <p className="text-xs text-primary flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Dizimista selecionado
                </p>
              )}
              {!form.paroquiano_id && (
                <p className="text-xs text-muted-foreground">Deixe em branco para registrar como anônimo.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Tipo */}
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v, campanha_id: '' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dizimo">Dízimo</SelectItem>
                    <SelectItem value="oferta">Oferta</SelectItem>
                    <SelectItem value="campanha">Campanha</SelectItem>
                    <SelectItem value="eventual">Eventual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Método */}
              <div className="space-y-1.5">
                <Label>Método *</Label>
                <Select value={form.metodo} onValueChange={v => setForm(f => ({ ...f, metodo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="credito">Cartão de Crédito</SelectItem>
                    <SelectItem value="debito">Cartão de Débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Campanha */}
            {form.tipo === 'campanha' && (
              <div className="space-y-1.5">
                <Label>Campanha *</Label>
                <Select value={form.campanha_id} onValueChange={v => setForm(f => ({ ...f, campanha_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma campanha ativa" />
                  </SelectTrigger>
                  <SelectContent>
                    {campanhas.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {/* Valor */}
              <div className="space-y-1.5">
                <Label>Valor (R$) *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={form.valor}
                  onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                />
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label>Status *</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="aguardando_pagamento">Aguardando Pagamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalCriar(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={criarPagamento} disabled={salvando}>
              {salvando ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
              ) : (
                <><Plus className="h-4 w-4 mr-2" />Registrar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminPagamentos;
