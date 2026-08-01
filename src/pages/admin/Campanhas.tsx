import React, { useEffect, useState, useRef } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, ToggleLeft, ToggleRight, Target, Calendar, Upload, X, Image } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Campanha = {
  id: string;
  nome: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string | null;
  meta_financeira: number | null;
  total_arrecadado: number;
  ativo: boolean;
  banner_url: string | null;
};

const AdminCampanhas: React.FC = () => {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Campanha | null>(null);
  const [form, setForm] = useState<Partial<Campanha>>({});
  const [salvando, setSalvando] = useState(false);

  // Upload de banner
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [uploadando, setUploadando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  useEffect(() => { fetchCampanhas(); }, []);

  const fetchCampanhas = async () => {
    setLoading(true);
    const { data } = await supabase.from('campanhas').select('*').order('ativo', { ascending: false }).order('data_inicio', { ascending: false });
    setCampanhas(data || []);
    setLoading(false);
  };

  const abrirModal = (campanha?: Campanha) => {
    setEditando(campanha || null);
    setForm(campanha ? { ...campanha } : { ativo: true, data_inicio: format(new Date(), 'yyyy-MM-dd') });
    setBannerFile(null);
    setBannerPreview(campanha?.banner_url || null);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setBannerFile(null);
    setBannerPreview(null);
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Arquivo inválido', description: 'Selecione uma imagem (JPG, PNG, WEBP).', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'O banner deve ter no máximo 5MB.', variant: 'destructive' });
      return;
    }

    setBannerFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setBannerPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removerBanner = () => {
    setBannerFile(null);
    setBannerPreview(null);
    setForm(f => ({ ...f, banner_url: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadBanner = async (): Promise<string | null> => {
    if (!bannerFile) return form.banner_url || null;

    setUploadando(true);
    const ext = bannerFile.name.split('.').pop();
    const path = `${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('banners-campanhas')
      .upload(path, bannerFile, { upsert: true });

    setUploadando(false);

    if (error) {
      toast({ title: 'Erro ao enviar banner', description: error.message, variant: 'destructive' });
      return null;
    }

    const { data } = supabase.storage.from('banners-campanhas').getPublicUrl(path);
    return data.publicUrl;
  };

  const salvar = async () => {
    if (!form.nome?.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    setSalvando(true);

    const bannerUrl = await uploadBanner();

    const payload = {
      nome: form.nome,
      descricao: form.descricao || null,
      data_inicio: form.data_inicio || format(new Date(), 'yyyy-MM-dd'),
      data_fim: form.data_fim || null,
      meta_financeira: form.meta_financeira ? Number(form.meta_financeira) : null,
      ativo: form.ativo !== false,
      banner_url: bannerUrl,
    };

    let error;
    if (editando) {
      ({ error } = await supabase.from('campanhas').update(payload).eq('id', editando.id));
    } else {
      ({ error } = await supabase.from('campanhas').insert({ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id }));
    }

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editando ? 'Campanha atualizada!' : 'Campanha criada!' });
      fecharModal();
      fetchCampanhas();
    }
    setSalvando(false);
  };

  const toggleAtivo = async (c: Campanha) => {
    await supabase.from('campanhas').update({ ativo: !c.ativo }).eq('id', c.id);
    fetchCampanhas();
  };

  const percentual = (c: Campanha) => {
    if (!c.meta_financeira || c.meta_financeira <= 0) return 0;
    return Math.min(100, Math.round((c.total_arrecadado / c.meta_financeira) * 100));
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Campanhas</h1>
            <p className="text-muted-foreground text-sm">{campanhas.filter(c => c.ativo).length} ativas</p>
          </div>
          <Button onClick={() => abrirModal()} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova Campanha
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : campanhas.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhuma campanha cadastrada.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {campanhas.map(c => (
              <Card key={c.id} className={c.ativo ? '' : 'opacity-60'}>
                {c.banner_url && (
                  <div className="w-full h-36 overflow-hidden rounded-t-lg">
                    <img src={c.banner_url} alt={c.nome} className="w-full h-full object-cover" />
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{c.nome}</CardTitle>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${c.ativo ? 'text-green-600 bg-green-50 border-green-200' : 'text-gray-500 bg-gray-50 border-gray-200'}`}>
                      {c.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  {c.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{c.descricao}</p>}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {format(new Date(c.data_inicio + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                      {c.data_fim && ` → ${format(new Date(c.data_fim + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}`}
                    </span>
                  </div>

                  {c.meta_financeira ? (
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">Arrecadado</span>
                        <span className="font-semibold text-primary">{percentual(c)}%</span>
                      </div>
                      <Progress value={percentual(c)} className="h-2" />
                      <div className="flex justify-between text-xs mt-1.5 text-muted-foreground">
                        <span>{Number(c.total_arrecadado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        <span>Meta: {Number(c.meta_financeira).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Total: <span className="font-semibold text-foreground">
                        {Number(c.total_arrecadado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => abrirModal(c)}>
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleAtivo(c)} title={c.ativo ? 'Desativar' : 'Ativar'}>
                      {c.ativo
                        ? <ToggleRight className="h-5 w-5 text-green-600" />
                        : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={modalAberto} onOpenChange={(open) => !open && fecharModal()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Campanha' : 'Nova Campanha'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome || ''} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={form.descricao || ''} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data Início</Label>
                <Input type="date" value={form.data_inicio || ''} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input type="date" value={form.data_fim || ''} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Meta Financeira (R$)</Label>
              <Input type="number" step="0.01" value={form.meta_financeira || ''} onChange={e => setForm(f => ({ ...f, meta_financeira: Number(e.target.value) }))} placeholder="Deixe vazio para sem meta" />
            </div>

            {/* Upload de Banner */}
            <div>
              <Label>Banner da Campanha</Label>
              <div className="mt-1.5 space-y-3">
                {bannerPreview ? (
                  <div className="relative w-full h-40 rounded-lg overflow-hidden border border-border bg-muted">
                    <img src={bannerPreview} alt="Preview do banner" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={removerBanner}
                      className="absolute top-2 right-2 rounded-full bg-destructive text-destructive-foreground p-1 shadow hover:opacity-90 transition-opacity"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 rounded-lg border-2 border-dashed border-border bg-muted/40 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-muted/70 transition-colors"
                  >
                    <Image className="h-8 w-8 opacity-50" />
                    <span className="text-sm font-medium">Clique para selecionar uma imagem</span>
                    <span className="text-xs opacity-70">JPG, PNG ou WEBP · Máx. 5MB</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleBannerChange}
                />
                {bannerFile && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Upload className="h-3.5 w-3.5" />
                    <span>{bannerFile.name}</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="ml-auto text-primary underline"
                    >
                      Trocar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fecharModal}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando || uploadando}>
              {uploadando ? 'Enviando banner...' : salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminCampanhas;
