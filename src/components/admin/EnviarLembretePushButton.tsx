import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Bell, Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Modo = 'pendentes_mes' | 'todos';

export default function EnviarLembretePushButton({ variant = 'outline' }: { variant?: 'outline' | 'default' | 'secondary' }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [modo, setModo] = useState<Modo>('pendentes_mes');
  const [titulo, setTitulo] = useState('💝 Lembrete do seu dízimo');
  const [mensagem, setMensagem] = useState('Que tal dedicar um momento e fazer sua contribuição hoje? Toque aqui para abrir.');
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke('enviar-lembrete-pagamento', {
        body: { modo, titulo, mensagem },
      });
      if (error) throw error;
      const r = data as any;
      toast({
        title: 'Lembrete disparado',
        description: `${r.enviados} envios para ${r.alvos} dizimistas. ${r.sem_dispositivo} sem app instalado.`,
      });
      setOpen(false);
    } catch (e: any) {
      toast({ title: 'Falha ao enviar', description: e.message, variant: 'destructive' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm">
          <Bell className="h-4 w-4 mr-2" />
          Lembrete de pagamento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar lembrete por notificação push</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Para quem enviar</Label>
            <RadioGroup value={modo} onValueChange={(v) => setModo(v as Modo)}>
              <div className="flex items-start gap-2 rounded-md border p-3">
                <RadioGroupItem value="pendentes_mes" id="r1" className="mt-1" />
                <label htmlFor="r1" className="text-sm flex-1 cursor-pointer">
                  <span className="font-medium">Apenas dizimistas com pagamento pendente este mês</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">Recomendado — não incomoda quem já contribuiu.</span>
                </label>
              </div>
              <div className="flex items-start gap-2 rounded-md border p-3">
                <RadioGroupItem value="todos" id="r2" className="mt-1" />
                <label htmlFor="r2" className="text-sm flex-1 cursor-pointer">
                  <span className="font-medium">Todos os dizimistas com app instalado</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">Inclusive os que já pagaram este mês.</span>
                </label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-1">
            <Label htmlFor="t">Título</Label>
            <Input id="t" maxLength={80} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="m">Mensagem</Label>
            <Textarea id="m" maxLength={200} rows={3} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">{mensagem.length}/200</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={enviando}>Cancelar</Button>
          <Button onClick={enviar} disabled={enviando || !titulo || !mensagem}>
            {enviando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
