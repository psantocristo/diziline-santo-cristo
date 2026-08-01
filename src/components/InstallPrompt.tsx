import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Smartphone, Share, X } from 'lucide-react';
import { isIOS, isStandalone } from '@/lib/pwa';

const DISMISS_KEY = 'diziline.install.dismissed';

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [iosTip, setIosTip] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const onPrompt = (e: any) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS doesn't fire beforeinstallprompt
    if (isIOS()) {
      const t = setTimeout(() => setShow(true), 3000);
      setIosTip(true);
      return () => {
        clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', onPrompt);
      };
    }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShow(false);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm animate-in slide-in-from-bottom-5">
      <Card className="border-primary/30 shadow-xl">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 rounded-lg p-2 shrink-0">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Instale o Diziline</p>
              {iosTip ? (
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Toque em <Share className="inline h-3 w-3 mx-0.5" />
                  <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong> para usar como app e receber notificações.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  Receba lembretes do dízimo e do seu aniversário diretamente no celular.
                </p>
              )}
              {!iosTip && (
                <Button onClick={install} size="sm" className="mt-2 h-8 text-xs">
                  <Download className="h-3.5 w-3.5 mr-1" /> Instalar
                </Button>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={dismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
