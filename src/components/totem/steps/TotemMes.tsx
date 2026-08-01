import React, { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TotemMesProps {
  paroquianoId: string | undefined;
  onConfirmar: (mesRef: Date) => void;
}

interface MesStatus {
  date: Date;
  pago: boolean;
  aguardando: boolean;
}

const TotemMes: React.FC<TotemMesProps> = ({ paroquianoId, onConfirmar }) => {
  const hoje = new Date();
  const mesAtual = startOfMonth(hoje);
  const anoAtual = hoje.getFullYear();

  const [mesSelecionado, setMesSelecionado] = useState<Date>(mesAtual);
  const [mesesStatus, setMesesStatus] = useState<MesStatus[]>([]);
  const [loading, setLoading] = useState(true);

  // Grade: todos os 12 meses do ano atual
  const grade: Date[] = Array.from({ length: 12 }, (_, i) => new Date(anoAtual, i, 1));

  useEffect(() => {
    if (!paroquianoId) {
      setMesesStatus(grade.map(d => ({ date: d, pago: false, aguardando: false })));
      setLoading(false);
      return;
    }

    const fetchStatus = async () => {
      setLoading(true);
      const { data } = await supabase.rpc('get_meses_dizimista', {
        _paroquiano_id: paroquianoId,
        _ano: anoAtual,
      });

      const statusMap: Record<string, string> = {};
      if (data && Array.isArray(data)) {
        (data as { mes_referencia: string; status: string }[]).forEach(p => {
          const key = p.mes_referencia;
          // priorize: pago > aguardando
          if (!statusMap[key] || p.status === 'pago') {
            statusMap[key] = p.status;
          }
        });
      }

      setMesesStatus(grade.map(d => ({
        date: d,
        pago: statusMap[format(d, 'yyyy-MM-dd')] === 'pago',
        aguardando: statusMap[format(d, 'yyyy-MM-dd')] === 'aguardando_pagamento',
      })));
      setLoading(false);
    };

    fetchStatus();
  }, [paroquianoId]);

  const mesSelecionadoStr = format(mesSelecionado, 'MMMM yyyy', { locale: ptBR });
  const mesAtualStr = format(mesAtual, 'MMMM yyyy', { locale: ptBR });
  const isMesAtual = format(mesSelecionado, 'yyyy-MM') === format(mesAtual, 'yyyy-MM');

  const statusSelecionado = mesesStatus.find(
    m => format(m.date, 'yyyy-MM') === format(mesSelecionado, 'yyyy-MM')
  );

  return (
    <div className="flex flex-col gap-8 w-full max-w-2xl mx-auto">
      {/* Destaque mês selecionado */}
      <div
        className="rounded-3xl p-8 text-center shadow-lg"
        style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))' }}
      >
        <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-90" style={{ color: 'hsl(var(--primary-foreground))' }} />
        <p className="font-medium opacity-80 mb-1 text-lg" style={{ color: 'hsl(var(--primary-foreground))' }}>
          {isMesAtual ? 'Mês atual selecionado' : 'Mês selecionado'}
        </p>
        <h2
          className="font-bold capitalize"
          style={{ fontSize: 36, color: 'hsl(var(--primary-foreground))' }}
        >
          {mesSelecionadoStr}
        </h2>
        {statusSelecionado?.pago && (
          <div className="mt-3 inline-flex items-center gap-2 bg-green-500/20 rounded-full px-4 py-1.5">
            <CheckCircle2 className="h-4 w-4 text-green-200" />
            <span className="text-green-100 text-sm font-medium">Já pago neste mês</span>
          </div>
        )}
      </div>

      {/* Grade de meses */}
      <div>
        <p className="text-center font-medium mb-4" style={{ color: 'hsl(var(--secondary-foreground) / 0.6)', fontSize: 18 }}>
          Alterar mês de referência
        </p>
        {loading ? (
          <div className="text-center py-8" style={{ color: 'hsl(var(--secondary-foreground) / 0.4)', fontSize: 16 }}>
            Verificando pagamentos...
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {grade.map((d) => {
              const key = format(d, 'yyyy-MM');
              const status = mesesStatus.find(m => format(m.date, 'yyyy-MM') === key);
              const isSelecionado = format(mesSelecionado, 'yyyy-MM') === key;
              const isAtual = format(mesAtual, 'yyyy-MM') === key;
              const isFuturo = d > mesAtual;
              const isPago = status?.pago ?? false;
              const isAguardando = status?.aguardando ?? false;

              let bg = 'hsl(var(--muted))';
              let cor = 'hsl(var(--muted-foreground))';
              let border = 'transparent';

              if (isPago) {
                bg = 'hsl(142 71% 94%)';
                cor = 'hsl(142 71% 30%)';
                border = 'hsl(142 71% 70%)';
              } else if (isAguardando) {
                bg = 'hsl(48 96% 93%)';
                cor = 'hsl(35 92% 33%)';
                border = 'hsl(48 96% 65%)';
              } else if (isSelecionado) {
                bg = 'hsl(var(--primary))';
                cor = 'hsl(var(--primary-foreground))';
                border = 'hsl(var(--primary))';
              } else if (isAtual) {
                border = 'hsl(var(--primary))';
              }

              return (
                <button
                  key={key}
                  onClick={() => !isPago && setMesSelecionado(d)}
                  disabled={isPago}
                  className="rounded-2xl p-3 text-center transition-all active:scale-95 flex flex-col items-center gap-1"
                  style={{
                    background: bg,
                    color: cor,
                    border: `2px solid ${border}`,
                    opacity: isPago ? 0.85 : 1,
                    cursor: isPago ? 'default' : 'pointer',
                  }}
                >
                  <span className="text-xs font-medium capitalize leading-tight">
                    {format(d, 'MMM', { locale: ptBR })}
                  </span>
                  <span className="text-sm font-bold">{format(d, 'yyyy')}</span>
                  {isPago && <CheckCircle2 className="h-4 w-4 mt-0.5" style={{ color: 'hsl(142 71% 40%)' }} />}
                  {isAguardando && !isPago && (
                    <span className="text-xs leading-tight">Aguard.</span>
                  )}
                  {isFuturo && !isPago && !isSelecionado && (
                    <span className="text-xs opacity-50 leading-tight">Futuro</span>
                  )}
                  {isAtual && !isPago && !isSelecionado && (
                    <span className="text-xs font-bold leading-tight">Atual</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Botão confirmar */}
      <button
        onClick={() => !statusSelecionado?.pago && onConfirmar(mesSelecionado)}
        disabled={statusSelecionado?.pago}
        className="w-full rounded-2xl py-5 font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: statusSelecionado?.pago ? 'hsl(var(--muted))' : 'hsl(var(--primary))',
          color: statusSelecionado?.pago ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary-foreground))',
          fontSize: 22,
        }}
      >
        {statusSelecionado?.pago ? (
          'Mês já pago — selecione outro'
        ) : (
          <>
            Confirmar: <span className="capitalize">{mesSelecionadoStr}</span>
            <ChevronRight size={24} />
          </>
        )}
      </button>
    </div>
  );
};

export default TotemMes;
