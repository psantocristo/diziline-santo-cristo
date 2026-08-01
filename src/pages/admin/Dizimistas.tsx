import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Search, Plus, Pencil, UserX, UserCheck, Wand2, CheckCircle2, Clock, AlertCircle, CalendarDays, KeyRound, Eye, EyeOff, FileText, Printer, Loader2, Trash2, UserPlus, Heart, Users, IdCard, Download } from 'lucide-react';
import CarteirinhaCard from '@/components/carteirinha/CarteirinhaCard';
import { gerarCarteirinhaPDF, gerarFolhaA4Carteirinhas } from '@/lib/carteirinha/gerar-carteirinha-pdf';
import { gerarTokenCarteirinha, urlVerificacaoCarteirinha } from '@/lib/carteirinha/token';
import { registrarAuditoria } from '@/lib/audit';
import EnviarLembretePushButton from '@/components/admin/EnviarLembretePushButton';
import { validarCPF, limparCPF } from '@/lib/cpf';
import { imprimirComprovante } from '@/components/totem/ComprovanteThermal';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, subMonths, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** Converte string YYYY-MM-DD em Date local (sem shift de timezone) */
function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Retorna a data de hoje em formato YYYY-MM-DD no fuso de Brasília */
function todayLocalStr(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type Paroquiano = {
  id: string;
  nome_completo: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  comunidade_id: string | null;
  matricula_paroquial: string | null;
  status: string;
  created_at: string;
  data_inicio_dizimista: string | null;
  data_nascimento: string | null;
  valor_sugerido: number | null;
  observacoes: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  user_id: string | null;
  estado_civil: string | null;
  comunidades?: { nome: string } | null;
};

type MembroFamilia = {
  id?: string;
  nome: string;
  parentesco: string;
  data_nascimento: string | null;
};

const mascaraCPF = (cpf: string | null) => {
  if (!cpf) return '-';
  const c = cpf.replace(/\D/g, '');
  return c.length === 11 ? `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**` : cpf;
};

/** Aplica máscara ###.###.###-## enquanto digita */
const aplicarMascaraCPF = (valor: string): string => {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 3) return nums;
  if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
  if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
  return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
};

const STATUS_COLORS: Record<string, string> = {
  ativo: 'text-green-600 bg-green-50 border-green-200',
  inativo: 'text-gray-500 bg-gray-50 border-gray-200',
  suspenso: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  inadimplente: 'text-red-600 bg-red-50 border-red-200',
};

type PagamentoMes = {
  mes_referencia: string;
  status: string;
  valor: number;
};

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const HistoricoMeses: React.FC<{ paroquiano: Paroquiano }> = ({ paroquiano }) => {
  const [pagamentos, setPagamentos] = useState<PagamentoMes[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMeses = async () => {
      setLoading(true);
      let q = (supabase as any)
        .from('pagamentos')
        .select('mes_referencia, status, valor')
        .eq('tipo', 'dizimo')
        .not('mes_referencia', 'is', null)
        .order('mes_referencia', { ascending: false });
      if (paroquiano.user_id) {
        q = q.or(`paroquiano_id.eq.${paroquiano.id},user_id.eq.${paroquiano.user_id}`);
      } else {
        q = q.eq('paroquiano_id', paroquiano.id);
      }
      const { data } = await q;
      setPagamentos((data || []) as PagamentoMes[]);
      setLoading(false);
    };
    fetchMeses();

    // Realtime: sincronia entre app, totem e painel
    const channel = (supabase as any)
      .channel(`admin-historico-${paroquiano.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos' }, () => fetchMeses())
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [paroquiano.id, paroquiano.user_id]);

  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const dataInicio = paroquiano.data_inicio_dizimista
    ? new Date(paroquiano.data_inicio_dizimista + 'T00:00:00')
    : null;

  // Constrói grade dos últimos 24 meses (2 anos)
  const meses: { date: Date; ano: number; mes: number }[] = [];
  for (let i = 23; i >= 0; i--) {
    const d = startOfMonth(subMonths(hoje, i));
    meses.push({ date: d, ano: d.getFullYear(), mes: d.getMonth() });
  }

  const getStatus = (d: Date) => {
    const key = format(d, 'yyyy-MM-dd');
    const pgs = pagamentos.filter(p => p.mes_referencia === key);
    if (pgs.some(p => p.status === 'pago')) return 'pago';
    if (pgs.some(p => p.status === 'aguardando_pagamento')) return 'aguardando';
    const isFuturo = isAfter(d, startOfMonth(hoje));
    if (isFuturo) return 'futuro';
    if (dataInicio && isBefore(d, startOfMonth(dataInicio))) return 'antes';
    return 'atraso';
  };

  if (loading) return <div className="py-8 text-center text-muted-foreground text-sm">Carregando...</div>;

  const anoAnterior = anoAtual - 1;
  // Conta meses únicos pagos no ano (evita duplicatas)
  const mesesPagosAno = new Set(
    pagamentos
      .filter(p => p.status === 'pago' && p.mes_referencia?.startsWith(String(anoAtual)))
      .map(p => p.mes_referencia)
  ).size;

  return (
    <div className="space-y-5">
      <div className="flex gap-4 text-sm flex-wrap">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-500"></div><span className="text-muted-foreground">Pago</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-yellow-400"></div><span className="text-muted-foreground">Aguardando</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400"></div><span className="text-muted-foreground">Em atraso</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-muted border"></div><span className="text-muted-foreground">Futuro / N/A</span></div>
      </div>

      {[anoAnterior, anoAtual].map(ano => (
        <div key={ano}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{ano}</p>
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 12 }, (_, m) => {
              const d = new Date(ano, m, 1);
              const st = getStatus(d);
              const colorMap: Record<string, string> = {
                pago: 'bg-green-100 border-green-300 text-green-800',
                aguardando: 'bg-yellow-100 border-yellow-300 text-yellow-800',
                atraso: 'bg-red-100 border-red-300 text-red-700',
                futuro: 'bg-muted border-border text-muted-foreground',
                antes: 'bg-muted/40 border-border/40 text-muted-foreground/40',
              };
              const iconMap: Record<string, React.ReactNode> = {
                pago: <CheckCircle2 className="h-3 w-3" />,
                aguardando: <Clock className="h-3 w-3" />,
                atraso: <AlertCircle className="h-3 w-3" />,
              };
              return (
                <div key={m} className={`rounded-lg border px-1.5 py-2 text-center text-xs font-medium flex flex-col items-center gap-0.5 ${colorMap[st]}`}>
                  <span>{MESES_PT[m]}</span>
                  {iconMap[st]}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="rounded-lg bg-muted/60 border border-border/60 px-4 py-3 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{mesesPagosAno}</span> meses pagos em {anoAtual}
        {dataInicio && (
          <span className="ml-2">· Dizimista desde {format(dataInicio, 'MM/yyyy')}</span>
        )}
      </div>
    </div>
  );
};

// Tab de Comprovantes do dizimista
const ComprovantesTab: React.FC<{ paroquiano: Paroquiano }> = ({ paroquiano }) => {
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      let q = (supabase as any)
        .from('pagamentos')
        .select('id, tipo, valor, metodo, status, pago_em, created_at, codigo_autenticacao, mes_referencia')
        .eq('status', 'pago')
        .order('pago_em', { ascending: false });
      if (paroquiano.user_id) {
        q = q.or(`paroquiano_id.eq.${paroquiano.id},user_id.eq.${paroquiano.user_id}`);
      } else {
        q = q.eq('paroquiano_id', paroquiano.id);
      }
      const { data } = await q;
      setPagamentos(data || []);
      setLoading(false);
    };
    fetch();
  }, [paroquiano.id, paroquiano.user_id]);

  const handleImprimir = async (p: any) => {
    let cnpjParoquia: string | undefined;
    let siteParoquia: string | undefined;
    try {
      const { data } = await supabase.rpc('get_tema_paroquia');
      if (data) {
        const d = data as any;
        cnpjParoquia = d.cnpj || undefined;
        siteParoquia = d.site || undefined;
      }
    } catch { /* fallback */ }

    imprimirComprovante(
      {
        pagamentoId: p.id,
        valor: p.valor,
        tipo: p.tipo,
        metodo: p.metodo,
        nomeContribuinte: paroquiano.nome_completo,
        mesReferencia: p.mes_referencia ? new Date(p.mes_referencia + 'T12:00:00') : undefined,
        dataHora: new Date(p.pago_em || p.created_at),
        cnpjParoquia,
        siteParoquia,
      },
      undefined
    );
  };

  const TIPO_LABEL: Record<string, string> = { dizimo: 'Dízimo', oferta: 'Oferta', campanha: 'Campanha', eventual: 'Eventual' };
  const METODO_LABEL: Record<string, string> = { pix: 'PIX', credito: 'Crédito', debito: 'Débito' };

  if (loading) return <div className="py-8 text-center text-muted-foreground text-sm">Carregando...</div>;
  if (pagamentos.length === 0) return <div className="py-8 text-center text-muted-foreground text-sm">Nenhum comprovante encontrado.</div>;

  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>Cód. Aut.</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagamentos.map(p => (
            <TableRow key={p.id}>
              <TableCell className="text-xs">{format(new Date(p.pago_em || p.created_at), 'dd/MM/yyyy')}</TableCell>
              <TableCell className="text-xs">{TIPO_LABEL[p.tipo] || p.tipo}</TableCell>
              <TableCell className="text-xs font-semibold">R$ {Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
              <TableCell className="text-xs">{METODO_LABEL[p.metodo] || p.metodo}</TableCell>
              <TableCell className="text-xs font-mono">{p.codigo_autenticacao?.substring(0, 8) || 'N/A'}</TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" onClick={() => handleImprimir(p)} title="Imprimir">
                  <Printer className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const AdminDizimistas: React.FC = () => {
  const [paroquianos, setParoquianos] = useState<Paroquiano[]>([]);
  const [comunidades, setComunidades] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Paroquiano | null>(null);
  const [form, setForm] = useState<Partial<Paroquiano>>({});
  const [salvando, setSalvando] = useState(false);
  const [criarConta, setCriarConta] = useState(false);
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mesesPagos, setMesesPagos] = useState<Record<string, number>>({});
  const [membrosFamilia, setMembrosFamilia] = useState<MembroFamilia[]>([]);
  const [carteirinhaModal, setCarteirinhaModal] = useState<Paroquiano | null>(null);
  const [carteirinhaFoto, setCarteirinhaFoto] = useState<string | null>(null);
  const [carteirinhaQrUrl, setCarteirinhaQrUrl] = useState<string>('');
  const [carteirinhaLado, setCarteirinhaLado] = useState<'frente' | 'verso'>('frente');
  const [carteirinhaPdfLoading, setCarteirinhaPdfLoading] = useState(false);
  const [carteirinhaLoteLoading, setCarteirinhaLoteLoading] = useState(false);
  const [nomeParoquiaGlobal, setNomeParoquiaGlobal] = useState<string>('Paróquia');
  const [siteParoquiaGlobal, setSiteParoquiaGlobal] = useState<string>('');
  const [logoCarteirinhaGlobal, setLogoCarteirinhaGlobal] = useState<string | null>(null);
  const { toast } = useToast();
  const { isSuperAdmin, comunidadeIdServo } = useAuth();

  useEffect(() => {
    fetchParoquianos();
    fetchComunidades();
    fetchMesesPagos();
    (async () => {
      const { data } = await (supabase as any)
        .from('configuracoes_paroquia').select('nome, site, logo_carteirinha_url').limit(1).maybeSingle();
      if (data?.nome) setNomeParoquiaGlobal(data.nome);
      if (data?.site) setSiteParoquiaGlobal(data.site);
      if (data?.logo_carteirinha_url) setLogoCarteirinhaGlobal(data.logo_carteirinha_url);
    })();
  }, []);

  const abrirCarteirinha = async (p: Paroquiano) => {
    setCarteirinhaLado('frente');
    setCarteirinhaFoto(null);
    setCarteirinhaQrUrl('');
    setCarteirinhaModal(p);
    const fotoUrl = (p as any).foto_url as string | null;
    if (fotoUrl) {
      const { data: signed } = await supabase.storage
        .from('avatares-paroquianos').createSignedUrl(fotoUrl, 3600);
      if (signed?.signedUrl) setCarteirinhaFoto(signed.signedUrl);
    }
    try {
      const token = await gerarTokenCarteirinha(p.id);
      setCarteirinhaQrUrl(urlVerificacaoCarteirinha(token));
    } catch (e: any) {
      toast({ title: 'Falha ao gerar QR seguro', description: e.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  const baixarCarteirinhaPDF = async () => {
    if (!carteirinhaModal) return;
    setCarteirinhaPdfLoading(true);
    try {
      const qrPayload = carteirinhaQrUrl
        || urlVerificacaoCarteirinha(await gerarTokenCarteirinha(carteirinhaModal.id));
      const doc = await gerarCarteirinhaPDF({
        nomeParoquia: nomeParoquiaGlobal,
        nomeCompleto: carteirinhaModal.nome_completo,
        cpf: carteirinhaModal.cpf,
        registroId: carteirinhaModal.matricula_paroquial,
        dataInicio: carteirinhaModal.data_inicio_dizimista,
        status: carteirinhaModal.status,
        fotoUrl: carteirinhaFoto,
        logoParoquiaUrl: logoCarteirinhaGlobal,
        qrPayload,
        rodape: siteParoquiaGlobal || nomeParoquiaGlobal,
      });
      const nome = carteirinhaModal.nome_completo.replace(/\s+/g, '_').toLowerCase();
      doc.save(`carteirinha_${nome}.pdf`);
    } catch (e: any) {
      toast({ title: 'Erro ao gerar PDF', description: e.message, variant: 'destructive' });
    }
    setCarteirinhaPdfLoading(false);
  };

  const exportarLoteA4 = async () => {
    setCarteirinhaLoteLoading(true);
    try {
      // Gera tokens assinados em lotes paralelos pequenos (rate-friendly)
      const CONCURRENCY = 5;
      const tokens: Record<string, string> = {};
      for (let i = 0; i < filtrados.length; i += CONCURRENCY) {
        const slice = filtrados.slice(i, i + CONCURRENCY);
        await Promise.all(
          slice.map(async (p) => {
            try {
              tokens[p.id] = urlVerificacaoCarteirinha(await gerarTokenCarteirinha(p.id));
            } catch {
              tokens[p.id] = '';
            }
          })
        );
      }
      const lista = filtrados.map((p) => ({
        nomeParoquia: nomeParoquiaGlobal,
        nomeCompleto: p.nome_completo,
        cpf: p.cpf,
        registroId: p.matricula_paroquial,
        dataInicio: p.data_inicio_dizimista,
        status: p.status,
        fotoUrl: null,
        logoParoquiaUrl: logoCarteirinhaGlobal,
        qrPayload: tokens[p.id] || '',
      }));
      const doc = await gerarFolhaA4Carteirinhas(lista);
      doc.save(`carteirinhas_lote_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast({ title: `${lista.length} carteirinhas exportadas` });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar lote', description: e.message, variant: 'destructive' });
    }
    setCarteirinhaLoteLoading(false);
  };


  const fetchParoquianos = async () => {
    setLoading(true);
    let query = supabase
      .from('paroquianos')
      .select('*, comunidades(nome)')
      .order('nome_completo');
    // Colaboradores vêem apenas sua comunidade
    if (!isSuperAdmin() && comunidadeIdServo) {
      query = query.eq('comunidade_id', comunidadeIdServo);
    }
    const { data } = await query;
    setParoquianos((data as any) || []);
    setLoading(false);
  };

  const fetchComunidades = async () => {
    const { data } = await supabase.from('comunidades').select('id, nome').eq('ativo', true).order('nome');
    setComunidades(data || []);
  };

  const fetchMesesPagos = async () => {
    const anoAtual = new Date().getFullYear();
    const { data } = await (supabase as any)
      .from('pagamentos')
      .select('paroquiano_id, user_id, mes_referencia')
      .eq('tipo', 'dizimo')
      .eq('status', 'pago')
      .gte('mes_referencia', `${anoAtual}-01-01`)
      .lte('mes_referencia', `${anoAtual}-12-31`);

    // Mapa user_id -> paroquiano_id (para pagamentos do app sem paroquiano_id)
    const { data: pars } = await supabase
      .from('paroquianos')
      .select('id, user_id')
      .not('user_id', 'is', null);
    const userToParoquiano: Record<string, string> = {};
    (pars || []).forEach((p: any) => { if (p.user_id) userToParoquiano[p.user_id] = p.id; });

    // Conta meses únicos por paroquiano (evita duplicatas)
    const mesesPorParoquiano: Record<string, Set<string>> = {};
    (data || []).forEach((p: any) => {
      const pid = p.paroquiano_id || (p.user_id ? userToParoquiano[p.user_id] : null);
      if (!pid || !p.mes_referencia) return;
      if (!mesesPorParoquiano[pid]) mesesPorParoquiano[pid] = new Set();
      mesesPorParoquiano[pid].add(p.mes_referencia);
    });
    const contagem: Record<string, number> = {};
    Object.entries(mesesPorParoquiano).forEach(([pid, set]) => { contagem[pid] = set.size; });
    setMesesPagos(contagem);
  };

  const filtrados = paroquianos.filter(p => {
    if (filtroStatus !== 'todos' && p.status !== filtroStatus) return false;
    if (busca) {
      const b = busca.toLowerCase();
      return (
        p.nome_completo.toLowerCase().includes(b) ||
        p.email?.toLowerCase().includes(b) ||
        p.cpf?.includes(b) ||
        p.matricula_paroquial?.includes(b)
      );
    }
    return true;
  });

  const gerarMatricula = async (): Promise<string> => {
    const { data } = await supabase
      .from('paroquianos')
      .select('matricula_paroquial')
      .like('matricula_paroquial', 'DIZSC-%')
      .order('matricula_paroquial', { ascending: false })
      .limit(1)
      .maybeSingle();

    let proximo = 1;
    if (data?.matricula_paroquial) {
      const num = parseInt(data.matricula_paroquial.replace('DIZSC-', ''), 10);
      if (!isNaN(num)) proximo = num + 1;
    }
    return `DIZSC-${String(proximo).padStart(5, '0')}`;
  };

  const abrirModal = async (paroquiano?: Paroquiano) => {
    setEditando(paroquiano || null);
    setCriarConta(false);
    setSenha('');
    setConfirmarSenha('');
    setMostrarSenha(false);
    setMembrosFamilia([]);
    if (paroquiano) {
      setForm({ ...paroquiano });
      // Fetch membros da família
      const { data: membros } = await (supabase as any)
        .from('membros_familia')
        .select('id, nome, parentesco, data_nascimento')
        .eq('paroquiano_id', paroquiano.id)
        .order('created_at');
      setMembrosFamilia((membros || []) as MembroFamilia[]);
    } else {
      const matricula = await gerarMatricula();
      setForm({ status: 'ativo', matricula_paroquial: matricula, data_inicio_dizimista: todayLocalStr() });
    }
    setModalAberto(true);
  };

  const salvar = async () => {
    if (!form.nome_completo?.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    // Validação de CPF (se preenchido)
    if (form.cpf?.trim()) {
      const cpfLimpo = limparCPF(form.cpf);
      if (!validarCPF(cpfLimpo)) {
        toast({ title: 'CPF inválido', description: 'O CPF informado não é válido. Verifique os números digitados.', variant: 'destructive' });
        return;
      }

      // Verificar duplicidade por CPF
      const { data: existente } = await supabase
        .from('paroquianos')
        .select('id, nome_completo')
        .eq('cpf', cpfLimpo)
        .maybeSingle();

      if (existente && existente.id !== editando?.id) {
        toast({
          title: 'CPF já cadastrado',
          description: `Já existe um dizimista com este CPF: ${existente.nome_completo}`,
          variant: 'destructive',
        });
        return;
      }
    }

    // Verificar duplicidade por CPF + data_nascimento (quando ambos informados e CPF ausente)
    if (!form.cpf?.trim() && form.data_nascimento && form.nome_completo) {
      const nomeNorm = form.nome_completo.trim().toLowerCase();
      const { data: similares } = await supabase
        .from('paroquianos')
        .select('id, nome_completo')
        .eq('data_nascimento', form.data_nascimento)
        .neq('id', editando?.id || '00000000-0000-0000-0000-000000000000');

      const duplicado = (similares || []).find(s =>
        s.nome_completo.trim().toLowerCase() === nomeNorm
      );
      if (duplicado) {
        toast({
          title: 'Possível cadastro duplicado',
          description: `Já existe "${duplicado.nome_completo}" com a mesma data de nascimento.`,
          variant: 'destructive',
        });
        return;
      }
    }

    // Validações de conta de acesso (apenas na criação)
    if (!editando && criarConta) {
      if (!form.email?.trim()) {
        toast({ title: 'E-mail obrigatório para criar conta', description: 'Preencha o e-mail para criar uma conta de acesso.', variant: 'destructive' });
        return;
      }
      if (senha.length < 6) {
        toast({ title: 'Senha muito curta', description: 'A senha deve ter no mínimo 6 caracteres.', variant: 'destructive' });
        return;
      }
      if (senha !== confirmarSenha) {
        toast({ title: 'Senhas não conferem', description: 'A senha e a confirmação devem ser iguais.', variant: 'destructive' });
        return;
      }
    }

    setSalvando(true);

    // Fluxo com conta de acesso: chamar Edge Function
    if (!editando && criarConta && form.email?.trim() && senha) {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-paroquiano`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            nome_completo: form.nome_completo,
            email: form.email,
            senha,
            cpf: form.cpf || null,
            telefone: form.telefone || null,
            comunidade_id: form.comunidade_id || null,
            status: form.status || 'ativo',
            data_inicio_dizimista: form.data_inicio_dizimista || todayLocalStr(),
            data_nascimento: form.data_nascimento || null,
            valor_sugerido: form.valor_sugerido ? Number(form.valor_sugerido) : null,
            observacoes: form.observacoes || null,
            endereco: form.endereco || null,
            cidade: form.cidade || null,
            estado: form.estado || null,
            cep: form.cep || null,
            estado_civil: form.estado_civil || null,
            matricula_paroquial: form.matricula_paroquial || null,
          }),
        }
      );

      const result = await res.json();
      if (!res.ok) {
        toast({ title: 'Erro ao criar conta', description: result.error || 'Erro desconhecido', variant: 'destructive' });
      } else {
        toast({ title: 'Dizimista cadastrado com conta de acesso!', description: `${form.nome_completo} pode acessar o sistema com o e-mail informado.` });
        setModalAberto(false);
        fetchParoquianos();
      }
      setSalvando(false);
      return;
    }

    // Fluxo sem conta de acesso: INSERT/UPDATE direto
    const payload: Record<string, any> = {
      nome_completo: form.nome_completo,
      cpf: form.cpf?.trim() ? limparCPF(form.cpf) : null,
      telefone: form.telefone || null,
      email: form.email || null,
      comunidade_id: form.comunidade_id || null,
      status: (form.status as any) || 'ativo',
      data_inicio_dizimista: form.data_inicio_dizimista || (!editando ? todayLocalStr() : null),
      data_nascimento: form.data_nascimento || null,
      valor_sugerido: form.valor_sugerido ? Number(form.valor_sugerido) : null,
      observacoes: form.observacoes || null,
      endereco: form.endereco || null,
      cidade: form.cidade || null,
      estado: form.estado || null,
      cep: form.cep || null,
      estado_civil: form.estado_civil || null,
    };

    if (!editando) {
      payload.matricula_paroquial = form.matricula_paroquial || null;
    }

    let error;
    if (editando) {
      ({ error } = await supabase.from('paroquianos').update(payload as any).eq('id', editando.id));
    } else {
      ({ error } = await supabase.from('paroquianos').insert(payload as any));
    }

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      // Salvar membros da família
      if (editando) {
        const existingIds = membrosFamilia.filter(m => m.id).map(m => m.id!);
        if (existingIds.length > 0) {
          await (supabase as any)
            .from('membros_familia')
            .delete()
            .eq('paroquiano_id', editando.id)
            .not('id', 'in', `(${existingIds.join(',')})`);
        } else if (membrosFamilia.length === 0) {
          await (supabase as any)
            .from('membros_familia')
            .delete()
            .eq('paroquiano_id', editando.id);
        }
        for (const membro of membrosFamilia) {
          if (!membro.nome?.trim()) continue;
          if (membro.id) {
            await (supabase as any).from('membros_familia').update({
              nome: membro.nome.trim(),
              parentesco: membro.parentesco,
              data_nascimento: membro.data_nascimento || null,
            }).eq('id', membro.id);
          } else {
            await (supabase as any).from('membros_familia').insert({
              paroquiano_id: editando.id,
              nome: membro.nome.trim(),
              parentesco: membro.parentesco,
              data_nascimento: membro.data_nascimento || null,
            });
          }
        }
      }
      toast({ title: editando ? 'Dizimista atualizado!' : 'Dizimista cadastrado!' });
      await registrarAuditoria({ acao: 'salvar_dizimista', entidade: 'paroquianos', entidade_id: editando?.id, detalhes: { nome: form.nome_completo, editando: !!editando } });
      setModalAberto(false);
      fetchParoquianos();
    }
    setSalvando(false);
  };

  const toggleStatus = async (p: Paroquiano) => {
    const novoStatus = p.status === 'ativo' ? 'inativo' : 'ativo';
    const { error } = await supabase.from('paroquianos').update({ status: novoStatus }).eq('id', p.id);
    if (!error) {
      toast({ title: `Dizimista ${novoStatus === 'ativo' ? 'reativado' : 'inativado'}` });
      await registrarAuditoria({ acao: 'toggle_status_dizimista', entidade: 'paroquianos', entidade_id: p.id, detalhes: { nome: p.nome_completo, status: novoStatus } });
      fetchParoquianos();
    }
  };

  // Reset de senha pelo admin
  const [resetSenha, setResetSenha] = useState('');
  const [resetConfirmar, setResetConfirmar] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [mostrarResetSenha, setMostrarResetSenha] = useState(false);

  const handleResetSenha = async () => {
    if (!editando?.user_id) return;
    if (resetSenha.length < 6) {
      toast({ title: 'Senha muito curta', description: 'Mínimo 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (resetSenha !== resetConfirmar) {
      toast({ title: 'Senhas não conferem', variant: 'destructive' });
      return;
    }
    setResetLoading(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { user_id: editando.user_id, nova_senha: resetSenha },
      });
      if (error || !resp?.success) {
        throw new Error(resp?.error || error?.message || 'Erro ao redefinir senha');
      }
      toast({ title: '✅ Senha redefinida!', description: resp.message });
      setResetSenha('');
      setResetConfirmar('');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setResetLoading(false);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dizimistas</h1>
            <p className="text-muted-foreground text-sm">{filtrados.length} paroquianos</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <EnviarLembretePushButton />
            <Button onClick={exportarLoteA4} disabled={carteirinhaLoteLoading} size="sm" variant="outline">
              {carteirinhaLoteLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <IdCard className="h-4 w-4 mr-2" />}
              Exportar carteirinhas (A4)
            </Button>
            <Button onClick={() => abrirModal()} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Dizimista
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome, CPF, e-mail..." className="pl-9" value={busca} onChange={e => setBusca(e.target.value)} />
              </div>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="suspenso">Suspenso</SelectItem>
                  <SelectItem value="inadimplente">Inadimplente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : filtrados.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhum dizimista encontrado.</div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-border">
                  {filtrados.map(p => {
                    const mp = mesesPagos[p.id] || 0;
                    const badgeColor = mp >= 10 ? 'bg-green-100 text-green-700 border-green-200' : mp >= 6 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-red-100 text-red-700 border-red-200';
                    return (
                      <div key={p.id} className="p-4 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => abrirModal(p)}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">{p.nome_completo}</p>
                            <p className="text-xs text-muted-foreground">{p.email || mascaraCPF(p.cpf)}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize shrink-0 ${STATUS_COLORS[p.status] || ''}`}>
                            {p.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                          {p.matricula_paroquial && <span className="font-mono">{p.matricula_paroquial}</span>}
                          {(p.comunidades as any)?.nome && <span>· {(p.comunidades as any).nome}</span>}
                          <span className={`px-2 py-0.5 rounded-full border font-semibold ${badgeColor}`}>{mp}/12</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Matrícula</TableHead>
                        <TableHead>Comunidade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Dizimista desde</TableHead>
                        <TableHead>Meses Pagos</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtrados.map(p => {
                        const mp = mesesPagos[p.id] || 0;
                        const badgeColor = mp >= 10 ? 'bg-green-100 text-green-700 border-green-200' : mp >= 6 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-red-100 text-red-700 border-red-200';
                        return (
                        <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => abrirModal(p)}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{p.nome_completo}</p>
                              <p className="text-xs text-muted-foreground">{p.email || '-'}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-mono">{mascaraCPF(p.cpf)}</TableCell>
                          <TableCell className="text-sm">{p.matricula_paroquial || '-'}</TableCell>
                          <TableCell className="text-sm">{(p.comunidades as any)?.nome || '-'}</TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${STATUS_COLORS[p.status] || ''}`}>
                              {p.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {p.data_inicio_dizimista ? format(parseDateLocal(p.data_inicio_dizimista), 'MM/yyyy') : '-'}
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${badgeColor}`}>
                              {mp}/12
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); abrirModal(p); }} title="Editar">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); abrirCarteirinha(p); }} title="Carteirinha">
                                <IdCard className="h-4 w-4 text-primary" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); toggleStatus(p); }} title={p.status === 'ativo' ? 'Inativar' : 'Reativar'}>
                                {p.status === 'ativo' ? <UserX className="h-4 w-4 text-red-500" /> : <UserCheck className="h-4 w-4 text-green-500" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal cadastro/edição */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Dizimista' : 'Novo Dizimista'}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="dados">
            <TabsList className="mb-4">
              <TabsTrigger value="dados">Dados Cadastrais</TabsTrigger>
              {editando && (
                <TabsTrigger value="meses" className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Histórico
                </TabsTrigger>
              )}
              {editando && (
                <TabsTrigger value="comprovantes" className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Comprovantes
                </TabsTrigger>
              )}
              {editando && editando.user_id && (
                <TabsTrigger value="senha" className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" />
                  Redefinir Senha
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="dados">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
                <div className="md:col-span-2">
                  <Label>Nome Completo *</Label>
                  <Input value={form.nome_completo || ''} onChange={e => setForm(f => ({ ...f, nome_completo: e.target.value }))} />
                </div>
                <div>
                  <Label>CPF</Label>
                  <Input
                    inputMode="numeric"
                    value={form.cpf || ''}
                    onChange={e => setForm(f => ({ ...f, cpf: aplicarMascaraCPF(e.target.value) }))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={form.telefone || ''} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Label>Matrícula Paroquial</Label>
                    {!editando ? (
                      <Badge variant="secondary" className="text-xs gap-1 font-normal">
                        <Wand2 className="h-3 w-3" />
                        Gerado automaticamente
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs gap-1 font-normal text-muted-foreground">
                        Não editável
                      </Badge>
                    )}
                  </div>
                  <Input
                    value={form.matricula_paroquial || ''}
                    onChange={e => !editando && setForm(f => ({ ...f, matricula_paroquial: e.target.value }))}
                    placeholder="DIZSC-00001"
                    readOnly={!!editando}
                    className={editando ? 'bg-muted cursor-not-allowed text-muted-foreground' : ''}
                  />
                </div>
                <div>
                  <Label>Comunidade</Label>
                  <Select value={form.comunidade_id || ''} onValueChange={v => setForm(f => ({ ...f, comunidade_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {comunidades.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status || 'ativo'} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="suspenso">Suspenso</SelectItem>
                      <SelectItem value="inadimplente">Inadimplente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Label>Início como Dizimista</Label>
                    {!editando && (
                      <Badge variant="secondary" className="text-xs gap-1 font-normal">
                        <Wand2 className="h-3 w-3" />
                        Automático
                      </Badge>
                    )}
                  </div>
                  <Input
                    type="date"
                    value={form.data_inicio_dizimista || ''}
                    onChange={e => editando && setForm(f => ({ ...f, data_inicio_dizimista: e.target.value }))}
                    readOnly={!editando}
                    className={!editando ? 'bg-muted cursor-not-allowed text-muted-foreground' : ''}
                  />
                </div>
                <div>
                  <Label>Data de Nascimento</Label>
                  <Input type="date" value={form.data_nascimento || ''} onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))} />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5"><Heart className="h-3.5 w-3.5" /> Estado Civil</Label>
                  <Select value={form.estado_civil || ''} onValueChange={v => setForm(f => ({ ...f, estado_civil: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                      <SelectItem value="casado">Casado(a)</SelectItem>
                      <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                      <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor Sugerido (R$)</Label>
                  <Input type="number" step="0.01" value={form.valor_sugerido || ''} onChange={e => setForm(f => ({ ...f, valor_sugerido: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input value={form.cep || ''} onChange={e => setForm(f => ({ ...f, cep: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <Label>Endereço</Label>
                  <Input value={form.endereco || ''} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input value={form.cidade || ''} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Input value={form.estado || ''} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} maxLength={2} placeholder="SP" />
                </div>
                <div className="md:col-span-2">
                  <Label>Observações</Label>
                  <Input value={form.observacoes || ''} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
                </div>

                {/* Membros da Família */}
                <div className="md:col-span-2 mt-2">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="flex items-center gap-1.5 text-sm font-semibold">
                      <Users className="h-4 w-4" />
                      Membros da Família
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setMembrosFamilia(prev => [...prev, { nome: '', parentesco: 'outro', data_nascimento: null }])}
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                      Adicionar
                    </Button>
                  </div>
                  {membrosFamilia.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">Nenhum membro da família cadastrado.</p>
                  )}
                  <div className="space-y-3">
                    {membrosFamilia.map((membro, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2 items-end rounded-lg border border-border bg-muted/30 p-3">
                        <div>
                          <Label className="text-xs">Nome</Label>
                          <Input
                            value={membro.nome}
                            onChange={e => {
                              const updated = [...membrosFamilia];
                              updated[idx] = { ...updated[idx], nome: e.target.value };
                              setMembrosFamilia(updated);
                            }}
                            placeholder="Nome do familiar"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Parentesco</Label>
                          <Select
                            value={membro.parentesco}
                            onValueChange={v => {
                              const updated = [...membrosFamilia];
                              updated[idx] = { ...updated[idx], parentesco: v };
                              setMembrosFamilia(updated);
                            }}
                          >
                            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="conjuge">Cônjuge</SelectItem>
                              <SelectItem value="filho">Filho(a)</SelectItem>
                              <SelectItem value="pai">Pai</SelectItem>
                              <SelectItem value="mae">Mãe</SelectItem>
                              <SelectItem value="irmao">Irmão(ã)</SelectItem>
                              <SelectItem value="outro">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Nascimento</Label>
                          <Input
                            type="date"
                            value={membro.data_nascimento || ''}
                            onChange={e => {
                              const updated = [...membrosFamilia];
                              updated[idx] = { ...updated[idx], data_nascimento: e.target.value || null };
                              setMembrosFamilia(updated);
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setMembrosFamilia(prev => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Seção Acesso ao Sistema — apenas na criação */}
              {!editando && (
                <div className="mt-5 rounded-lg border border-border bg-muted/30 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground">Acesso ao Sistema</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="criar-conta" className="text-sm text-muted-foreground cursor-pointer">
                        Criar conta de acesso?
                      </Label>
                      <Switch
                        id="criar-conta"
                        checked={criarConta}
                        onCheckedChange={setCriarConta}
                      />
                    </div>
                  </div>

                  {criarConta && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        O dizimista poderá acessar o sistema com o e-mail informado acima. Certifique-se de que o campo e-mail está preenchido.
                      </p>
                      {!form.email?.trim() && (
                        <p className="text-xs text-destructive font-medium">⚠ Preencha o campo E-mail acima para habilitar a criação de conta.</p>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label>Senha *</Label>
                          <div className="relative">
                            <Input
                              type={mostrarSenha ? 'text' : 'password'}
                              value={senha}
                              onChange={e => setSenha(e.target.value)}
                              placeholder="Mínimo 6 caracteres"
                              className="pr-10"
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              onClick={() => setMostrarSenha(v => !v)}
                            >
                              {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <Label>Confirmar Senha *</Label>
                          <div className="relative">
                            <Input
                              type={mostrarSenha ? 'text' : 'password'}
                              value={confirmarSenha}
                              onChange={e => setConfirmarSenha(e.target.value)}
                              placeholder="Repita a senha"
                              className={confirmarSenha && senha !== confirmarSenha ? 'border-destructive' : ''}
                            />
                          </div>
                          {confirmarSenha && senha !== confirmarSenha && (
                            <p className="text-xs text-destructive mt-1">As senhas não conferem</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
                <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
              </DialogFooter>
            </TabsContent>

            {editando && (
              <TabsContent value="meses">
                <HistoricoMeses paroquiano={editando} />
              </TabsContent>
            )}
            {editando && (
              <TabsContent value="comprovantes">
                <ComprovantesTab paroquiano={editando} />
              </TabsContent>
            )}
            {editando && editando.user_id && (
              <TabsContent value="senha">
                <div className="space-y-4 py-2">
                  <div className="rounded-lg bg-muted/60 border border-border p-4">
                    <p className="text-sm text-muted-foreground">
                      Redefina a senha de acesso de <strong>{editando.nome_completo}</strong> ({editando.email || 'sem e-mail'}).
                      Esta ação será registrada no log de auditoria.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Nova Senha *</Label>
                      <div className="relative">
                        <Input
                          type={mostrarResetSenha ? 'text' : 'password'}
                          value={resetSenha}
                          onChange={e => setResetSenha(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setMostrarResetSenha(v => !v)}
                        >
                          {mostrarResetSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label>Confirmar Senha *</Label>
                      <Input
                        type={mostrarResetSenha ? 'text' : 'password'}
                        value={resetConfirmar}
                        onChange={e => setResetConfirmar(e.target.value)}
                        placeholder="Repita a senha"
                        className={resetConfirmar && resetSenha !== resetConfirmar ? 'border-destructive' : ''}
                      />
                      {resetConfirmar && resetSenha !== resetConfirmar && (
                        <p className="text-xs text-destructive mt-1">As senhas não conferem</p>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleResetSenha} disabled={resetLoading || !resetSenha || resetSenha !== resetConfirmar}>
                      {resetLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
                      Redefinir Senha
                    </Button>
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Modal Carteirinha */}
      <Dialog open={!!carteirinhaModal} onOpenChange={(o) => !o && setCarteirinhaModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><IdCard className="h-5 w-5 text-primary" /> Carteirinha do Dizimista</DialogTitle>
          </DialogHeader>
          {carteirinhaModal && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <CarteirinhaCard
                  nomeParoquia={nomeParoquiaGlobal}
                  nomeCompleto={carteirinhaModal.nome_completo}
                  cpf={carteirinhaModal.cpf}
                  registroId={carteirinhaModal.matricula_paroquial}
                  dataInicio={carteirinhaModal.data_inicio_dizimista}
                  status={carteirinhaModal.status}
                  fotoUrl={carteirinhaFoto}
                  logoParoquiaUrl={logoCarteirinhaGlobal}
                  qrPayload={carteirinhaQrUrl}
                  lado={carteirinhaLado}
                  width={380}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setCarteirinhaLado((l) => l === 'frente' ? 'verso' : 'frente')}>
                  {carteirinhaLado === 'frente' ? 'Ver verso (QR)' : 'Ver frente'}
                </Button>
                <Button onClick={baixarCarteirinhaPDF} disabled={carteirinhaPdfLoading}>
                  {carteirinhaPdfLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Baixar PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminDizimistas;
