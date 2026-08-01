import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Bell, Smartphone, Calendar, Clock, AlertCircle, Loader2, RefreshCw,
  Eye, Cake, CalendarClock, AlarmClock, Mail, Save,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import EnviarLembretePushButton from '@/components/admin/EnviarLembretePushButton';

interface Stats {
  dispositivos: number;
  dizimistasInscritos: number;
  dizimistasOptIn: number;
  enviadosHoje: number;
  porPlataforma: { ios: number; android: number; web: number };
}

interface Flags {
  id?: string;
  email_aniversario_ativo: boolean;
  notif_aniversario_ativo: boolean;
  notif_melhor_dia_ativo: boolean;
  notif_atraso_ativo: boolean;
}

const PUSH_PREVIEWS = {
  aniversario: {
    icon: <Cake className="h-5 w-5" />,
    title: '🎂 Feliz aniversário!',
    body: 'Maria, que Deus abençoe seu dia com paz e alegria. 🙏',
    quando: 'Disparado às 09:00 BRT no dia do aniversário.',
  },
  melhor_dia: {
    icon: <CalendarClock className="h-5 w-5" />,
    title: '💝 Hoje é o seu dia de contribuir',
    body: 'Dedique um momento e faça seu dízimo com alegria. Toque aqui para contribuir.',
    quando: 'Disparado às 09:00 BRT no melhor dia escolhido pelo dizimista.',
  },
  atraso: {
    icon: <AlarmClock className="h-5 w-5" />,
    title: '⏰ Seu dízimo está pendente',
    body: 'Você ainda não fez sua contribuição este mês. Toque para regularizar agora.',
    quando: 'Disparado 3 dias após o melhor dia (ou após o dia 10) se ainda não houve pagamento no mês.',
  },
} as const;

type PushKind = keyof typeof PUSH_PREVIEWS;

export default function NotificacoesPushPanel() {
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [executando, setExecutando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [flags, setFlags] = useState<Flags>({
    email_aniversario_ativo: true,
    notif_aniversario_ativo: true,
    notif_melhor_dia_ativo: true,
    notif_atraso_ativo: true,
  });

  // Preview state
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [emailPreviewHtml, setEmailPreviewHtml] = useState<string>('');
  const [emailPreviewSubject, setEmailPreviewSubject] = useState<string>('');
  const [loadingEmailPreview, setLoadingEmailPreview] = useState(false);
  const [pushPreview, setPushPreview] = useState<PushKind | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const [{ data: subs }, { count: optIn }, { count: enviados }, { data: cfg }] = await Promise.all([
        (supabase as any).from('push_subscriptions').select('user_id, platform'),
        (supabase as any).from('paroquianos').select('id', { count: 'exact', head: true }).eq('status', 'ativo').eq('notificacoes_push_ativas', true),
        (supabase as any)
          .from('notificacoes_enviadas')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        (supabase as any)
          .from('configuracoes_paroquia')
          .select('id, email_aniversario_ativo, notif_aniversario_ativo, notif_melhor_dia_ativo, notif_atraso_ativo')
          .limit(1)
          .maybeSingle(),
      ]);
      const lista = (subs as any[]) || [];
      const porPlataforma = { ios: 0, android: 0, web: 0 };
      const users = new Set<string>();
      for (const s of lista) {
        users.add(s.user_id);
        const p = (s.platform || 'web') as 'ios' | 'android' | 'web';
        if (p in porPlataforma) (porPlataforma as any)[p]++;
        else porPlataforma.web++;
      }
      setStats({
        dispositivos: lista.length,
        dizimistasInscritos: users.size,
        dizimistasOptIn: optIn || 0,
        enviadosHoje: enviados || 0,
        porPlataforma,
      });
      if (cfg) {
        setFlags({
          id: (cfg as any).id,
          email_aniversario_ativo: (cfg as any).email_aniversario_ativo ?? true,
          notif_aniversario_ativo: (cfg as any).notif_aniversario_ativo ?? true,
          notif_melhor_dia_ativo: (cfg as any).notif_melhor_dia_ativo ?? true,
          notif_atraso_ativo: (cfg as any).notif_atraso_ativo ?? true,
        });
      }
    } catch (e: any) {
      toast({ title: 'Erro ao carregar', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const salvarFlags = async () => {
    if (!flags.id) {
      toast({ title: 'Configuração não encontrada', description: 'Preencha os dados da paróquia primeiro.', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      const { error } = await (supabase as any)
        .from('configuracoes_paroquia')
        .update({
          email_aniversario_ativo: flags.email_aniversario_ativo,
          notif_aniversario_ativo: flags.notif_aniversario_ativo,
          notif_melhor_dia_ativo: flags.notif_melhor_dia_ativo,
          notif_atraso_ativo: flags.notif_atraso_ativo,
        })
        .eq('id', flags.id);
      if (error) throw error;
      toast({ title: 'Preferências salvas', description: 'As alterações entram em vigor no próximo disparo.' });
    } catch (e: any) {
      toast({ title: 'Falha ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const executarAgora = async () => {
    setExecutando(true);
    try {
      const { data, error } = await supabase.functions.invoke('enviar-push-notificacoes', { body: {} });
      if (error) throw error;
      const r = (data as any)?.stats;
      toast({
        title: 'Rotina executada',
        description: r
          ? `Aniversário: ${r.aniversario} | Melhor dia: ${r.lembrete} | Atraso: ${r.atraso} | Envios: ${r.total_envios}`
          : 'Concluído.',
      });
      carregar();
    } catch (e: any) {
      toast({ title: 'Falha', description: e.message, variant: 'destructive' });
    } finally {
      setExecutando(false);
    }
  };

  const previewEmail = async () => {
    setLoadingEmailPreview(true);
    setEmailPreviewOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke('enviar-email-aniversario', {
        body: { preview: true, nome: 'Maria' },
      });
      if (error) throw error;
      const html = (data as any)?.html as string;
      const subject = (data as any)?.subject as string;
      if (!html) throw new Error('Sem HTML no retorno.');
      setEmailPreviewHtml(html);
      setEmailPreviewSubject(subject || '');
    } catch (e: any) {
      toast({ title: 'Falha ao gerar pré-visualização', description: e.message, variant: 'destructive' });
      setEmailPreviewOpen(false);
    } finally {
      setLoadingEmailPreview(false);
    }
  };

  const previewData = useMemo(() => (pushPreview ? PUSH_PREVIEWS[pushPreview] : null), [pushPreview]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações Push (PWA)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Envio automático para aniversário, lembrete do melhor dia de pagamento e dízimo atrasado.
            Os dizimistas precisam instalar o app na tela de início e ativar as notificações no perfil.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={<Smartphone className="h-4 w-4" />} label="Dispositivos" value={stats?.dispositivos ?? '—'} hint="Inscrições ativas" loading={loading} />
            <StatCard icon={<Bell className="h-4 w-4" />} label="Dizimistas inscritos" value={stats?.dizimistasInscritos ?? '—'} hint={`${stats?.dizimistasOptIn ?? 0} com opt-in`} loading={loading} />
            <StatCard icon={<Calendar className="h-4 w-4" />} label="Enviados hoje" value={stats?.enviadosHoje ?? '—'} hint="Total de notificações" loading={loading} />
            <StatCard
              icon={<Smartphone className="h-4 w-4" />}
              label="Plataformas"
              value={
                <span className="flex gap-1.5 text-xs font-medium flex-wrap">
                  <Badge variant="secondary">iOS {stats?.porPlataforma.ios ?? 0}</Badge>
                  <Badge variant="secondary">Android {stats?.porPlataforma.android ?? 0}</Badge>
                  <Badge variant="secondary">Web {stats?.porPlataforma.web ?? 0}</Badge>
                </span>
              }
              loading={loading}
            />
          </div>

          <Separator />

          {/* Toggles por tipo */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Ativação por tipo de notificação</h3>
              <Button size="sm" onClick={salvarFlags} disabled={salvando || loading}>
                {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar preferências
              </Button>
            </div>

            <ToggleRow
              icon={<Cake className="h-4 w-4" />}
              title="Push de aniversário"
              description="Envia uma felicitação ao dizimista no dia do aniversário."
              checked={flags.notif_aniversario_ativo}
              onChange={(v) => setFlags((f) => ({ ...f, notif_aniversario_ativo: v }))}
              previewLabel="Ver push"
              onPreview={() => setPushPreview('aniversario')}
            />
            <ToggleRow
              icon={<CalendarClock className="h-4 w-4" />}
              title="Lembrete do melhor dia"
              description="Lembra o dizimista no dia escolhido por ele para pagar o dízimo."
              checked={flags.notif_melhor_dia_ativo}
              onChange={(v) => setFlags((f) => ({ ...f, notif_melhor_dia_ativo: v }))}
              previewLabel="Ver push"
              onPreview={() => setPushPreview('melhor_dia')}
            />
            <ToggleRow
              icon={<AlarmClock className="h-4 w-4" />}
              title="Dízimo atrasado"
              description="Avisa quando o mês está terminando e ainda não houve contribuição."
              checked={flags.notif_atraso_ativo}
              onChange={(v) => setFlags((f) => ({ ...f, notif_atraso_ativo: v }))}
              previewLabel="Ver push"
              onPreview={() => setPushPreview('atraso')}
            />
            <ToggleRow
              icon={<Mail className="h-4 w-4" />}
              title="E-mail de aniversário"
              description="Envia o cartão de aniversário por e-mail (usa as credenciais Resend acima)."
              checked={flags.email_aniversario_ativo}
              onChange={(v) => setFlags((f) => ({ ...f, email_aniversario_ativo: v }))}
              previewLabel="Ver e-mail"
              onPreview={previewEmail}
            />
          </div>

          <Separator />

          {/* Cronograma */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4" /> Disparos automáticos
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
              <li>Todos os dias às <strong>09:00 (Brasília)</strong> — push de aniversário, lembrete do melhor dia e dízimo atrasado.</li>
              <li>Todos os dias às <strong>09:05 (Brasília)</strong> — e-mail de aniversário (usa as credenciais Resend acima).</li>
              <li>Sem duplicação: cada destinatário recebe no máximo uma vez por dia por tipo.</li>
              <li>Tipos desativados acima são pulados na próxima execução.</li>
            </ul>
          </div>

          {/* Ações manuais */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Disparos manuais</h3>
            <div className="flex flex-wrap gap-2">
              <EnviarLembretePushButton />
              <Button variant="outline" size="sm" onClick={executarAgora} disabled={executando}>
                {executando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Rodar rotina diária agora
              </Button>
              <Button variant="ghost" size="sm" onClick={carregar} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar estatísticas
              </Button>
            </div>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              O lembrete manual envia apenas para dizimistas que instalaram o app e ativaram as notificações no perfil.
              No iPhone, o usuário precisa <strong>Compartilhar → Adicionar à Tela de Início</strong> (iOS 16.4+).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Modal pré-visualização do e-mail */}
      <Dialog open={emailPreviewOpen} onOpenChange={setEmailPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" /> Pré-visualização: e-mail de aniversário
            </DialogTitle>
            <DialogDescription>
              {emailPreviewSubject ? <>Assunto: <strong>{emailPreviewSubject}</strong></> : 'Renderizado com os dados atuais da paróquia.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded border bg-muted/30">
            {loadingEmailPreview ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <iframe
                title="Pré-visualização do e-mail"
                srcDoc={emailPreviewHtml}
                sandbox=""
                className="w-full h-[70vh] bg-white"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal pré-visualização do push */}
      <Dialog open={!!pushPreview} onOpenChange={(o) => !o && setPushPreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" /> Pré-visualização do push
            </DialogTitle>
            <DialogDescription>{previewData?.quando}</DialogDescription>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4">
              {/* Mock de notificação */}
              <div className="rounded-xl border bg-card shadow-sm p-4 flex gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  {previewData.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm truncate">{previewData.title}</p>
                    <span className="text-[10px] text-muted-foreground">agora</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{previewData.body}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">Diziline · Notificação</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                A aparência final pode variar conforme o sistema operacional (iOS, Android ou desktop) e as preferências do dispositivo.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ToggleRow({
  icon, title, description, checked, onChange, previewLabel, onPreview,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  previewLabel: string;
  onPreview: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border p-3 bg-card">
      <div className="flex gap-3 items-start min-w-0">
        <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <Label className="text-sm font-medium">{title}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button type="button" variant="outline" size="sm" onClick={onPreview}>
          <Eye className="h-3.5 w-3.5 mr-1.5" />
          {previewLabel}
        </Button>
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
    </div>
  );
}

function StatCard({
  icon, label, value, hint, loading,
}: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string; loading?: boolean }) {
  return (
    <div className="rounded-lg border p-3 bg-card">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 text-xl font-bold">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : value}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
