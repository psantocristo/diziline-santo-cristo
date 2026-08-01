import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import ParoquianoLayout from '@/components/layouts/ParoquianoLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HandCoins, Heart, Star, Church, Loader2, CalendarDays, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfMonth, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Pagamento {
  id: string;
  tipo: string;
  valor: number;
  metodo: string;
  status: string;
  created_at: string;
  codigo_autenticacao: string | null;
  mes_referencia: string | null;
}

const TIPO_ICONS: Record<string, React.ReactNode> = {
  dizimo: <HandCoins className="h-5 w-5 text-primary" />,
  oferta: <Heart className="h-5 w-5 text-red-500" />,
  campanha: <Star className="h-5 w-5 text-yellow-500" />,
  eventual: <Church className="h-5 w-5 text-purple-500" />,
};

const STATUS_COLORS: Record<string, string> = {
  pago: 'bg-green-100 text-green-700 border-green-200',
  aguardando_pagamento: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  cancelado: 'bg-destructive/10 text-destructive border-destructive/20',
  expirado: 'bg-muted text-muted-foreground border-border',
  criado: 'bg-blue-100 text-blue-700 border-blue-200',
};

const STATUS_LABEL: Record<string, string> = {
  pago: 'Pago',
  aguardando_pagamento: 'Aguardando',
  cancelado: 'Cancelado',
  expirado: 'Expirado',
  criado: 'Criado',
  estornado: 'Estornado',
};

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const POR_PAGINA = 15;

const fetchHistorico = async (userId: string) => {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();

  const parRes = await (supabase as any)
    .from('paroquianos').select('id, data_inicio_dizimista').eq('user_id', userId).maybeSingle();
  const par = parRes.data as any;

  // Histórico inclui pagamentos do user (web) E do paroquiano (totem/admin)
  let pagQuery = supabase.from('pagamentos')
    .select('id, tipo, valor, metodo, status, created_at, codigo_autenticacao, mes_referencia', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(200);
  if (par?.id) {
    pagQuery = pagQuery.or(`user_id.eq.${userId},paroquiano_id.eq.${par.id}`);
  } else {
    pagQuery = pagQuery.eq('user_id', userId);
  }
  const pagRes = await pagQuery;

  const pagamentos = (pagRes.data || []) as Pagamento[];
  const dataInicio = par?.data_inicio_dizimista ? new Date(par.data_inicio_dizimista + 'T00:00:00') : null;


  // Fetch dízimo months
  let query = (supabase as any)
    .from('pagamentos')
    .select('mes_referencia, status')
    .eq('tipo', 'dizimo')
    .gte('mes_referencia', `${anoAtual}-01-01`)
    .lte('mes_referencia', `${anoAtual}-12-31`);

  if (par?.id) {
    query = query.eq('paroquiano_id', par.id);
  } else {
    query = query.eq('user_id', userId);
  }

  const { data: pgs } = await query;
  const statusMap: Record<string, string> = {};
  if (pgs) {
    pgs.forEach((p: any) => {
      const k = p.mes_referencia?.slice(0, 7);
      if (k && (!statusMap[k] || p.status === 'pago')) statusMap[k] = p.status;
    });
  }

  const mesesDizimo = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(anoAtual, i, 1);
    const k = format(d, 'yyyy-MM');
    // Pago tem prioridade absoluta (mesmo se mês "futuro")
    if (statusMap[k] === 'pago') return { mes: i, status: 'pago' };
    const isFuturo = isAfter(d, startOfMonth(hoje));
    const isAntesInicio = dataInicio && d < startOfMonth(dataInicio);
    if (isFuturo || isAntesInicio) return { mes: i, status: 'futuro' };
    return { mes: i, status: 'atraso' };
  });

  return { pagamentos, mesesDizimo, anoAtual };
};

const Historico = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [visivel, setVisivel] = useState(POR_PAGINA);

  const { data, isLoading } = useQuery({
    queryKey: ['paroquiano-historico', user?.id],
    queryFn: () => fetchHistorico(user!.id),
    enabled: !!user,
  });

  // Realtime: revalida quando pagamentos mudarem (web, totem ou admin)
  useEffect(() => {
    if (!user) return;
    const channel = (supabase as any)
      .channel(`historico-pagamentos-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos' }, () => {
        queryClient.invalidateQueries({ queryKey: ['paroquiano-historico', user.id] });
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [user, queryClient]);


  const allPagamentos = data?.pagamentos || [];
  const pagamentos = allPagamentos.slice(0, visivel);
  const mesesDizimo = data?.mesesDizimo || [];
  const anoAtual = data?.anoAtual || new Date().getFullYear();

  if (isLoading) {
    return (
      <ParoquianoLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ParoquianoLayout>
    );
  }

  return (
    <ParoquianoLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Histórico de Contribuições</h2>
          <p className="text-muted-foreground text-sm">Todas as suas contribuições registradas</p>
        </div>

        {/* Grade visual de meses do dízimo */}
        {mesesDizimo.length > 0 && (
          <Card className="border-border/60">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Situação do Dízimo — {anoAtual}</p>
              </div>
              <div className="grid grid-cols-6 gap-1.5 mb-3">
                {mesesDizimo.map((m) => {
                  const colorMap: Record<string, string> = {
                    pago: 'bg-green-100 border-green-300 text-green-800',
                    atraso: 'bg-red-100 border-red-300 text-red-700',
                    futuro: 'bg-muted border-border text-muted-foreground',
                  };
                  const iconMap: Record<string, React.ReactNode> = {
                    pago: <CheckCircle2 className="h-3 w-3" />,
                    atraso: <AlertCircle className="h-3 w-3" />,
                  };
                  return (
                    <div key={m.mes} className={`rounded-lg border px-1.5 py-2 text-center text-xs font-medium flex flex-col items-center gap-0.5 ${colorMap[m.status]}`}>
                      <span>{MESES_PT[m.mes]}</span>
                      {iconMap[m.status]}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500"></span>{mesesDizimo.filter(m => m.status === 'pago').length} em dia</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400"></span>{mesesDizimo.filter(m => m.status === 'atraso').length} em atraso</span>
              </div>
            </CardContent>
          </Card>
        )}

        {pagamentos.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-12 text-center">
              <HandCoins className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma contribuição ainda.</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Suas contribuições aparecerão aqui.</p>
            </CardContent>
          </Card>
        ) : (
          pagamentos.map(p => (
            <Card key={p.id} className="border-border/60 hover:shadow-card transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="bg-muted rounded-xl p-2.5 shrink-0">
                    {TIPO_ICONS[p.tipo] || <HandCoins className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="font-semibold text-foreground capitalize">{p.tipo}</p>
                      <p className="font-bold text-primary shrink-0">
                        R$ {Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", STATUS_COLORS[p.status] || 'bg-muted text-muted-foreground')}>
                        {STATUS_LABEL[p.status] || p.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {p.metodo === 'pix' ? '🔷 PIX' : p.metodo === 'credito' ? '💳 Crédito' : '💳 Débito'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      {p.tipo === 'dizimo' && p.mes_referencia && (
                        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                          📅 Ref.: {new Date(p.mes_referencia + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
        {pagamentos.length > 0 && pagamentos.length < allPagamentos.length && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              onClick={() => setVisivel(prev => prev + POR_PAGINA)}
              className="gap-2"
            >
              Ver Mais ({pagamentos.length} de {allPagamentos.length})
            </Button>
          </div>
        )}
      </div>
    </ParoquianoLayout>
  );
};

export default Historico;
