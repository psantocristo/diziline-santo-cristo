import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Cake, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nome: string;
  paroquia?: string;
}

const STORAGE_KEY = 'birthday-modal-shown';

export function useBirthdayModalState(isAniversario: boolean) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!isAniversario) return;
    const today = new Date().toISOString().slice(0, 10);
    const last = localStorage.getItem(STORAGE_KEY);
    if (last !== today) {
      setOpen(true);
      localStorage.setItem(STORAGE_KEY, today);
    }
  }, [isAniversario]);
  return [open, setOpen] as const;
}

export default function BirthdayModal({ open, onOpenChange, nome, paroquia }: Props) {
  const primeiro = nome.split(' ')[0] || 'Paroquiano(a)';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md text-center border-primary/30 bg-gradient-to-b from-primary/5 via-background to-accent/20">
        <div className="space-y-3 py-2">
          <div className="relative inline-flex">
            <Cake className="h-16 w-16 text-primary mx-auto" />
            <Sparkles className="h-6 w-6 text-yellow-500 absolute -top-1 -right-2 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            🎉 Feliz Aniversário, {primeiro}! 🎂
          </h2>
          <p className="text-sm text-foreground/80 italic leading-relaxed px-2">
            "O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto
            sobre ti e tenha misericórdia de ti." — Números 6,24-25
          </p>
          <p className="text-sm text-foreground/70 leading-relaxed">
            Que Deus continue derramando bênçãos sobre sua vida — saúde, paz,
            alegria e muito amor. Agradecemos por sua dedicação e fé.
            Você é parte muito especial da nossa família.
          </p>
          <p className="text-xs text-muted-foreground italic">
            — Com carinho, {paroquia || 'sua Paróquia'} 🙏
          </p>
          <Button onClick={() => onOpenChange(false)} className="w-full mt-2">
            Muito obrigado(a)!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
