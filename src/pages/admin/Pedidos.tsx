import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { registrarAuditoria } from '@/lib/audit';
import { ShoppingBag, Search, CheckCircle, XCircle, Eye, Package } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Pedido {
  id: string;
  codigo_retirada: string;
  nome_cliente: string | null;
  origem: string;
  status: string;
  total: number;
  created_at: string;
  retirado_em: string | null;
}

interface ItemPedido {
  id: string;
  quantidade: number;
  preco_unitario: number;
  produto: { nome: string; imagem_url: string | null } | null;
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente', variant: 'secondary' },
  retirado: { label: 'Retirado', variant: 'default' },
  cancelado: { label: 'Cancelado', variant: 'destructive' },
};

const AdminPedidos: React.FC = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [detalhePedido, setDetalhePedido] = useState<Pedido | null>(null);
  const [itensPedido, setItensPedido] = useState<ItemPedido[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);
  const { toast } = useToast();

  useEffect(() => { fetchPedidos(); }, []);

  const fetchPedidos = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('pedidos').select('*').order('created_at', { ascending: false });
    setPedidos(data || []);
    setLoading(false);
  };

  const verDetalhes = async (pedido: Pedido) => {
    setDetalhePedido(pedido);
    setLoadingItens(true);
    const { data } = await (supabase as any)
      .from('itens_pedido')
      .select('*, produtos(nome, imagem_url)')
      .eq('pedido_id', pedido.id);
    setItensPedido((data || []).map((i: any) => ({ ...i, produto: i.produtos })));
    setLoadingItens(false);
  };

  const marcarRetirado = async (pedido: Pedido) => {
    const { error } = await (supabase as any).from('pedidos').update({ status: 'retirado', retirado_em: new Date().toISOString() }).eq('id', pedido.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: '✅ Pedido marcado como retirado!' });
    await registrarAuditoria({ acao: 'marcar_pedido_retirado', entidade: 'pedidos', entidade_id: pedido.id, detalhes: { codigo: pedido.codigo_retirada } });
    fetchPedidos();
    if (detalhePedido?.id === pedido.id) setDetalhePedido({ ...pedido, status: 'retirado' });
  };

  const cancelarPedido = async (pedido: Pedido) => {
    if (!confirm('Cancelar este pedido? O estoque será devolvido manualmente.')) return;
    const { error } = await (supabase as any).from('pedidos').update({ status: 'cancelado', cancelado_em: new Date().toISOString() }).eq('id', pedido.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Pedido cancelado' });
    await registrarAuditoria({ acao: 'cancelar_pedido', entidade: 'pedidos', entidade_id: pedido.id, detalhes: { codigo: pedido.codigo_retirada } });
    fetchPedidos();
    if (detalhePedido?.id === pedido.id) setDetalhePedido({ ...pedido, status: 'cancelado' });
  };

  const filtrados = pedidos.filter(p =>
    p.codigo_retirada.toLowerCase().includes(busca.toLowerCase()) ||
    (p.nome_cliente || '').toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" /> Pedidos da Loja
          </h1>
          <p className="text-muted-foreground text-sm">Gerencie pedidos e retiradas</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por código ou nome..." value={busca} onChange={e => setBusca(e.target.value)} className="max-w-sm" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : filtrados.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtrados.map(p => {
                      const sb = STATUS_BADGE[p.status] || { label: p.status, variant: 'outline' as const };
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono font-bold text-primary">{p.codigo_retirada}</TableCell>
                          <TableCell>{p.nome_cliente || 'Anônimo'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{p.origem === 'totem' ? 'Totem' : 'Web'}</Badge>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {p.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </TableCell>
                          <TableCell><Badge variant={sb.variant}>{sb.label}</Badge></TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(p.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => verDetalhes(p)} title="Ver detalhes">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {p.status === 'pendente' && (
                                <>
                                  <Button size="icon" variant="ghost" className="text-green-600" onClick={() => marcarRetirado(p)} title="Marcar retirado">
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => cancelarPedido(p)} title="Cancelar">
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal Detalhes */}
      <Dialog open={!!detalhePedido} onOpenChange={() => setDetalhePedido(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Pedido {detalhePedido?.codigo_retirada}
            </DialogTitle>
          </DialogHeader>
          {detalhePedido && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{detalhePedido.nome_cliente || 'Anônimo'}</span></div>
                <div><span className="text-muted-foreground">Origem:</span> <span className="font-medium">{detalhePedido.origem}</span></div>
                <div><span className="text-muted-foreground">Total:</span> <span className="font-bold">{detalhePedido.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant={STATUS_BADGE[detalhePedido.status]?.variant || 'outline'}>{STATUS_BADGE[detalhePedido.status]?.label || detalhePedido.status}</Badge></div>
              </div>

              <div>
                <p className="font-medium mb-2">Itens:</p>
                {loadingItens ? (
                  <p className="text-muted-foreground text-sm">Carregando...</p>
                ) : (
                  <div className="space-y-2">
                    {itensPedido.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                        {item.produto?.imagem_url ? (
                          <img src={item.produto.imagem_url} alt="" className="h-10 w-10 object-cover rounded" />
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.produto?.nome || 'Produto removido'}</p>
                          <p className="text-xs text-muted-foreground">{item.quantidade}x {item.preco_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                        <p className="font-semibold text-sm">{(item.quantidade * item.preco_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {detalhePedido.status === 'pendente' && (
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1 gap-2" onClick={() => marcarRetirado(detalhePedido)}>
                    <CheckCircle className="h-4 w-4" /> Marcar como Retirado
                  </Button>
                  <Button variant="destructive" className="gap-2" onClick={() => cancelarPedido(detalhePedido)}>
                    <XCircle className="h-4 w-4" /> Cancelar
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminPedidos;
