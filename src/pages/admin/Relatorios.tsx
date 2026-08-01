import React, { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/contexts/ThemeContext';
import { Download, Printer, Filter, FileCheck, Users, Activity, HandHeart, MapPin, X, CalendarRange } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subDays, subMonths, startOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

const TIPO_LABELS: Record<string, string> = {
  dizimo: 'Dízimo', oferta: 'Oferta', campanha: 'Campanha', eventual: 'Eventual'
};
const METODO_LABELS: Record<string, string> = {
  pix: 'PIX', credito: 'Crédito', debito: 'Débito'
};

const TIPO_CONTA: Record<string, string> = {
  dizimo: '4.1.1 - Dízimos',
  oferta: '4.1.2 - Ofertas',
  campanha: '4.1.3 - Campanhas',
  eventual: '4.1.4 - Contribuições Eventuais',
};

const ORIGEM_LABELS: Record<string, string> = {
  web: 'Web', totem: 'Totem', admin: 'Admin', kiosk: 'Kiosk'
};

const ORIGEM_COLORS: Record<string, string> = {
  web: 'bg-blue-100 text-blue-700 border-blue-200',
  totem: 'bg-purple-100 text-purple-700 border-purple-200',
  admin: 'bg-amber-100 text-amber-700 border-amber-200',
  kiosk: 'bg-green-100 text-green-700 border-green-200',
};

function formatBRL(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type Comunidade = { id: string; nome: string };

type AtividadeColaborador = {
  nome: string;
  user_id: string;
  totalAcoes: number;
  pagamentosRegistrados: number;
  totalArrecadado: number;
  ultimaAtividade: string;
};

const AdminRelatorios: React.FC = () => {
  const now = new Date();
  const { tema } = useTheme();
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(endOfMonth(now), 'yyyy-MM-dd'));
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroMetodo, setFiltroMetodo] = useState('todos');
  const [filtroOrigem, setFiltroOrigem] = useState('todos');
  const [filtroComunidade, setFiltroComunidade] = useState('todos');
  const [comunidades, setComunidades] = useState<Comunidade[]>([]);
  const [dados, setDados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalBalancete, setModalBalancete] = useState(false);

  // Colaboradores
  const [atividadeColabs, setAtividadeColabs] = useState<AtividadeColaborador[]>([]);
  const [pagamentosAdmin, setPagamentosAdmin] = useState<any[]>([]);
  const [loadingColabs, setLoadingColabs] = useState(false);

  // Campos editáveis do balancete
  const [nomeParoquia, setNomeParoquia] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [nomeTesoureiro, setNomeTesoureiro] = useState('');
  const [cpfTesoureiro, setCpfTesoureiro] = useState('');
  const [nomeParoco, setNomeParoco] = useState('');
  const [cpfParoco, setCpfParoco] = useState('');
  const [balanceteComunidade, setBalanceteComunidade] = useState('todos');

  // Only fetch communities on mount; reports and collaborators load on demand
  useEffect(() => { buscarComunidades(); }, []);

  // Pré-carregar dados da paróquia ao abrir modal
  useEffect(() => {
    const fetchParoquia = async () => {
      const { data } = await supabase
        .from('configuracoes_paroquia' as any)
        .select('nome, cnpj')
        .limit(1)
        .maybeSingle();
      if (data) {
        setNomeParoquia((data as any).nome || tema.nome || '');
        setCnpj((data as any).cnpj || '');
      } else if (tema.nome) {
        setNomeParoquia(tema.nome);
      }
    };
    fetchParoquia();
  }, [tema.nome]);

  const buscarComunidades = async () => {
    const { data } = await supabase
      .from('comunidades')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome');
    setComunidades((data as any) || []);
  };

  const buscar = async () => {
    // Validação de intervalo de datas
    if (!dataInicio || !dataFim) {
      toast.error('Informe data de início e fim.');
      return;
    }
    if (dataInicio > dataFim) {
      toast.error('A data inicial não pode ser maior que a final.');
      return;
    }
    const diffDias = Math.floor((new Date(dataFim).getTime() - new Date(dataInicio).getTime()) / 86400000);
    if (diffDias > 366) {
      toast.error('Selecione um intervalo de no máximo 12 meses.');
      return;
    }

    setLoading(true);
    let query = supabase
      .from('pagamentos')
      .select('*, paroquianos(nome_completo, comunidade_id, comunidades(id, nome))')
      .eq('status', 'pago')
      .gte('created_at', `${dataInicio}T00:00:00`)
      .lte('created_at', `${dataFim}T23:59:59`)
      .order('created_at', { ascending: false });

    if (filtroTipo !== 'todos') query = query.eq('tipo', filtroTipo as 'dizimo' | 'oferta' | 'campanha' | 'eventual');
    if (filtroMetodo !== 'todos') query = query.eq('metodo', filtroMetodo as 'pix' | 'credito' | 'debito');
    if (filtroOrigem !== 'todos') query = query.eq('origem', filtroOrigem);

    const { data, error } = await query;
    if (error) {
      toast.error('Erro ao buscar pagamentos: ' + error.message);
      setLoading(false);
      return;
    }
    let resultado = data || [];

    // Filtrar por comunidade no client-side (join nested)
    if (filtroComunidade !== 'todos') {
      if (filtroComunidade === 'sem_comunidade') {
        resultado = resultado.filter(p => !(p.paroquianos as any)?.comunidade_id);
      } else {
        resultado = resultado.filter(p => (p.paroquianos as any)?.comunidade_id === filtroComunidade);
      }
    }

    setDados(resultado);
    setLoading(false);
    toast.success(`${resultado.length} pagamento(s) encontrado(s).`);
  };

  // Presets de período
  const aplicarPreset = (preset: 'hoje' | '7d' | '30d' | 'mes' | 'mes_anterior' | 'ano') => {
    const hoje = new Date();
    let ini = hoje, fim = hoje;
    switch (preset) {
      case 'hoje': ini = fim = hoje; break;
      case '7d': ini = subDays(hoje, 6); fim = hoje; break;
      case '30d': ini = subDays(hoje, 29); fim = hoje; break;
      case 'mes': ini = startOfMonth(hoje); fim = endOfMonth(hoje); break;
      case 'mes_anterior': {
        const m = subMonths(hoje, 1);
        ini = startOfMonth(m); fim = endOfMonth(m); break;
      }
      case 'ano': ini = startOfYear(hoje); fim = hoje; break;
    }
    setDataInicio(format(ini, 'yyyy-MM-dd'));
    setDataFim(format(fim, 'yyyy-MM-dd'));
  };

  const limparFiltros = () => {
    setDataInicio(format(startOfMonth(now), 'yyyy-MM-dd'));
    setDataFim(format(endOfMonth(now), 'yyyy-MM-dd'));
    setFiltroTipo('todos');
    setFiltroMetodo('todos');
    setFiltroOrigem('todos');
    setFiltroComunidade('todos');
    toast.info('Filtros restaurados.');
  };

  const filtrosAtivos = [
    filtroTipo !== 'todos',
    filtroMetodo !== 'todos',
    filtroOrigem !== 'todos',
    filtroComunidade !== 'todos',
  ].filter(Boolean).length;

  // Buscar atividade dos colaboradores via logs_auditoria
  const buscarColaboradores = async () => {
    setLoadingColabs(true);
    try {
      const { data: servos } = await supabase
        .from('servos')
        .select('id, nome, user_id, ativo')
        .order('nome');

      const { data: logs } = await supabase
        .from('logs_auditoria')
        .select('user_id, acao, entidade, entidade_id, created_at, detalhes')
        .order('created_at', { ascending: false })
        .limit(2000);

      const { data: pagAdmins } = await supabase
        .from('pagamentos')
        .select('*, paroquianos(nome_completo)')
        .in('origem', ['admin', 'kiosk'])
        .order('created_at', { ascending: false })
        .limit(500);

      setPagamentosAdmin(pagAdmins || []);

      if (!servos || !logs) {
        setAtividadeColabs([]);
        setLoadingColabs(false);
        return;
      }

      const atividade: Record<string, AtividadeColaborador> = {};

      for (const servo of servos) {
        const logsDoServo = logs.filter(l => l.user_id === servo.user_id);
        const pagamentosDoServo = logsDoServo.filter(l =>
          l.entidade === 'pagamento' && (l.acao === 'criar_pagamento' || l.acao === 'pagamento_criado' || l.acao?.includes('pagamento'))
        );
        const totalArrecadado = (pagAdmins || [])
          .filter(p => {
            return logsDoServo.some(l => l.entidade_id === p.id);
          })
          .filter(p => p.status === 'pago')
          .reduce((acc: number, p: any) => acc + Number(p.valor), 0);

        const ultimoLog = logsDoServo[0];

        atividade[servo.user_id] = {
          nome: servo.nome,
          user_id: servo.user_id,
          totalAcoes: logsDoServo.length,
          pagamentosRegistrados: pagamentosDoServo.length,
          totalArrecadado,
          ultimaAtividade: ultimoLog?.created_at || '',
        };
      }

      setAtividadeColabs(Object.values(atividade).sort((a, b) => b.totalAcoes - a.totalAcoes));
    } catch (e) {
      console.error('Erro ao buscar colaboradores:', e);
    }
    setLoadingColabs(false);
  };

  const totalGeral = dados.reduce((acc, p) => acc + Number(p.valor), 0);

  const porTipo = Object.entries(
    dados.reduce((acc: Record<string, number>, p) => {
      acc[p.tipo] = (acc[p.tipo] || 0) + Number(p.valor);
      return acc;
    }, {})
  ).sort((a, b) => ['dizimo', 'oferta', 'campanha', 'eventual'].indexOf(a[0]) - ['dizimo', 'oferta', 'campanha', 'eventual'].indexOf(b[0]));

  const porMetodo = Object.entries(
    dados.reduce((acc: Record<string, number>, p) => {
      acc[p.metodo] = (acc[p.metodo] || 0) + Number(p.valor);
      return acc;
    }, {})
  );

  const porOrigem = Object.entries(
    dados.reduce((acc: Record<string, number>, p) => {
      const o = p.origem || 'web';
      acc[o] = (acc[o] || 0) + Number(p.valor);
      return acc;
    }, {})
  );

  // Agrupamento por comunidade
  const porComunidade = (() => {
    const map: Record<string, { nome: string; valor: number; count: number }> = {};
    dados.forEach(p => {
      const comunidade = (p.paroquianos as any)?.comunidades;
      const key = comunidade?.id || '_sem';
      const nome = comunidade?.nome || 'Sem comunidade';
      if (!map[key]) map[key] = { nome, valor: 0, count: 0 };
      map[key].valor += Number(p.valor);
      map[key].count += 1;
    });
    return Object.values(map).sort((a, b) => b.valor - a.valor);
  })();

  // ─── Exportar PDF via window.print() ───────────────────────────────────────
  const exportPDF = () => {
    const dataInicioFmt = format(new Date(dataInicio + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
    const dataFimFmt = format(new Date(dataFim + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });

    const linhas = dados.map(p => `
      <tr>
        <td>${format(new Date(p.created_at), 'dd/MM/yyyy', { locale: ptBR })}</td>
        <td>${(p.paroquianos as any)?.nome_completo || 'Anônimo'}</td>
        <td>${TIPO_LABELS[p.tipo] || p.tipo}</td>
        <td>${METODO_LABELS[p.metodo] || p.metodo}</td>
        <td>${(p.origem || 'web').charAt(0).toUpperCase() + (p.origem || 'web').slice(1)}</td>
        <td>${(p.paroquianos as any)?.comunidades?.nome || '—'}</td>
        <td style="text-align:right;font-weight:600">${formatBRL(Number(p.valor))}</td>
      </tr>`).join('');

    const htmlPrint = `
      <div id="relatorio-print-area" style="font-family:Georgia,serif;color:#1a0a0a;padding:20px;max-width:900px;margin:0 auto">
        <div style="text-align:center;border-bottom:2px solid #8a6a1e;padding-bottom:12px;margin-bottom:16px">
          <h2 style="font-size:18px;margin:0;color:#6b1a2a">${nomeParoquia || 'Paróquia'}</h2>
          ${cnpj ? `<p style="font-size:11px;margin:2px 0;color:#666">CNPJ: ${cnpj}</p>` : ''}
          <h3 style="font-size:14px;margin:8px 0 0;color:#1a0a0a">RELATÓRIO DE CONTRIBUIÇÕES</h3>
          <p style="font-size:12px;margin:4px 0;color:#555">Período: ${dataInicioFmt} a ${dataFimFmt}</p>
        </div>

        <div style="display:flex;gap:24px;margin-bottom:16px;font-size:12px">
          <div style="flex:1">
            <strong>Por tipo:</strong>
            ${porTipo.map(([tipo, valor]) => `<div style="display:flex;justify-content:space-between"><span>${TIPO_LABELS[tipo] || tipo}</span><span>${formatBRL(Number(valor))}</span></div>`).join('')}
          </div>
          <div style="flex:1">
            <strong>Por método:</strong>
            ${porMetodo.map(([m, valor]) => `<div style="display:flex;justify-content:space-between"><span>${METODO_LABELS[m] || m}</span><span>${formatBRL(Number(valor))}</span></div>`).join('')}
          </div>
          <div style="flex:1;border-top:2px solid #8a6a1e;padding-top:8px">
            <strong style="font-size:13px">TOTAL GERAL</strong>
            <div style="font-size:16px;font-weight:bold;color:#6b1a2a">${formatBRL(totalGeral)}</div>
            <div style="font-size:11px;color:#888">${dados.length} pagamentos</div>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead>
            <tr style="background:#6b1a2a;color:#fff">
              <th style="padding:6px 8px;text-align:left">Data</th>
              <th style="padding:6px 8px;text-align:left">Fiel</th>
              <th style="padding:6px 8px;text-align:left">Tipo</th>
              <th style="padding:6px 8px;text-align:left">Método</th>
              <th style="padding:6px 8px;text-align:left">Origem</th>
              <th style="padding:6px 8px;text-align:left">Comunidade</th>
              <th style="padding:6px 8px;text-align:right">Valor</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>

        <p style="text-align:right;font-size:10px;color:#999;margin-top:16px">
          Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>`;

    const printDiv = document.createElement('div');
    printDiv.id = 'relatorio-print-root';
    printDiv.innerHTML = htmlPrint;
    printDiv.style.display = 'none';
    document.body.appendChild(printDiv);
    document.body.classList.add('print-relatorio');

    const afterPrint = () => {
      document.body.classList.remove('print-relatorio');
      document.body.removeChild(printDiv);
      window.removeEventListener('afterprint', afterPrint);
    };
    window.addEventListener('afterprint', afterPrint);
    window.print();
  };

  const dataInicioFmt = format(new Date(dataInicio + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
  const dataFimFmt = format(new Date(dataFim + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
  const hoje = format(new Date(), 'dd/MM/yyyy', { locale: ptBR });

  // Dados do balancete filtrados por comunidade
  const dadosBalancete = balanceteComunidade === 'todos'
    ? dados
    : balanceteComunidade === 'sem_comunidade'
      ? dados.filter(p => !(p.paroquianos as any)?.comunidade_id)
      : dados.filter(p => (p.paroquianos as any)?.comunidade_id === balanceteComunidade);

  const totalBalancete = dadosBalancete.reduce((acc, p) => acc + Number(p.valor), 0);
  const nomeComunidadeBalancete = balanceteComunidade === 'todos'
    ? null
    : balanceteComunidade === 'sem_comunidade'
      ? 'Sem Comunidade'
      : comunidades.find(c => c.id === balanceteComunidade)?.nome || '';

  // ─── Gerar HTML do Balancete ─────────────────────────────────────────────────
  const gerarHtmlBalancete = useCallback(() => {
    const d = dadosBalancete;
    const total = totalBalancete;

    const receitasPorTipo = ['dizimo', 'oferta', 'campanha', 'eventual'].map(tipo => {
      const valor = d.filter(p => p.tipo === tipo).reduce((acc, p) => acc + Number(p.valor), 0);
      return `<tr style="border-bottom:1px solid #f0eae2"><td style="padding:5px 0 5px 12px;font-size:12px">${TIPO_CONTA[tipo]}</td><td style="text-align:right;padding:5px 0;font-size:12px;font-family:monospace">${formatBRL(valor)}</td></tr>`;
    }).join('');

    const metodoRows = ['pix', 'credito', 'debito'].map(m => {
      const valor = d.filter(p => p.metodo === m).reduce((acc, p) => acc + Number(p.valor), 0);
      return `<tr style="border-bottom:1px solid #f0eae2"><td style="padding:5px 0 5px 12px;font-size:12px">${METODO_LABELS[m]}</td><td style="text-align:right;padding:5px 0;font-size:12px;font-family:monospace">${formatBRL(valor)}</td></tr>`;
    }).join('');

    const origemRows = ['web', 'totem', 'admin', 'kiosk'].map(o => {
      const valor = d.filter(p => (p.origem || 'web') === o).reduce((acc, p) => acc + Number(p.valor), 0);
      return `<tr style="border-bottom:1px solid #f0eae2"><td style="padding:5px 0 5px 12px;font-size:12px">${ORIGEM_LABELS[o]}</td><td style="text-align:right;padding:5px 0;font-size:12px;font-family:monospace">${formatBRL(valor)}</td></tr>`;
    }).join('');

    // Community breakdown rows (only in "todos" mode)
    const comunidadeRows = balanceteComunidade === 'todos' ? (() => {
      const map: Record<string, { nome: string; valor: number }> = {};
      d.forEach(p => {
        const com = (p.paroquianos as any)?.comunidades;
        const nome = com?.nome || 'Sem comunidade';
        const key = com?.id || '_sem';
        if (!map[key]) map[key] = { nome, valor: 0 };
        map[key].valor += Number(p.valor);
      });
      return Object.values(map)
        .sort((a, b) => b.valor - a.valor)
        .map(c => `<tr style="border-bottom:1px solid #f0eae2"><td style="padding:5px 0 5px 12px;font-size:12px">${c.nome}</td><td style="text-align:right;padding:5px 0;font-size:12px;font-family:monospace">${formatBRL(c.valor)}</td></tr>`)
        .join('');
    })() : '';

    const subtituloComunidade = nomeComunidadeBalancete
      ? `<p style="font-size:12px;margin:4px 0;color:#6b1a2a;font-weight:bold">Comunidade: ${nomeComunidadeBalancete}</p>`
      : '';

    return `<html><head><title>Balancete</title>
      <style>@page{size:A4 portrait;margin:16mm 12mm}body{font-family:Georgia,serif;font-size:13px;color:#1a0a0a;padding:24px 28px;line-height:1.5;max-width:700px;margin:0 auto}</style>
      </head><body>
        <div style="text-align:center;border-bottom:2px solid #8a6a1e;padding-bottom:12px;margin-bottom:16px">
          <p style="font-size:16px;font-weight:bold;margin:0;color:#6b1a2a;letter-spacing:1px">${nomeParoquia || 'PARÓQUIA'}</p>
          ${cnpj ? `<p style="font-size:11px;margin:2px 0;color:#555">CNPJ: ${cnpj}</p>` : ''}
          <p style="font-size:14px;font-weight:bold;margin:8px 0 0;color:#1a0a0a">BALANCETE DE RECEITAS</p>
          <p style="font-size:11px;margin:2px 0;color:#555">Período: ${dataInicioFmt} a ${dataFimFmt}</p>
          ${subtituloComunidade}
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:4px">
          <thead><tr style="border-bottom:1px solid #8a6a1e"><th style="text-align:left;font-size:12px;font-weight:bold;padding:4px 0;color:#6b1a2a">RECEITAS OPERACIONAIS</th><th style="text-align:right;font-size:11px;color:#888;padding:4px 0;font-weight:normal">ITG 2002 / CFC</th></tr></thead>
          <tbody>${receitasPorTipo}
            <tr style="border-top:2px solid #8a6a1e;border-bottom:2px solid #8a6a1e"><td style="padding:7px 0 7px 12px;font-weight:bold;font-size:13px">TOTAL DE RECEITAS OPERACIONAIS</td><td style="text-align:right;font-weight:bold;font-size:13px;padding:7px 0;font-family:monospace;color:#6b1a2a">${formatBRL(total)}</td></tr>
          </tbody>
        </table>
        <div style="height:12px"></div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:4px">
          <thead><tr style="border-bottom:1px solid #8a6a1e"><th style="text-align:left;font-size:12px;font-weight:bold;padding:4px 0;color:#6b1a2a">ARRECADAÇÃO POR MÉTODO DE PAGAMENTO</th><th></th></tr></thead>
          <tbody>${metodoRows}</tbody>
        </table>
        <div style="height:12px"></div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:4px">
          <thead><tr style="border-bottom:1px solid #8a6a1e"><th style="text-align:left;font-size:12px;font-weight:bold;padding:4px 0;color:#6b1a2a">ARRECADAÇÃO POR CANAL DE ORIGEM</th><th></th></tr></thead>
          <tbody>${origemRows}</tbody>
        </table>
        ${comunidadeRows ? `<div style="height:12px"></div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:4px">
          <thead><tr style="border-bottom:1px solid #8a6a1e"><th style="text-align:left;font-size:12px;font-weight:bold;padding:4px 0;color:#6b1a2a">ARRECADAÇÃO POR COMUNIDADE</th><th></th></tr></thead>
          <tbody>${comunidadeRows}</tbody>
        </table>` : ''}
        <div style="height:12px"></div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px"><tbody>
          <tr style="background:#6b1a2a"><td style="padding:8px 12px;font-weight:bold;font-size:14px;color:#fff">TOTAL GERAL ARRECADADO</td><td style="text-align:right;font-weight:bold;font-size:14px;padding:8px 12px;font-family:monospace;color:#f5d98c">${formatBRL(total)}</td></tr>
          <tr><td colspan="2" style="padding:4px 12px;font-size:11px;color:#888">Nº de transações aprovadas: ${d.length} &nbsp;|&nbsp; Data de fechamento: ${hoje}</td></tr>
        </tbody></table>
        <div style="border-top:1px solid #8a6a1e;padding-top:24px;margin-top:8px">
          <div style="display:flex;justify-content:space-between;gap:32px">
            <div style="flex:1;text-align:center"><div style="border-top:1px solid #1a0a0a;padding-top:6px;margin-top:40px"><p style="font-size:12px;font-weight:bold;margin:0">${nomeTesoureiro || 'Tesoureiro / Responsável Financeiro'}</p>${cpfTesoureiro ? `<p style="font-size:11px;color:#666;margin:2px 0">CPF: ${cpfTesoureiro}</p>` : ''}</div></div>
            <div style="flex:1;text-align:center"><div style="border-top:1px solid #1a0a0a;padding-top:6px;margin-top:40px"><p style="font-size:12px;font-weight:bold;margin:0">${nomeParoco || 'Pároco / Administrador Paroquial'}</p>${cpfParoco ? `<p style="font-size:11px;color:#666;margin:2px 0">CPF: ${cpfParoco}</p>` : ''}</div></div>
          </div>
          <p style="text-align:center;font-size:10px;color:#aaa;margin-top:16px">Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} — Sistema de Gestão do Dízimo</p>
        </div>
      </body></html>`;
  }, [nomeParoquia, cnpj, dataInicioFmt, dataFimFmt, dadosBalancete, totalBalancete, hoje, nomeTesoureiro, cpfTesoureiro, nomeParoco, cpfParoco, balanceteComunidade, nomeComunidadeBalancete]);

  // ─── Imprimir Balancete (popup) ─────────────────────────────────────────────
  const imprimirBalancete = () => {
    const html = gerarHtmlBalancete();
    const w = window.open('', '_blank', 'width=700,height=900');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.print();
  };

  // ─── Exportar Balancete como PDF real (compactado) ──────────────────────────
  const exportarBalancetePDF = useCallback(async () => {
    const html = gerarHtmlBalancete();
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '700px';
    container.style.background = '#fff';
    container.style.zIndex = '-1';
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    container.innerHTML = bodyMatch ? bodyMatch[1] : '';
    container.style.fontFamily = 'Georgia, serif';
    container.style.fontSize = '13px';
    container.style.color = '#1a0a0a';
    container.style.lineHeight = '1.5';
    container.style.padding = '24px 28px';
    document.body.appendChild(container);

    await new Promise(r => setTimeout(r, 100));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    document.body.removeChild(container);

    const imgData = canvas.toDataURL('image/jpeg', 0.75);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 12;
    const usableW = pageW - margin * 2;
    const imgH = (canvas.height * usableW) / canvas.width;

    if (imgH <= pageH - margin * 2) {
      pdf.addImage(imgData, 'JPEG', margin, margin, usableW, imgH);
    } else {
      const pxPerPage = canvas.width * (pageH - margin * 2) / usableW;
      let srcY = 0;
      let page = 0;
      while (srcY < canvas.height) {
        if (page > 0) pdf.addPage();
        const sliceH = Math.min(pxPerPage, canvas.height - srcY);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceH;
        const ctx = sliceCanvas.getContext('2d')!;
        ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.75);
        const sliceMMH = (sliceH * usableW) / canvas.width;
        pdf.addImage(sliceData, 'JPEG', margin, margin, usableW, sliceMMH);
        srcY += sliceH;
        page++;
      }
    }

    const periodo = `${dataInicio}_${dataFim}`.replace(/-/g, '');
    pdf.save(`balancete_${periodo}.pdf`);
  }, [dataInicio, dataFim, gerarHtmlBalancete]);


  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
            <p className="text-muted-foreground text-sm">Exportação e análise de contribuições</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setModalBalancete(true)} variant="outline" size="sm" className="border-primary/40 text-primary hover:bg-primary/10">
              <FileCheck className="h-4 w-4 mr-2" />
              Fechar Balancete
            </Button>
            <Button onClick={exportPDF} variant="outline" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button onClick={exportPDF} size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
        </div>

        <Tabs defaultValue="contribuicoes">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="contribuicoes" className="flex items-center gap-1.5">
              <Activity className="h-4 w-4" />
              Contribuições
            </TabsTrigger>
            <TabsTrigger value="colaboradores" className="flex items-center gap-1.5">
              <HandHeart className="h-4 w-4" />
              Colaboradores
            </TabsTrigger>
          </TabsList>

          {/* ═══ ABA CONTRIBUIÇÕES ═══ */}
          <TabsContent value="contribuicoes" className="space-y-6 mt-4">
            {/* Filtros */}
            <Card>
              <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Filter className="h-4 w-4" /> Filtros
                  {filtrosAtivos > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-2 text-[10px]">
                      {filtrosAtivos} ativo{filtrosAtivos > 1 ? 's' : ''}
                    </Badge>
                  )}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={limparFiltros}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3 mr-1" /> Limpar
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Atalhos de período */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
                    <CalendarRange className="h-3 w-3" /> Período:
                  </span>
                  {([
                    ['hoje', 'Hoje'],
                    ['7d', 'Últimos 7 dias'],
                    ['30d', 'Últimos 30 dias'],
                    ['mes', 'Mês atual'],
                    ['mes_anterior', 'Mês anterior'],
                    ['ano', 'Ano atual'],
                  ] as const).map(([key, label]) => (
                    <Button
                      key={key}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => aplicarPreset(key)}
                      className="h-7 px-2.5 text-xs"
                    >
                      {label}
                    </Button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="rel-data-inicio" className="text-xs text-muted-foreground">Data início</Label>
                    <Input
                      id="rel-data-inicio"
                      type="date"
                      value={dataInicio}
                      max={dataFim || undefined}
                      onChange={e => setDataInicio(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rel-data-fim" className="text-xs text-muted-foreground">Data fim</Label>
                    <Input
                      id="rel-data-fim"
                      type="date"
                      value={dataFim}
                      min={dataInicio || undefined}
                      max={format(new Date(), 'yyyy-MM-dd')}
                      onChange={e => setDataFim(e.target.value)}
                      className={`h-10 ${dataInicio && dataFim && dataInicio > dataFim ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                      aria-invalid={dataInicio && dataFim ? dataInicio > dataFim : false}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rel-tipo" className="text-xs text-muted-foreground">Tipo</Label>
                    <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                      <SelectTrigger id="rel-tipo" className="h-10"><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos tipos</SelectItem>
                        <SelectItem value="dizimo">Dízimo</SelectItem>
                        <SelectItem value="oferta">Oferta</SelectItem>
                        <SelectItem value="campanha">Campanha</SelectItem>
                        <SelectItem value="eventual">Eventual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rel-metodo" className="text-xs text-muted-foreground">Método</Label>
                    <Select value={filtroMetodo} onValueChange={setFiltroMetodo}>
                      <SelectTrigger id="rel-metodo" className="h-10"><SelectValue placeholder="Método" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos métodos</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="credito">Crédito</SelectItem>
                        <SelectItem value="debito">Débito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rel-origem" className="text-xs text-muted-foreground">Origem</Label>
                    <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
                      <SelectTrigger id="rel-origem" className="h-10"><SelectValue placeholder="Origem" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todas origens</SelectItem>
                        <SelectItem value="web">Web</SelectItem>
                        <SelectItem value="totem">Totem</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="kiosk">Kiosk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rel-comunidade" className="text-xs text-muted-foreground">Comunidade</Label>
                    <Select value={filtroComunidade} onValueChange={setFiltroComunidade}>
                      <SelectTrigger id="rel-comunidade" className="h-10"><SelectValue placeholder="Comunidade" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todas comunidades</SelectItem>
                        <SelectItem value="sem_comunidade">Sem comunidade</SelectItem>
                        {comunidades.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {dataInicio && dataFim && dataInicio > dataFim && (
                  <p className="text-xs text-destructive">A data inicial não pode ser maior que a final.</p>
                )}

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                  <Button
                    onClick={buscar}
                    disabled={loading || (!!dataInicio && !!dataFim && dataInicio > dataFim)}
                    className="h-10 min-w-[180px]"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    {loading ? 'Buscando...' : 'Aplicar filtros'}
                  </Button>
                </div>
              </CardContent>
            </Card>


            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardContent className="p-5 h-full flex flex-col justify-between min-h-[140px]">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total arrecadado</p>
                  <div>
                    <p className="text-3xl font-bold text-primary leading-tight">{formatBRL(totalGeral)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{dados.length} pagamentos aprovados</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 min-h-[140px]">
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Por tipo</p>
                  <div className="space-y-1">
                    {porTipo.map(([tipo, valor]) => (
                      <div key={tipo} className="flex justify-between text-sm gap-2">
                        <span className="text-muted-foreground truncate">{TIPO_LABELS[tipo] || tipo}</span>
                        <span className="font-medium shrink-0">{formatBRL(Number(valor))}</span>
                      </div>
                    ))}
                    {porTipo.length === 0 && <p className="text-xs text-muted-foreground italic">Sem dados</p>}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 min-h-[140px]">
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Por método</p>
                  <div className="space-y-1">
                    {porMetodo.map(([metodo, valor]) => (
                      <div key={metodo} className="flex justify-between text-sm gap-2">
                        <span className="text-muted-foreground truncate">{METODO_LABELS[metodo] || metodo}</span>
                        <span className="font-medium shrink-0">{formatBRL(Number(valor))}</span>
                      </div>
                    ))}
                    {porMetodo.length === 0 && <p className="text-xs text-muted-foreground italic">Sem dados</p>}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 min-h-[140px]">
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Por comunidade
                  </p>
                  <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                    {porComunidade.length > 0 ? porComunidade.map(c => (
                      <div key={c.nome} className="flex justify-between text-sm gap-2">
                        <span className="text-muted-foreground truncate">{c.nome}</span>
                        <span className="font-medium shrink-0">{formatBRL(c.valor)}</span>
                      </div>
                    )) : <p className="text-xs text-muted-foreground italic">Sem dados</p>}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabela contribuições — desktop */}
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-8 text-center text-muted-foreground">Carregando...</div>
                ) : dados.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">Nenhum pagamento no período.</div>
                ) : (
                  <>
                    {/* Cards mobile */}
                    <div className="sm:hidden divide-y divide-border">
                      {dados.map(p => (
                        <div key={p.id} className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <p className="font-semibold text-sm text-foreground">
                              {(p.paroquianos as any)?.nome_completo || <span className="italic text-muted-foreground">Anônimo</span>}
                            </p>
                            <p className="font-bold text-primary text-sm shrink-0">{formatBRL(Number(p.valor))}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">{format(new Date(p.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{TIPO_LABELS[p.tipo]}</span>
                            <span className="text-xs text-muted-foreground">{METODO_LABELS[p.metodo]}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ORIGEM_COLORS[p.origem || 'web'] || ''}`}>
                              {ORIGEM_LABELS[p.origem || 'web']}
                            </span>
                            {(p.paroquianos as any)?.comunidades?.nome && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
                                {(p.paroquianos as any).comunidades.nome}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Tabela desktop */}
                    <div className="hidden sm:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Fiel</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead>Origem</TableHead>
                            <TableHead>Comunidade</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dados.map(p => (
                            <TableRow key={p.id}>
                              <TableCell className="text-xs text-muted-foreground">
                                {format(new Date(p.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                              </TableCell>
                              <TableCell className="text-sm">{(p.paroquianos as any)?.nome_completo || <span className="italic text-muted-foreground">Anônimo</span>}</TableCell>
                              <TableCell className="text-xs">{TIPO_LABELS[p.tipo] || p.tipo}</TableCell>
                              <TableCell className="text-xs">{METODO_LABELS[p.metodo] || p.metodo}</TableCell>
                              <TableCell>
                                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ORIGEM_COLORS[p.origem || 'web'] || ''}`}>
                                  {ORIGEM_LABELS[p.origem || 'web']}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {(p.paroquianos as any)?.comunidades?.nome || '—'}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-primary text-sm">
                                {formatBRL(Number(p.valor))}
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
          </TabsContent>

          {/* ═══ ABA COLABORADORES ═══ */}
          <TabsContent value="colaboradores" className="space-y-6 mt-4">
            {/* Cards de resumo dos colaboradores */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Colaboradores cadastrados</p>
                  <p className="text-2xl font-bold text-primary mt-1">{atividadeColabs.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Pagamentos via admin/kiosk</p>
                  <p className="text-2xl font-bold text-primary mt-1">{pagamentosAdmin.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">registros encontrados</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Total arrecadado via admin/kiosk</p>
                  <p className="text-2xl font-bold text-primary mt-1">
                    {formatBRL(pagamentosAdmin.filter((p: any) => p.status === 'pago').reduce((acc: number, p: any) => acc + Number(p.valor), 0))}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Atividade por colaborador */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Atividade por Colaborador
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingColabs ? (
                  <div className="p-8 text-center text-muted-foreground">Carregando...</div>
                ) : atividadeColabs.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <HandHeart className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhum colaborador cadastrado ainda.</p>
                  </div>
                ) : (
                  <>
                    {/* Cards mobile */}
                    <div className="sm:hidden divide-y divide-border">
                      {atividadeColabs.map(c => (
                        <div key={c.user_id} className="p-4">
                          <p className="font-semibold text-sm text-foreground">{c.nome}</p>
                          <div className="grid grid-cols-2 gap-1 mt-2">
                            <p className="text-xs text-muted-foreground">Ações: <span className="font-medium text-foreground">{c.totalAcoes}</span></p>
                            <p className="text-xs text-muted-foreground">Pagamentos: <span className="font-medium text-foreground">{c.pagamentosRegistrados}</span></p>
                            <p className="text-xs text-muted-foreground col-span-2">Total: <span className="font-semibold text-primary">{formatBRL(c.totalArrecadado)}</span></p>
                            {c.ultimaAtividade && (
                              <p className="text-xs text-muted-foreground col-span-2">
                                Última atividade: {format(new Date(c.ultimaAtividade), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Tabela desktop */}
                    <div className="hidden sm:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Colaborador</TableHead>
                            <TableHead className="text-center">Total de Ações</TableHead>
                            <TableHead className="text-center">Pagamentos Registrados</TableHead>
                            <TableHead className="text-right">Valor Rastreado</TableHead>
                            <TableHead>Última Atividade</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {atividadeColabs.map(c => (
                            <TableRow key={c.user_id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="h-8 w-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center">
                                    <HandHeart className="h-4 w-4 text-amber-600" />
                                  </div>
                                  <span className="font-medium text-sm">{c.nome}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-sm font-semibold">{c.totalAcoes}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-sm font-semibold">{c.pagamentosRegistrados}</span>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-primary text-sm">
                                {formatBRL(c.totalArrecadado)}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {c.ultimaAtividade
                                  ? format(new Date(c.ultimaAtividade), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                                  : '—'}
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

            {/* Pagamentos registrados via admin/kiosk */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Pagamentos Registrados via Admin / Kiosk
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingColabs ? (
                  <div className="p-8 text-center text-muted-foreground">Carregando...</div>
                ) : pagamentosAdmin.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">Nenhum pagamento via admin ou kiosk encontrado.</div>
                ) : (
                  <>
                    {/* Cards mobile */}
                    <div className="sm:hidden divide-y divide-border">
                      {pagamentosAdmin.slice(0, 100).map((p: any) => (
                        <div key={p.id} className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <p className="font-semibold text-sm text-foreground">
                              {p.paroquianos?.nome_completo || p.nome_contribuinte || 'Anônimo'}
                            </p>
                            <p className="font-bold text-primary text-sm shrink-0">{formatBRL(Number(p.valor))}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">{format(new Date(p.created_at), 'dd/MM/yy', { locale: ptBR })}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ORIGEM_COLORS[p.origem || 'web'] || ''}`}>
                              {ORIGEM_LABELS[p.origem || 'web']}
                            </span>
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{TIPO_LABELS[p.tipo]}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Tabela desktop */}
                    <div className="hidden sm:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Fiel / Dizimista</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead>Canal</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagamentosAdmin.slice(0, 100).map((p: any) => (
                            <TableRow key={p.id}>
                              <TableCell className="text-xs text-muted-foreground">
                                {format(new Date(p.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                              </TableCell>
                              <TableCell className="text-sm font-medium">
                                {p.paroquianos?.nome_completo || p.nome_contribuinte || (
                                  <span className="italic text-muted-foreground">Anônimo</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">{TIPO_LABELS[p.tipo] || p.tipo}</TableCell>
                              <TableCell className="text-xs">{METODO_LABELS[p.metodo] || p.metodo}</TableCell>
                              <TableCell>
                                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ORIGEM_COLORS[p.origem || 'web'] || ''}`}>
                                  {ORIGEM_LABELS[p.origem || 'web']}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                                  p.status === 'pago' ? 'bg-green-100 text-green-700 border-green-200'
                                  : p.status === 'cancelado' ? 'bg-red-100 text-red-700 border-red-200'
                                  : 'bg-muted text-muted-foreground border-border'
                                }`}>
                                  {p.status}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-primary text-sm">
                                {formatBRL(Number(p.valor))}
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
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Modal Balancete ──────────────────────────────────────────────── */}
      <Dialog open={modalBalancete} onOpenChange={setModalBalancete}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Fechamento de Balancete — {dataInicioFmt} a {dataFimFmt}
            </DialogTitle>
          </DialogHeader>

          {/* Campos editáveis antes de imprimir */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-2 border-b border-border pb-4">
            <div>
              <Label className="text-xs">Nome da Paróquia</Label>
              <Input value={nomeParoquia} onChange={e => setNomeParoquia(e.target.value)} placeholder="Nome da paróquia" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">CNPJ</Label>
              <Input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="XX.XXX.XXX/0001-XX" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Nome Tesoureiro/Responsável</Label>
              <Input value={nomeTesoureiro} onChange={e => setNomeTesoureiro(e.target.value)} placeholder="Nome completo" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">CPF Tesoureiro</Label>
              <Input value={cpfTesoureiro} onChange={e => setCpfTesoureiro(e.target.value)} placeholder="000.000.000-00" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Nome Pároco/Administrador</Label>
              <Input value={nomeParoco} onChange={e => setNomeParoco(e.target.value)} placeholder="Nome completo" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">CPF Pároco</Label>
              <Input value={cpfParoco} onChange={e => setCpfParoco(e.target.value)} placeholder="000.000.000-00" className="h-8 text-sm" />
            </div>
          </div>

          {/* Filtro de comunidade para o balancete */}
          {comunidades.length > 0 && (
            <div className="flex items-center gap-3 py-2 border-b border-border pb-4">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1">
                <Label className="text-xs font-medium">Filtrar por Comunidade</Label>
                <Select value={balanceteComunidade} onValueChange={setBalanceteComunidade}>
                  <SelectTrigger className="h-8 text-sm mt-1">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as comunidades (consolidado)</SelectItem>
                    <SelectItem value="sem_comunidade">Sem comunidade</SelectItem>
                    {comunidades.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* ─── DOCUMENTO DO BALANCETE ─── */}
          <div
            id="balancete-print"
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: 13,
              color: '#1a0a0a',
              border: '1px solid #ccc',
              borderRadius: 8,
              padding: '24px 28px',
              background: '#fff',
              lineHeight: 1.5,
            }}
          >
            {/* Cabeçalho */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #8a6a1e', paddingBottom: 12, marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 'bold', margin: 0, color: '#6b1a2a', letterSpacing: 1 }}>
                {nomeParoquia || 'PARÓQUIA'}
              </p>
              {cnpj && <p style={{ fontSize: 11, margin: '2px 0', color: '#555' }}>CNPJ: {cnpj}</p>}
              <p style={{ fontSize: 14, fontWeight: 'bold', margin: '8px 0 0', color: '#1a0a0a' }}>BALANCETE DE RECEITAS</p>
              <p style={{ fontSize: 11, margin: '2px 0', color: '#555' }}>
                Período: {dataInicioFmt} a {dataFimFmt}
              </p>
              {nomeComunidadeBalancete && (
                <p style={{ fontSize: 12, margin: '4px 0', color: '#6b1a2a', fontWeight: 'bold' }}>
                  Comunidade: {nomeComunidadeBalancete}
                </p>
              )}
            </div>

            {/* 4.1 — Receitas Operacionais */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 4 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #8a6a1e' }}>
                  <th style={{ textAlign: 'left', fontSize: 12, fontWeight: 'bold', padding: '4px 0', color: '#6b1a2a' }}>
                    RECEITAS OPERACIONAIS
                  </th>
                  <th style={{ textAlign: 'right', fontSize: 11, color: '#888', padding: '4px 0', fontWeight: 'normal' }}>
                    ITG 2002 / CFC
                  </th>
                </tr>
              </thead>
              <tbody>
                {['dizimo', 'oferta', 'campanha', 'eventual'].map(tipo => {
                  const valor = dadosBalancete
                    .filter(p => p.tipo === tipo)
                    .reduce((acc, p) => acc + Number(p.valor), 0);
                  return (
                    <tr key={tipo} style={{ borderBottom: '1px solid #f0eae2' }}>
                      <td style={{ padding: '5px 0 5px 12px', fontSize: 12 }}>
                        {TIPO_CONTA[tipo]}
                      </td>
                      <td style={{ textAlign: 'right', padding: '5px 0', fontSize: 12, fontFamily: 'monospace' }}>
                        {formatBRL(valor)}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: '2px solid #8a6a1e', borderBottom: '2px solid #8a6a1e' }}>
                  <td style={{ padding: '7px 0 7px 12px', fontWeight: 'bold', fontSize: 13 }}>
                    TOTAL DE RECEITAS OPERACIONAIS
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: 13, padding: '7px 0', fontFamily: 'monospace', color: '#6b1a2a' }}>
                    {formatBRL(totalBalancete)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ height: 12 }} />

            {/* Arrecadação por Método */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 4 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #8a6a1e' }}>
                  <th style={{ textAlign: 'left', fontSize: 12, fontWeight: 'bold', padding: '4px 0', color: '#6b1a2a' }}>
                    ARRECADAÇÃO POR MÉTODO DE PAGAMENTO
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {['pix', 'credito', 'debito'].map(metodo => {
                  const valor = dadosBalancete
                    .filter(p => p.metodo === metodo)
                    .reduce((acc, p) => acc + Number(p.valor), 0);
                  return (
                    <tr key={metodo} style={{ borderBottom: '1px solid #f0eae2' }}>
                      <td style={{ padding: '5px 0 5px 12px', fontSize: 12 }}>{METODO_LABELS[metodo]}</td>
                      <td style={{ textAlign: 'right', padding: '5px 0', fontSize: 12, fontFamily: 'monospace' }}>
                        {formatBRL(valor)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ height: 12 }} />

            {/* Arrecadação por Origem */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 4 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #8a6a1e' }}>
                  <th style={{ textAlign: 'left', fontSize: 12, fontWeight: 'bold', padding: '4px 0', color: '#6b1a2a' }}>
                    ARRECADAÇÃO POR CANAL DE ORIGEM
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {['web', 'totem', 'admin', 'kiosk'].map(origem => {
                  const valor = dadosBalancete
                    .filter(p => (p.origem || 'web') === origem)
                    .reduce((acc, p) => acc + Number(p.valor), 0);
                  return (
                    <tr key={origem} style={{ borderBottom: '1px solid #f0eae2' }}>
                      <td style={{ padding: '5px 0 5px 12px', fontSize: 12 }}>{ORIGEM_LABELS[origem]}</td>
                      <td style={{ textAlign: 'right', padding: '5px 0', fontSize: 12, fontFamily: 'monospace' }}>
                        {formatBRL(valor)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Arrecadação por Comunidade (only in consolidated mode) */}
            {balanceteComunidade === 'todos' && porComunidade.length > 0 && (
              <>
                <div style={{ height: 12 }} />
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 4 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #8a6a1e' }}>
                      <th style={{ textAlign: 'left', fontSize: 12, fontWeight: 'bold', padding: '4px 0', color: '#6b1a2a' }}>
                        ARRECADAÇÃO POR COMUNIDADE
                      </th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {porComunidade.map(c => (
                      <tr key={c.nome} style={{ borderBottom: '1px solid #f0eae2' }}>
                        <td style={{ padding: '5px 0 5px 12px', fontSize: 12 }}>{c.nome}</td>
                        <td style={{ textAlign: 'right', padding: '5px 0', fontSize: 12, fontFamily: 'monospace' }}>
                          {formatBRL(c.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <div style={{ height: 12 }} />

            {/* Linha totalizadora final */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
              <tbody>
                <tr style={{ background: '#6b1a2a' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 'bold', fontSize: 14, color: '#fff' }}>
                    TOTAL GERAL ARRECADADO
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: 14, padding: '8px 12px', fontFamily: 'monospace', color: '#f5d98c' }}>
                    {formatBRL(totalBalancete)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ padding: '4px 12px', fontSize: 11, color: '#888' }}>
                    Nº de transações aprovadas: {dadosBalancete.length} &nbsp;|&nbsp; Data de fechamento: {hoje}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Bloco de Assinaturas */}
            <div style={{ borderTop: '1px solid #8a6a1e', paddingTop: 24, marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32 }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ borderTop: '1px solid #1a0a0a', paddingTop: 6, marginTop: 40 }}>
                    <p style={{ fontSize: 12, fontWeight: 'bold', margin: 0 }}>
                      {nomeTesoureiro || 'Tesoureiro / Responsável Financeiro'}
                    </p>
                    {cpfTesoureiro && <p style={{ fontSize: 11, color: '#666', margin: '2px 0' }}>CPF: {cpfTesoureiro}</p>}
                  </div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ borderTop: '1px solid #1a0a0a', paddingTop: 6, marginTop: 40 }}>
                    <p style={{ fontSize: 12, fontWeight: 'bold', margin: 0 }}>
                      {nomeParoco || 'Pároco / Administrador Paroquial'}
                    </p>
                    {cpfParoco && <p style={{ fontSize: 11, color: '#666', margin: '2px 0' }}>CPF: {cpfParoco}</p>}
                  </div>
                </div>
              </div>
              <p style={{ textAlign: 'center', fontSize: 10, color: '#aaa', marginTop: 16 }}>
                Documento gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} — Sistema de Gestão do Dízimo
              </p>
            </div>
          </div>

          <DialogFooter className="flex-row justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setModalBalancete(false)}>
              Fechar
            </Button>
            <Button variant="outline" onClick={imprimirBalancete} className="border-primary/40 text-primary hover:bg-primary/10">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir Balancete
            </Button>
            <Button onClick={exportarBalancetePDF}>
              <Download className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminRelatorios;
