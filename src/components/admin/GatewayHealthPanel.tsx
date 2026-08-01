import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Result = { ok: boolean; message: string } | null;

/**
 * Painel de health-check dos provedores de pagamento online (Rede / Sicredi / Pagar.me).
 * Chama a edge function `rede-gateway` com action=test_connection — o dispatcher interno
 * roteia para o provedor configurado.
 */
export const GatewayHealthPanel: React.FC = () => {
  const [result, setResult] = useState<Result>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const testar = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('rede-gateway', {
        body: { action: 'test-connection' },
      });
      if (error) throw error;
      const ok = !!(data?.success ?? data?.ok);
      setResult({ ok, message: data?.message || (ok ? 'Conexão ok' : 'Falha na conexão') });
    } catch (err: any) {
      setResult({ ok: false, message: err.message || 'Erro ao testar gateway' });
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Gateway de Pagamento Online
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Testa as credenciais do provedor configurado (Rede, Sicredi ou Pagar.me).
        </p>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={testar} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Testar conexão
          </Button>
          {result && (
            <Badge variant={result.ok ? 'default' : 'destructive'} className="text-xs">
              {result.ok ? '✅' : <AlertTriangle className="h-3 w-3 mr-1 inline" />}
              {result.message}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GatewayHealthPanel;