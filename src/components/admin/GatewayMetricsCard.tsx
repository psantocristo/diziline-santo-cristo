import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProviderMetric {
  provedor: string;
  total: number;
  aprovados: number;
  recusados: number;
  pendentes: number;
  volume: number;
  taxa_aprovacao: number | null;
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

const labelProv: Record<string, string> = {
  rede: 'e.Rede (Itaú)',
  sicredi: 'Sicredi (Sipag)',
  pagarme: 'Pagar.me',
  desconhecido: 'Outro',
};

export const GatewayMetricsCard: React.FC<{ dias?: number }> = ({ dias = 30 }) => {
  const [data, setData] = useState<ProviderMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: res } = await (supabase.rpc as any)('get_gateway_metrics', { _dias: dias });
      if (!cancel) {
        setData(Array.isArray(res) ? (res as ProviderMetric[]) : []);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [dias]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Conversão por provedor — últimos {dias} dias
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma transação no período.</p>
        ) : (
          <div className="space-y-3">
            {data.map((m) => (
              <div key={m.provedor} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{labelProv[m.provedor] || m.provedor}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.total} transações · {m.aprovados} aprovadas · {m.recusados} recusadas
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1.5 justify-end">
                    <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                    <span className="font-semibold text-sm">{Number(m.taxa_aprovacao || 0).toFixed(1)}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{fmtBRL(Number(m.volume) || 0)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-1.5 flex-wrap">
          <Badge variant="secondary" className="text-xs">Webhook seguro (HMAC)</Badge>
          <Badge variant="secondary" className="text-xs">Reconciliação automática</Badge>
          <Badge variant="secondary" className="text-xs">Idempotência ativa</Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default GatewayMetricsCard;