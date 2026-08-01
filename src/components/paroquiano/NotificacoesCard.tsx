import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, BellOff, Loader2, CalendarClock, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { detectPlatform, isIOS, isStandalone, pushSupported, subscribePush, unsubscribePush } from '@/lib/pwa';

export default function NotificacoesCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [melhorDia, setMelhorDia] = useState<string>('');
  const [paroquianoId, setParoquianoId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await (supabase as any)
        .from('paroquianos')
        .select('id, melhor_dia_pagamento, notificacoes_push_ativas')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setParoquianoId(data.id);
        setMelhorDia(data.melhor_dia_pagamento ? String(data.melhor_dia_pagamento) : '');
        setEnabled(!!data.notificacoes_push_ativas);
      }
      // Check actual subscription
      if (pushSupported()) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          const sub = await reg?.pushManager.getSubscription();
          if (!sub) setEnabled(false);
        } catch {}
      }
      setLoading(false);
    })();
  }, [user]);

  const ativar = async () => {
    setSaving(true);
    try {
      const sub = await subscribePush();
      if (!sub) throw new Error('Falha ao registrar notificações.');
      const { error } = await supabase.functions.invoke('push-subscribe', {
        body: { subscription: sub, platform: detectPlatform(), user_agent: navigator.userAgent },
      });
      if (error) throw error;
      if (paroquianoId) {
        await (supabase as any).from('paroquianos').update({ notificacoes_push_ativas: true }).eq('id', paroquianoId);
      }
      setEnabled(true);
      toast({ title: 'Notificações ativadas!', description: 'Você receberá lembretes importantes no seu celular.' });
    } catch (e: any) {
      toast({ title: 'Não foi possível ativar', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const desativar = async () => {
    setSaving(true);
    try {
      await unsubscribePush();
      if (paroquianoId) {
        await (supabase as any).from('paroquianos').update({ notificacoes_push_ativas: false }).eq('id', paroquianoId);
      }
      await supabase.functions.invoke('push-unsubscribe', { body: {} });
      setEnabled(false);
      toast({ title: 'Notificações desativadas' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const salvarMelhorDia = async (dia: string) => {
    setMelhorDia(dia);
    if (!paroquianoId) return;
    const val = dia ? parseInt(dia, 10) : null;
    await (supabase as any).from('paroquianos').update({ melhor_dia_pagamento: val }).eq('id', paroquianoId);
    toast({ title: 'Preferência salva', description: dia ? `Lembraremos você no dia ${dia} de cada mês.` : 'Lembrete desativado.' });
  };

  if (loading) return null;

  const iosNeedsInstall = isIOS() && !isStandalone();

  return (
    <Card className="border-border/60">
      <CardContent className="pt-4 pb-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-lg p-2 ${enabled ? 'bg-primary/10' : 'bg-muted'}`}>
            {enabled ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Notificações no celular</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Aniversário, lembrete do melhor dia e dízimo atrasado.
            </p>
            {iosNeedsInstall && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-2 leading-snug">
                📱 No iPhone, instale primeiro: <strong>Compartilhar → Adicionar à Tela de Início</strong>.
              </p>
            )}
          </div>
          <Switch
            checked={enabled}
            disabled={saving || !pushSupported()}
            onCheckedChange={(c) => (c ? ativar() : desativar())}
          />
        </div>

        {enabled && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                const { data, error } = await supabase.functions.invoke('enviar-push-teste', { body: {} });
                if (error) throw error;
                const r = data as any;
                if (r?.ok) {
                  toast({
                    title: 'Notificação enviada!',
                    description: `Enviada para ${r.enviados} dispositivo(s). Se não chegar, verifique se as notificações estão liberadas no sistema.`,
                  });
                } else {
                  throw new Error(r?.error || 'Falha ao enviar.');
                }
              } catch (e: any) {
                toast({ title: 'Erro no teste', description: e.message, variant: 'destructive' });
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar notificação de teste
          </Button>
        )}

        <div className="border-t pt-3">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
            <CalendarClock className="h-3.5 w-3.5" /> Melhor dia para pagar o dízimo
          </label>
          <Select value={melhorDia} onValueChange={salvarMelhorDia}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Escolha um dia (opcional)" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="0">Sem preferência</SelectItem>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {saving && <Loader2 className="h-3 w-3 animate-spin mt-1 inline" />}
        </div>
      </CardContent>
    </Card>
  );
}
