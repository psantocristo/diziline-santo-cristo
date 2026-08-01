import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Shield, Search, RefreshCw, HandHeart } from 'lucide-react';

type LogAuditoria = {
  id: string;
  created_at: string;
  user_id: string | null;
  acao: string;
  entidade: string | null;
  entidade_id: string | null;
  detalhes: any;
  ip: string | null;
};

type UserInfo = {
  nome_completo: string;
  isServo: boolean;
};

const AdminAuditoria: React.FC = () => {
  const [logs, setLogs] = useState<LogAuditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroAcao, setFiltroAcao] = useState('todos');
  const [userInfoMap, setUserInfoMap] = useState<Record<string, UserInfo>>({});

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('logs_auditoria')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    const logsData = data || [];
    setLogs(logsData);

    // Buscar profiles e servos para enriquecer a coluna Usuário
    const uniqueUserIds = [...new Set(logsData.map(l => l.user_id).filter(Boolean))] as string[];
    if (uniqueUserIds.length > 0) {
      const [profilesRes, servosRes] = await Promise.all([
        supabase.from('profiles').select('id, nome_completo').in('id', uniqueUserIds),
        (supabase as any).from('servos').select('user_id, nome').in('user_id', uniqueUserIds),
      ]);

      const servosSet = new Set((servosRes.data || []).map((s: any) => s.user_id));
      const map: Record<string, UserInfo> = {};
      (profilesRes.data || []).forEach((p: any) => {
        map[p.id] = { nome_completo: p.nome_completo, isServo: servosSet.has(p.id) };
      });
      // Fallback: servos que podem não ter profile ainda
      (servosRes.data || []).forEach((s: any) => {
        if (!map[s.user_id]) {
          map[s.user_id] = { nome_completo: s.nome, isServo: true };
        }
      });
      setUserInfoMap(map);
    }
    setLoading(false);
  };

  const acoes = [...new Set(logs.map(l => l.acao))].sort();

  const filtrados = logs.filter(l => {
    if (filtroAcao !== 'todos' && l.acao !== filtroAcao) return false;
    if (busca) {
      const b = busca.toLowerCase();
      const userInfo = l.user_id ? userInfoMap[l.user_id] : null;
      return (
        l.acao.toLowerCase().includes(b) ||
        l.entidade?.toLowerCase().includes(b) ||
        l.user_id?.includes(b) ||
        userInfo?.nome_completo.toLowerCase().includes(b) ||
        JSON.stringify(l.detalhes)?.toLowerCase().includes(b)
      );
    }
    return true;
  });

  const renderUsuario = (userId: string | null) => {
    if (!userId) return <span className="text-muted-foreground text-xs italic">sistema</span>;
    const info = userInfoMap[userId];
    if (!info) return <span className="text-xs font-mono text-muted-foreground">{userId.slice(0, 8)}...</span>;
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-sm font-medium text-foreground">{info.nome_completo}</span>
        {info.isServo && (
          <span className="inline-flex items-center gap-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap">
            <HandHeart className="h-2.5 w-2.5" />
            Servo
          </span>
        )}
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Auditoria
            </h1>
            <p className="text-muted-foreground text-sm">{filtrados.length} registros · acesso restrito a super_admin</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por ação, entidade, usuário..." className="pl-9" value={busca} onChange={e => setBusca(e.target.value)} />
              </div>
              <Select value={filtroAcao} onValueChange={setFiltroAcao}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Tipo de ação" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as ações</SelectItem>
                  {acoes.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : filtrados.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Nenhum log de auditoria encontrado.</p>
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-border">
                  {filtrados.map(l => (
                    <div key={l.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {renderUsuario(l.user_id)}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(l.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                          </p>
                        </div>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium shrink-0">
                          {l.acao}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                        {l.entidade && <span>{l.entidade}</span>}
                        {l.ip && <span className="font-mono">· {l.ip}</span>}
                      </div>
                      {l.detalhes && (
                        <code className="text-xs text-muted-foreground block truncate">
                          {JSON.stringify(l.detalhes).slice(0, 100)}
                        </code>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Entidade</TableHead>
                        <TableHead>Detalhes</TableHead>
                        <TableHead>IP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtrados.map(l => (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(l.created_at), 'dd/MM/yy HH:mm:ss', { locale: ptBR })}
                          </TableCell>
                          <TableCell>{renderUsuario(l.user_id)}</TableCell>
                          <TableCell>
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                              {l.acao}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{l.entidade || '-'}</TableCell>
                          <TableCell className="max-w-xs">
                            {l.detalhes ? (
                              <code className="text-xs text-muted-foreground truncate block max-w-[200px]">
                                {JSON.stringify(l.detalhes).slice(0, 80)}{JSON.stringify(l.detalhes).length > 80 ? '...' : ''}
                              </code>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">{l.ip || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminAuditoria;
