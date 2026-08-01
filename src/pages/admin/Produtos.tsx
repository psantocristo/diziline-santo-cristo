import React, { useEffect, useState, useRef } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { registrarAuditoria } from '@/lib/audit';
import { Plus, Pencil, Trash2, Package, Upload, Image as ImageIcon, Search } from 'lucide-react';

interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  estoque: number;
  slug: string;
  imagem_url: string | null;
  ativo: boolean;
  created_at: string;
}

const AdminProdutos: React.FC = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Produto | null>(null);
  const [form, setForm] = useState({ nome: '', descricao: '', preco: '', estoque: '0' });
  const [salvando, setSalvando] = useState(false);
  const [uploadando, setUploadando] = useState(false);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [imagemFile, setImagemFile] = useState<File | null>(null);
  const [busca, setBusca] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => { fetchProdutos(); }, []);

  const fetchProdutos = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('produtos').select('*').order('created_at', { ascending: false });
    setProdutos(data || []);
    setLoading(false);
  };

  const abrirModal = (p?: Produto) => {
    setEditando(p || null);
    setForm(p ? { nome: p.nome, descricao: p.descricao || '', preco: String(p.preco), estoque: String(p.estoque) } : { nome: '', descricao: '', preco: '', estoque: '0' });
    setImagemPreview(p?.imagem_url || null);
    setImagemFile(null);
    setModal(true);
  };

  const handleImagem = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Imagem muito grande', description: 'Máximo 5MB', variant: 'destructive' });
      return;
    }
    setImagemFile(file);
    setImagemPreview(URL.createObjectURL(file));
  };

  const uploadImagem = async (produtoId: string): Promise<string | null> => {
    if (!imagemFile) return editando?.imagem_url || null;
    setUploadando(true);
    const ext = imagemFile.name.split('.').pop();
    const path = `${produtoId}.${ext}`;
    const { error } = await supabase.storage.from('produtos').upload(path, imagemFile, { upsert: true });
    setUploadando(false);
    if (error) {
      toast({ title: 'Erro no upload', description: error.message, variant: 'destructive' });
      return editando?.imagem_url || null;
    }
    const { data: urlData } = supabase.storage.from('produtos').getPublicUrl(path);
    return urlData.publicUrl + '?t=' + Date.now();
  };

  const salvar = async () => {
    if (!form.nome.trim() || !form.preco) {
      toast({ title: 'Nome e preço são obrigatórios', variant: 'destructive' });
      return;
    }
    const preco = parseFloat(form.preco.replace(',', '.'));
    if (isNaN(preco) || preco <= 0) {
      toast({ title: 'Preço inválido', variant: 'destructive' });
      return;
    }
    const estoque = parseInt(form.estoque) || 0;
    setSalvando(true);

    try {
      if (editando) {
        const imagem_url = await uploadImagem(editando.id);
        const { error } = await (supabase as any).from('produtos').update({
          nome: form.nome.trim(),
          descricao: form.descricao.trim() || null,
          preco,
          estoque,
          imagem_url,
        }).eq('id', editando.id);
        if (error) throw error;
        toast({ title: '✅ Produto atualizado!' });
        await registrarAuditoria({ acao: 'editar_produto', entidade: 'produtos', entidade_id: editando.id, detalhes: { nome: form.nome } });
      } else {
        // Insert primeiro para ter o ID, depois upload
        const { data: novoProduto, error } = await (supabase as any).from('produtos').insert({
          nome: form.nome.trim(),
          descricao: form.descricao.trim() || null,
          preco,
          estoque,
          slug: 'temp', // trigger vai gerar
        }).select().single();
        if (error) throw error;

        if (imagemFile && novoProduto) {
          const imagem_url = await uploadImagem(novoProduto.id);
          await (supabase as any).from('produtos').update({ imagem_url }).eq('id', novoProduto.id);
        }
        toast({ title: '✅ Produto criado!' });
        await registrarAuditoria({ acao: 'criar_produto', entidade: 'produtos', detalhes: { nome: form.nome } });
      }
      setModal(false);
      fetchProdutos();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    }
    setSalvando(false);
  };

  const toggleAtivo = async (p: Produto) => {
    await (supabase as any).from('produtos').update({ ativo: !p.ativo }).eq('id', p.id);
    fetchProdutos();
  };

  const excluir = async (p: Produto) => {
    if (!confirm(`Excluir "${p.nome}"?`)) return;
    await (supabase as any).from('produtos').delete().eq('id', p.id);
    await registrarAuditoria({ acao: 'excluir_produto', entidade: 'produtos', entidade_id: p.id, detalhes: { nome: p.nome } });
    toast({ title: 'Produto excluído' });
    fetchProdutos();
  };

  const filtrados = produtos.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" /> Produtos
            </h1>
            <p className="text-muted-foreground text-sm">Gerencie os produtos da loja paroquial</p>
          </div>
          <Button onClick={() => abrirModal()} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Produto
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} className="max-w-sm" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : filtrados.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Nenhum produto encontrado</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Imagem</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Estoque</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtrados.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>
                          {p.imagem_url ? (
                            <img src={p.imagem_url} alt={p.nome} className="h-12 w-12 object-cover rounded-lg" />
                          ) : (
                            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{p.nome}</p>
                          {p.descricao && <p className="text-xs text-muted-foreground line-clamp-1">{p.descricao}</p>}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {p.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.estoque > 0 ? 'default' : 'destructive'}>
                            {p.estoque} un.
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch checked={p.ativo} onCheckedChange={() => toggleAtivo(p)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => abrirModal(p)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => excluir(p)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal Produto */}
      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Terço de Madeira" />
            </div>
            <div>
              <Label>Descrição</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Descrição do produto..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Preço (R$) *</Label>
                <Input value={form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))} placeholder="25,00" />
              </div>
              <div>
                <Label>Estoque</Label>
                <Input type="number" min="0" value={form.estoque} onChange={e => setForm(f => ({ ...f, estoque: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Imagem</Label>
              <div className="flex items-center gap-4 mt-1">
                {imagemPreview ? (
                  <img src={imagemPreview} alt="Preview" className="h-20 w-20 object-cover rounded-lg border" />
                ) : (
                  <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center border">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-2">
                  <Upload className="h-4 w-4" /> {imagemPreview ? 'Trocar' : 'Upload'}
                </Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagem} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando || uploadando}>
              {salvando || uploadando ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminProdutos;
