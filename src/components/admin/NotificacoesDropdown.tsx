import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  created_at: string;
  dados: Record<string, any>;
}

const TIPO_ROUTES: Record<string, string> = {
  novo_dizimista: '/admin/dizimistas',
  novo_pagamento: '/admin/pagamentos',
};

const NotificacoesDropdown: React.FC = () => {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const channelRef = useRef<any>(null);

  // Initial fetch only once
  const fetchNotificacoes = async () => {
    const { data } = await (supabase as any)
      .from('notificacoes_admin')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) setNotificacoes(data);
  };

  useEffect(() => {
    fetchNotificacoes();

    // Subscribe to realtime INSERTs instead of polling
    const channel = supabase
      .channel('notificacoes-admin-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes_admin',
        },
        (payload) => {
          const nova = payload.new as Notificacao;
          setNotificacoes(prev => [nova, ...prev].slice(0, 30));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const naoLidas = notificacoes.filter(n => !n.lida).length;

  const marcarComoLida = async (id: string) => {
    await (supabase as any)
      .from('notificacoes_admin')
      .update({ lida: true })
      .eq('id', id);
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
  };

  const marcarTodasComoLidas = async () => {
    const ids = notificacoes.filter(n => !n.lida).map(n => n.id);
    if (ids.length === 0) return;
    await (supabase as any)
      .from('notificacoes_admin')
      .update({ lida: true })
      .in('id', ids);
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
  };

  const excluirNotificacao = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await (supabase as any)
      .from('notificacoes_admin')
      .delete()
      .eq('id', id);
    setNotificacoes(prev => prev.filter(n => n.id !== id));
  };

  const excluirTodas = async () => {
    const ids = notificacoes.map(n => n.id);
    if (ids.length === 0) return;
    await (supabase as any)
      .from('notificacoes_admin')
      .delete()
      .in('id', ids);
    setNotificacoes([]);
  };

  const handleClick = async (n: Notificacao) => {
    await marcarComoLida(n.id);
    setOpen(false);

    const route = TIPO_ROUTES[n.tipo];
    if (route) {
      navigate(route);
    }
  };

  const tipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'novo_pagamento':
        return <span className="text-[9px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full leading-none">Pagamento</span>;
      case 'novo_dizimista':
        return <span className="text-[9px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full leading-none">Dizimista</span>;
      default:
        return null;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-white/10 transition-colors" style={{ color: 'rgba(255,255,255,0.9)' }}>
          <Bell className="h-5 w-5" />
          {naoLidas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-4.5 w-4.5 min-w-[18px] px-1 flex items-center justify-center leading-none">
              {naoLidas > 9 ? '9+' : naoLidas}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold text-sm">Notificações</h4>
          <div className="flex items-center gap-1">
            {naoLidas > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={marcarTodasComoLidas}>
                Marcar lidas
              </Button>
            )}
            {notificacoes.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive hover:text-destructive" onClick={excluirTodas}>
                <Trash2 className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-80">
          {notificacoes.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              Nenhuma notificação
            </div>
          ) : (
            notificacoes.map(n => (
              <div
                key={n.id}
                className={`px-4 py-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors group ${!n.lida ? 'bg-primary/5' : ''}`}
                onClick={() => handleClick(n)}
              >
                <div className="flex items-start gap-2">
                  {!n.lida && <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {tipoBadge(n.tipo)}
                    </div>
                    <p className={`text-sm leading-tight ${!n.lida ? 'font-semibold' : 'font-medium text-muted-foreground'}`}>
                      {n.titulo}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.mensagem}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => excluirNotificacao(e, n.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
                    title="Excluir"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificacoesDropdown;
