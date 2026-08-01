import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Landmark, Copy, Webhook } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Step {
  id: string;
  titulo: string;
  ok: boolean;
  detalhe: string;
  extra?: Record<string, unknown>;
}

/**
 * Diagnóstico ponta a ponta da integração PIX Sicredi:
 * proxy mTLS → OAuth → cobrança de teste → consulta → webhook.
 */
export const SicrediPanel: React.FC = () => {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [modo, setModo] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const { toast } = useToast();

  const rodar = async (criarCobranca: boolean) => {
    setLoading(true);
    setSteps(null);
    try {
      const { data, error } = await supabase.functions.invoke('rede-gateway', {
        body: { action: 'sicredi-diagnostics', criarCobranca },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSteps(data?.steps || []);
      setWebhookUrl(data?.webhookUrl || '');
      setModo(data?.modo || '');
    } catch (err: any) {
      toast({ title: 'Falha no diagnóstico', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const registrarWebhook = async () => {
    setRegistrando(true);
    try {
      const { data, error } = await supabase.functions.invoke('rede-gateway', {
        body: { action: 'sicredi-webhook-register' },
      });
      if (error) throw error;
      toast({
        title: data?.ok ? 'Webhook registrado' : 'Não foi possível registrar',
        description: data?.message,
        variant: data?.ok ? 'default' : 'destructive',
      });
      if (data?.ok) rodar(false);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setRegistrando(false);
    }
  };

  const copiar = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast({ title: 'Copiado' });
  };

  const copiaECola = steps?.find((s) => s.id === 'cob')?.extra?.copyPaste as string | undefined;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Landmark className="h-4 w-4 text-primary" />
          Sicredi PIX — Diagnóstico da integração
          {modo && <Badge variant="outline" className="text-[10px] uppercase">{modo}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Valida proxy mTLS, credenciais OAuth, criação e consulta de cobrança e o registro do webhook.
          O passo com cobrança gera um PIX real de <strong>R$ 0,01</strong>.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => rodar(false)} disabled={loading}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Verificar configuração
          </Button>
          <Button size="sm" onClick={() => rodar(true)} disabled={loading}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Teste completo (R$ 0,01)
          </Button>
          <Button size="sm" variant="secondary" onClick={registrarWebhook} disabled={registrando}>
            {registrando ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Webhook className="h-3.5 w-3.5 mr-1.5" />}
            Registrar webhook
          </Button>
        </div>

        {steps && (
          <div className="space-y-2">
            {steps.map((s) => (
              <div
                key={s.id}
                className="flex items-start gap-2 rounded-md border p-2.5 text-xs"
              >
                {s.ok
                  ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  : <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                <div className="min-w-0">
                  <p className="font-medium">{s.titulo}</p>
                  <p className="text-muted-foreground break-words">{s.detalhe}</p>
                  {s.id === 'webhook' && !!s.extra?.esperado && (
                    <p className="text-muted-foreground break-all mt-1">
                      Esperado: <code>{String(s.extra.esperado).replace(/s=[^&]+/, 's=***')}</code>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {copiaECola && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
            <p className="text-xs font-medium">Copia-e-cola da cobrança de teste</p>
            <code className="block text-[10px] break-all text-muted-foreground">{copiaECola}</code>
            <Button size="sm" variant="outline" onClick={() => copiar(copiaECola)}>
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
            </Button>
          </div>
        )}

        {webhookUrl && (
          <p className="text-[11px] text-muted-foreground break-all">
            URL do webhook desta instalação:{' '}
            <code>{webhookUrl.replace(/s=[^&]+/, 's=***')}</code>
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default SicrediPanel;
