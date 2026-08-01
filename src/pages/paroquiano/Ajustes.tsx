import ParoquianoLayout from '@/components/layouts/ParoquianoLayout';
import NotificacoesCard from '@/components/paroquiano/NotificacoesCard';
import InstallPrompt from '@/components/InstallPrompt';
import { Settings } from 'lucide-react';

export default function Ajustes() {
  return (
    <ParoquianoLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Ajustes</h2>
        </div>
        <p className="text-sm text-muted-foreground -mt-3">
          Configure notificações, preferências e instalação do aplicativo.
        </p>
        <NotificacoesCard />
        <InstallPrompt />
      </div>
    </ParoquianoLayout>
  );
}
