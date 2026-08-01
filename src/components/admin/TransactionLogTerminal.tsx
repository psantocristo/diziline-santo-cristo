import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Terminal, Trash2, ArrowDown, Filter, RefreshCw, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getRedeErrorInfo, type RedeErrorInfo } from '@/lib/rede-error-codes';

interface LogEntry {
  id: string;
  created_at: string;
  tipo: 'info' | 'success' | 'warning' | 'error';
  origem: string;
  mensagem: string;
  detalhes?: string | null;
  return_code?: string | null;
}

const TransactionLogTerminal: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState<string>('todos');
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('logs_terminal')
      .select('id, created_at, tipo, origem, mensagem, detalhes, return_code')
      .order('created_at', { ascending: false })
      .limit(200);

    if (!error && data) {
      setLogs(data.reverse() as LogEntry[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = filtro === 'todos'
    ? logs
    : filtro === 'erros'
      ? logs.filter(l => l.tipo === 'error' || l.tipo === 'warning')
      : logs.filter(l => l.origem === filtro);

  const tipoColor = (tipo: LogEntry['tipo']) => {
    switch (tipo) {
      case 'success': return 'text-emerald-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-amber-400';
      default: return 'text-blue-400';
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            Terminal de Transações
            <Badge variant="outline" className="text-xs font-normal">
              persistido
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filtro} onValueChange={setFiltro}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="erros">Erros / Avisos</SelectItem>
                <SelectItem value="web">Web</SelectItem>
                <SelectItem value="totem">Totem</SelectItem>
                <SelectItem value="maquininha">Maquininha</SelectItem>
                <SelectItem value="webhook">Webhooks</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={fetchLogs}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Atualizar
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setAutoScroll(!autoScroll)}
              title={autoScroll ? 'Auto-scroll ativo' : 'Auto-scroll desativado'}
            >
              <ArrowDown className={`h-3.5 w-3.5 ${autoScroll ? 'text-primary' : 'text-muted-foreground'}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={terminalRef}
          className="bg-zinc-950 text-zinc-300 font-mono text-xs rounded-b-lg overflow-y-auto p-4 space-y-1"
          style={{ height: '360px', maxHeight: '360px' }}
        >
          {filteredLogs.length === 0 ? (
            <div className="text-zinc-600 text-center py-12">
              {loading ? 'Carregando logs...' : 'Nenhum log de transação encontrado.'}
            </div>
          ) : (
            filteredLogs.map(log => {
              const errorInfo = log.return_code ? getRedeErrorInfo(log.return_code) : undefined;
              return (
                <div key={log.id} className="flex gap-2 leading-relaxed hover:bg-zinc-900/50 px-1 rounded">
                  <span className="text-zinc-600 shrink-0 select-none">
                    {format(new Date(log.created_at), 'HH:mm:ss', { locale: ptBR })}
                  </span>
                  <span className={`shrink-0 w-[70px] text-right ${tipoColor(log.tipo)}`}>
                    [{log.origem.slice(0, 8)}]
                  </span>
                  <span className="flex-1">
                    <span className={tipoColor(log.tipo)}>{log.mensagem}</span>
                    {log.return_code && (
                      <span className="text-zinc-500 ml-2">RC:{log.return_code}</span>
                    )}
                    {log.detalhes && (
                      <span className="text-zinc-600 block ml-0">{log.detalhes}</span>
                    )}
                    {errorInfo && errorInfo.acao !== 'aprovado' && (
                      <span className="text-amber-600 block ml-0">
                        💡 {errorInfo.detalhe}
                      </span>
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TransactionLogTerminal;
