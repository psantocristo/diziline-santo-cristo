import React from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Monitor, Maximize2, Terminal, Chrome, Info } from 'lucide-react';

const AdminKiosk: React.FC = () => {
  const abrirTotem = () => {
    const totemUrl = `${window.location.origin}/totem`;
    const win = window.open(totemUrl, '_blank', 'noopener,noreferrer');
    if (win) {
      win.focus();
      setTimeout(() => {
        try { win.document.documentElement.requestFullscreen(); } catch {}
      }, 1000);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Modo Kiosk</h1>
          <p className="text-muted-foreground text-sm">Configure e abra o totem de contribuição em modo quiosque</p>
        </div>

        {/* Ação principal */}
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="p-8 text-center">
            <Monitor className="h-16 w-16 text-primary mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Abrir Totem de Contribuição</h2>
            <p className="text-muted-foreground text-sm mb-6">
              O totem será aberto em uma nova aba com tentativa de tela cheia. <br />
              Para modo kiosk completo, use as instruções abaixo.
            </p>
            <Button size="lg" onClick={abrirTotem} className="gap-2">
              <Maximize2 className="h-5 w-5" />
              Abrir Totem em Tela Cheia
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              URL: <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">{window.location.origin}/totem</code>
            </p>
          </CardContent>
        </Card>

        {/* Instruções Chrome Kiosk */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Chrome className="h-5 w-5 text-primary" />
              Modo Kiosk no Chrome (Recomendado)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Para um totem real sem barra de endereço, use o Chrome com o flag <code className="bg-muted px-1.5 py-0.5 rounded text-xs">--kiosk</code>:
            </p>
            <div className="bg-muted rounded-lg p-4 font-mono text-xs space-y-2">
              <p className="text-muted-foreground"># Windows</p>
              <p className="text-foreground break-all">
                chrome.exe --kiosk --disable-pinch --overscroll-history-navigation=0 "{window.location.origin}/totem"
              </p>
              <p className="text-muted-foreground mt-3"># macOS</p>
              <p className="text-foreground break-all">
                /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --kiosk "{window.location.origin}/totem"
              </p>
              <p className="text-muted-foreground mt-3"># Linux</p>
              <p className="text-foreground break-all">
                google-chrome --kiosk "{window.location.origin}/totem"
              </p>
            </div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>Para sair do modo kiosk no Chrome: pressione <kbd className="bg-muted border rounded px-1">Alt+F4</kbd> no Windows ou <kbd className="bg-muted border rounded px-1">Cmd+Q</kbd> no macOS.</p>
            </div>
          </CardContent>
        </Card>

        {/* Configurações adicionais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              Dicas para Configuração do Totem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold shrink-0">1.</span>
                Configure a máquina para iniciar automaticamente com o Chrome em modo kiosk na inicialização do Windows via Agendador de Tarefas ou pasta Inicializar.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold shrink-0">2.</span>
                Desative atualizações automáticas do Windows durante o horário de funcionamento para evitar reinicializações inesperadas.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold shrink-0">3.</span>
                Use uma conta de usuário limitada (sem acesso admin) no computador do totem para maior segurança.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold shrink-0">4.</span>
                O totem possui temporizador de inatividade de 60 segundos que retorna automaticamente à tela inicial.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold shrink-0">5.</span>
                Recomendamos uma tela touchscreen de 15" a 22" na orientação retrato (portrait) para melhor experiência.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminKiosk;
