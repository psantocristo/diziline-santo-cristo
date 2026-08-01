import React, { useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import ParoquianoLayout from '@/components/layouts/ParoquianoLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { HandCoins, Clock, FileText, Heart, Star, CheckCircle, CalendarDays, Cake, TrendingUp, Target, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { format, startOfMonth, subMonths, isAfter, getYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import BirthdayModal, { useBirthdayModalState } from '@/components/paroquiano/BirthdayModal';
import InstallPrompt from '@/components/InstallPrompt';

const fetchParoquianoDashboard = async (userId: string) => {
  // 1. Profile + paroquiano (precisa primeiro para filtrar pagamentos do totem)
  const [{ data: profile }, { data: par }] = await Promise.all([
    supabase.from('profiles').select('nome_completo').eq('id', userId).single(),
    (supabase as any).from('paroquianos')
      .select('id, data_inicio_dizimista, data_nascimento, valor_sugerido, comunidades(nome)')
      .eq('user_id', userId).maybeSingle(),
  ]);

  // 2. Pagamentos pagos — inclui totem/admin via paroquiano_id
  let pagQuery = supabase.from('pagamentos')
    .select('valor, created_at, tipo')
    .eq('status', 'pago');
  if (par?.id) {
    pagQuery = pagQuery.or(`user_id.eq.${userId},paroquiano_id.eq.${par.id}`);
  } else {
    pagQuery = pagQuery.eq('user_id', userId);
  }
  const { data: pagamentos } = await pagQuery;

  const total = pagamentos?.reduce((acc, p) => acc + Number(p.valor), 0) || 0;
  const count = pagamentos?.length || 0;
  const ultimo = pagamentos && pagamentos.length > 0
    ? pagamentos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
    : null;

  // Gráfico últimos 12 meses
  const now = new Date();
  const mesesMap: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const mes = subMonths(now, i);
    mesesMap[format(mes, 'MMM/yy', { locale: ptBR })] = 0;
  }
  pagamentos?.forEach(p => {
    const key = format(new Date(p.created_at), 'MMM/yy', { locale: ptBR });
    if (key in mesesMap) mesesMap[key] += Number(p.valor);
  });
  const contribuicoesMensais = Object.entries(mesesMap).map(([mes, valor]) => ({ mes, valor }));

    

  const hoje = new Date();
  const dataInicio = par?.data_inicio_dizimista
    ? new Date(par.data_inicio_dizimista + 'T00:00:00')
    : null;

  let isAniversario = false;
  if (par?.data_nascimento) {
    const nascimento = new Date(par.data_nascimento + 'T00:00:00');
    if (nascimento.getDate() === hoje.getDate() && nascimento.getMonth() === hoje.getMonth()) {
      isAniversario = true;
    }
  }

  // 4. Meses dízimo (Jan-Dez do ano atual)
  const anoAtual = hoje.getFullYear();
  const meses = Array.from({ length: 12 }, (_, i) => startOfMonth(new Date(anoAtual, i, 1)));
  let query = (supabase as any)
    .from('pagamentos')
    .select('mes_referencia, status')
    .eq('tipo', 'dizimo')
    .not('mes_referencia', 'is', null)
    .gte('mes_referencia', `${anoAtual}-01-01`)
    .lte('mes_referencia', `${anoAtual}-12-31`);

  // Inclui pagamentos via app (user_id), totem e admin (paroquiano_id)
  if (par?.id) {
    query = query.or(`user_id.eq.${userId},paroquiano_id.eq.${par.id}`);
  } else {
    query = query.eq('user_id', userId);
  }

  const { data: pgs } = await query;
  const statusMap: Record<string, string> = {};
  if (pgs) {
    pgs.forEach((p: any) => {
      const k = p.mes_referencia?.slice(0, 7);
      if (!k) return;
      // Pago sempre prevalece sobre outros status
      if (statusMap[k] === 'pago') return;
      statusMap[k] = p.status;
    });
  }

  const mesAtualKey = format(startOfMonth(hoje), 'yyyy-MM');
  const mesesDizimo = meses.map(d => {
    const k = format(d, 'yyyy-MM');
    const isAntesInicio = dataInicio && d < startOfMonth(dataInicio);
    // 1) Pago tem prioridade absoluta — independe se mês é "futuro"
    if (statusMap[k] === 'pago') return { date: d, status: 'pago' as const };
    if (isAntesInicio) return { date: d, status: 'futuro' as const };
    // 2) Mês futuro (depois do mês atual) e ainda não pago
    if (k > mesAtualKey) return { date: d, status: 'futuro' as const };
    // 3) Mês atual ou passado sem pagamento
    return { date: d, status: 'atraso' as const };
  });

  return {
    nomeCompleto: profile?.nome_completo || '',
    comunidadeNome: par?.comunidades?.nome || '',
    stats: { total, count, ultimo },
    contribuicoesMensais,
    mesesDizimo,
    isAniversario,
    valorSugerido: par?.valor_sugerido ? Number(par.valor_sugerido) : null,
  };
};

const ParoquianoDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['paroquiano-dashboard', user?.id],
    queryFn: () => fetchParoquianoDashboard(user!.id),
    enabled: !!user,
  });

  // Realtime: sincroniza calendário/histórico assim que qualquer pagamento mudar
  useEffect(() => {
    if (!user) return;
    const channel = (supabase as any)
      .channel(`dashboard-pagamentos-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos' }, () => {
        queryClient.invalidateQueries({ queryKey: ['paroquiano-dashboard', user.id] });
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [user, queryClient]);


  const nomeCompleto = data?.nomeCompleto || '';
  const comunidadeNome = data?.comunidadeNome || '';
  const stats = data?.stats || { total: 0, count: 0, ultimo: null };
  const contribuicoesMensais = data?.contribuicoesMensais || [];
  const mesesDizimo = data?.mesesDizimo || [];
  const isAniversario = data?.isAniversario || false;
  const valorSugerido = data?.valorSugerido || null;

  const primeiroNome = nomeCompleto.split(' ')[0] || 'Paroquiano';

  const adimplencia = useMemo(() => {
    const relevantes = mesesDizimo.filter(m => m.status !== 'futuro');
    if (relevantes.length === 0) return { percentual: 100, emDia: 0, emAtraso: 0, total: 0 };
    const emDia = relevantes.filter(m => m.status === 'pago').length;
    const emAtraso = relevantes.filter(m => m.status === 'atraso').length;
    return {
      percentual: Math.round((emDia / relevantes.length) * 100),
      emDia,
      emAtraso,
      total: relevantes.length,
    };
  }, [mesesDizimo]);

  const metaAnual = useMemo(() => {
    if (!valorSugerido || valorSugerido <= 0) return null;
    const meta = valorSugerido * 12;
    const anoAtual = getYear(new Date());
    const contribuidoAno = contribuicoesMensais
      .filter(m => m.mes.includes(`/${String(anoAtual).slice(2)}`))
      .reduce((acc, m) => acc + m.valor, 0);
    return { meta, contribuido: contribuidoAno, percentual: Math.min(100, Math.round((contribuidoAno / meta) * 100)) };
  }, [valorSugerido, contribuicoesMensais]);

  const variacao = useMemo(() => {
    if (contribuicoesMensais.length < 2) return null;
    const atual = contribuicoesMensais[contribuicoesMensais.length - 1]?.valor || 0;
    const anterior = contribuicoesMensais[contribuicoesMensais.length - 2]?.valor || 0;
    if (anterior === 0 && atual === 0) return null;
    const pct = anterior > 0 ? ((atual - anterior) / anterior) * 100 : atual > 0 ? 100 : 0;
    return { atual, anterior, percentual: pct };
  }, [contribuicoesMensais]);

  const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const [birthdayOpen, setBirthdayOpen] = useBirthdayModalState(isAniversario);

  if (isLoading) {
    return (
      <ParoquianoLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </ParoquianoLayout>
    );
  }

  return (
    <ParoquianoLayout>
      <BirthdayModal open={birthdayOpen} onOpenChange={setBirthdayOpen} nome={nomeCompleto} paroquia={comunidadeNome} />
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Aniversário */}
        {isAniversario && (
          <Card className="bg-gradient-to-r from-primary/10 via-accent/30 to-primary/10 border-primary/30 shadow-lg animate-in fade-in slide-in-from-top-2">
            <CardContent className="pt-5 pb-5 text-center space-y-2">
              <Cake className="h-10 w-10 text-primary mx-auto" />
              <h3 className="text-lg font-bold text-foreground">🎂 Feliz Aniversário, {primeiroNome}! 🎉</h3>
              <p className="text-sm text-foreground/70 italic leading-relaxed max-w-md mx-auto">
                Que Deus continue abençoando sua vida com muita saúde, paz e alegria.
                Agradecemos por toda sua dedicação e contribuição à nossa comunidade. Você é muito especial para nós!
              </p>
              <p className="text-xs text-muted-foreground mt-1">— Com carinho, sua Paróquia 🙏</p>
            </CardContent>
          </Card>
        )}

        {/* Boas-vindas */}
        <div className="bg-gradient-hero rounded-2xl p-6 text-center shadow-wine">
          <p className="text-primary/70 text-sm mb-1">Bem-vindo(a),</p>
          <h2 className="text-2xl font-bold text-primary mb-2">{primeiroNome}! 🙏</h2>
          {comunidadeNome && (
            <p className="text-primary/80 text-xs font-medium mb-1">📍 Comunidade: {comunidadeNome}</p>
          )}
          <p className="text-primary/60 text-sm italic">
            "Cada contribuição fortalece a missão da fé"
          </p>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-border/60">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total contribuído</p>
              <p className="text-2xl font-bold text-primary">
                {formatBRL(stats.total)}
              </p>
              {variacao && (
                <div className={`flex items-center justify-center gap-1 mt-1 text-xs font-medium ${variacao.percentual >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {variacao.percentual >= 0
                    ? <ArrowUpRight className="h-3 w-3" />
                    : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(variacao.percentual).toFixed(0)}% vs mês anterior
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Contribuições</p>
              <p className="text-2xl font-bold text-secondary">{stats.count}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Adimplência: {adimplencia.percentual}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Meta Anual */}
        {metaAnual && (
          <Card className="border-border/60">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Meta Anual de Contribuição</p>
              </div>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className="text-xs text-muted-foreground">Contribuído</p>
                  <p className="text-lg font-bold text-primary">{formatBRL(metaAnual.contribuido)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Meta</p>
                  <p className="text-sm font-medium text-foreground">{formatBRL(metaAnual.meta)}</p>
                </div>
              </div>
              <Progress value={metaAnual.percentual} className="h-3" />
              <p className="text-xs text-muted-foreground mt-1.5 text-center">
                {metaAnual.percentual}% da meta — faltam {formatBRL(Math.max(0, metaAnual.meta - metaAnual.contribuido))}
              </p>
            </CardContent>
          </Card>
        )}


        {/* Situação do Dízimo (Calendário visual) */}
        {mesesDizimo.length > 0 && (
          <Card className="border-border/60">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Situação do Dízimo</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  adimplencia.percentual >= 80 ? 'bg-green-100 text-green-700' :
                  adimplencia.percentual >= 50 ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {adimplencia.percentual >= 80 ? 'Em dia ✓' :
                   adimplencia.percentual >= 50 ? 'Atenção !' : 'Irregular ✗'}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5 mb-3">
                {mesesDizimo.map((m, i) => {
                  const colorClass = m.status === 'pago' ? 'bg-green-500' : m.status === 'atraso' ? 'bg-red-400' : 'bg-muted border border-border';
                  return (
                    <div key={i} className="flex flex-col items-center gap-0.5" title={`${format(m.date, 'MMMM yyyy', { locale: ptBR })} — ${m.status === 'pago' ? 'Pago' : m.status === 'atraso' ? 'Em atraso' : 'Futuro'}`}>
                      <div className={`w-full h-3.5 rounded-full ${colorClass} transition-all hover:scale-110`} />
                      <span className="text-[9px] text-muted-foreground">{format(m.date, 'MMM', { locale: ptBR })}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500"></span>
                  {adimplencia.emDia} em dia
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400"></span>
                  {adimplencia.emAtraso} em atraso
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contribuir */}
        <Button asChild className="w-full h-16 text-lg font-semibold bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-wine" size="lg">
          <Link to="/paroquiano/contribuir">
            <HandCoins className="h-6 w-6 mr-3" />
            Fazer Contribuição
          </Link>
        </Button>

        {/* Acesso rápido */}
        <div className="grid grid-cols-2 gap-3">
          <Button asChild variant="outline" className="h-14 border-border/60 flex-col gap-1 hover:bg-muted">
            <Link to="/paroquiano/historico">
              <Clock className="h-5 w-5 text-primary" />
              <span className="text-xs">Histórico</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-14 border-border/60 flex-col gap-1 hover:bg-muted">
            <Link to="/paroquiano/comprovantes">
              <FileText className="h-5 w-5 text-primary" />
              <span className="text-xs">Comprovantes</span>
            </Link>
          </Button>
        </div>


        {/* Versículo */}
        <Card className="bg-accent/30 border-primary/20">
          <CardContent className="pt-4 pb-4 text-center">
            <Star className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-sm text-foreground/80 italic mb-2">
              "Cada um dê conforme determinou em seu coração, não com tristeza ou por obrigação, pois Deus ama quem dá com alegria."
            </p>
            <p className="text-xs text-muted-foreground">— 2 Coríntios 9,7</p>
          </CardContent>
        </Card>

        {/* Último pagamento */}
        {stats.ultimo && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
            <CheckCircle className="h-6 w-6 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">Último pagamento confirmado</p>
              <p className="text-xs text-green-600">
                {new Date(stats.ultimo).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        )}
      </div>
      <InstallPrompt />
    </ParoquianoLayout>
  );
};

export default ParoquianoDashboard;
