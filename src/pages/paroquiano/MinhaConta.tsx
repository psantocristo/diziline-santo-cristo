import React, { useEffect, useRef, useState } from 'react';
import ParoquianoLayout from '@/components/layouts/ParoquianoLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Camera, Loader2, IdCard, Save, User as UserIcon } from 'lucide-react';
import { z } from 'zod';

const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const formatCEP = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
};

const formSchema = z.object({
  nome_completo: z.string().trim().min(3, 'Nome muito curto').max(120),
  telefone: z.string().min(14, 'WhatsApp inválido').max(16),
  endereco: z.string().trim().max(200).optional().or(z.literal('')),
  cidade: z.string().trim().max(80).optional().or(z.literal('')),
  estado: z.string().trim().max(2).optional().or(z.literal('')),
  cep: z.string().max(9).optional().or(z.literal('')),
  observacoes: z.string().max(500).optional().or(z.literal('')),
});

export default function MinhaConta() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [paroquianoId, setParoquianoId] = useState<string | null>(null);
  const [matricula, setMatricula] = useState<string>('');
  const [cpf, setCpf] = useState<string>('');
  const [dataNascimento, setDataNascimento] = useState<string>('');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoSignedUrl, setFotoSignedUrl] = useState<string | null>(null);

  const [form, setForm] = useState({
    nome_completo: '',
    telefone: '',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    observacoes: '',
  });

  const carregar = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from('paroquianos')
      .select('id, nome_completo, cpf, telefone, email, endereco, cidade, estado, cep, matricula_paroquial, data_nascimento, data_inicio_dizimista, observacoes, foto_url')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setParoquianoId(data.id);
      setMatricula(data.matricula_paroquial || '');
      setCpf(data.cpf || '');
      setDataNascimento(data.data_nascimento || '');
      setDataInicio(data.data_inicio_dizimista || '');
      setFotoUrl(data.foto_url || null);
      setForm({
        nome_completo: data.nome_completo || '',
        telefone: data.telefone ? formatPhone(data.telefone) : '',
        endereco: data.endereco || '',
        cidade: data.cidade || '',
        estado: data.estado || '',
        cep: data.cep ? formatCEP(data.cep) : '',
        observacoes: data.observacoes || '',
      });
      if (data.foto_url) {
        const { data: signed } = await supabase.storage
          .from('avatares-paroquianos')
          .createSignedUrl(data.foto_url, 3600);
        if (signed?.signedUrl) setFotoSignedUrl(signed.signedUrl);
      }
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [user]);

  const handleUpload = async (file: File) => {
    if (!user || !paroquianoId) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Imagem grande demais', description: 'Limite de 5 MB.', variant: 'destructive' });
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Arquivo inválido', description: 'Envie uma imagem (JPG/PNG).', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatares-paroquianos')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      // delete previous
      if (fotoUrl && fotoUrl !== path) {
        await supabase.storage.from('avatares-paroquianos').remove([fotoUrl]);
      }
      await (supabase as any).from('paroquianos').update({ foto_url: path }).eq('id', paroquianoId);
      setFotoUrl(path);
      const { data: signed } = await supabase.storage
        .from('avatares-paroquianos').createSignedUrl(path, 3600);
      if (signed?.signedUrl) setFotoSignedUrl(signed.signedUrl);
      toast({ title: 'Foto atualizada!' });
    } catch (e: any) {
      toast({ title: 'Erro no envio', description: e.message, variant: 'destructive' });
    }
    setUploading(false);
  };

  const salvar = async () => {
    if (!paroquianoId) return;
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      toast({ title: 'Verifique os campos', description: first, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nome_completo: parsed.data.nome_completo,
        telefone: parsed.data.telefone.replace(/\D/g, ''),
        endereco: parsed.data.endereco || null,
        cidade: parsed.data.cidade || null,
        estado: (parsed.data.estado || '').toUpperCase() || null,
        cep: (parsed.data.cep || '').replace(/\D/g, '') || null,
        observacoes: parsed.data.observacoes || null,
      };
      const { error } = await (supabase as any)
        .from('paroquianos').update(payload).eq('id', paroquianoId);
      if (error) throw error;
      // Sync profile name
      await (supabase as any).from('profiles')
        .update({ nome_completo: payload.nome_completo }).eq('id', user!.id);
      toast({ title: 'Dados atualizados com sucesso!' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <ParoquianoLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ParoquianoLayout>
    );
  }

  const iniciais = form.nome_completo
    .split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'DZ';

  return (
    <ParoquianoLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-2">
          <UserIcon className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Minha Conta</h2>
        </div>

        {/* Foto + Identificação */}
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary/20 to-secondary/30 border-2 border-primary/30 flex items-center justify-center overflow-hidden">
                  {fotoSignedUrl ? (
                    <img src={fotoSignedUrl} alt="Foto" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-primary">{iniciais}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 disabled:opacity-60"
                  aria-label="Trocar foto"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold text-foreground truncate">{form.nome_completo || '—'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                {matricula && (
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full text-xs font-semibold">
                    <IdCard className="h-3.5 w-3.5" />
                    {matricula}
                  </div>
                )}
              </div>
            </div>
            {dataInicio && (
              <p className="text-xs text-muted-foreground mt-3">
                Dizimista desde {new Date(dataInicio + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Dados pessoais */}
        <Card className="border-border/60">
          <CardHeader className="pb-3"><CardTitle className="text-base">Dados pessoais</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome completo</Label>
              <Input id="nome" value={form.nome_completo}
                onChange={(e) => setForm(f => ({ ...f, nome_completo: e.target.value }))} maxLength={120} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" value={cpf} disabled className="bg-muted/50 cursor-not-allowed" />
                <p className="text-[10px] text-muted-foreground mt-1">CPF não pode ser alterado</p>
              </div>
              <div>
                <Label htmlFor="nasc">Data de nascimento</Label>
                <Input id="nasc" value={dataNascimento ? new Date(dataNascimento + 'T00:00:00').toLocaleDateString('pt-BR') : ''} disabled className="bg-muted/50 cursor-not-allowed" />
              </div>
            </div>
            <div>
              <Label htmlFor="tel">WhatsApp</Label>
              <Input
                id="tel"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="(11) 99999-9999"
                value={form.telefone}
                onChange={(e) => setForm(f => ({ ...f, telefone: formatPhone(e.target.value) }))}
                maxLength={16}
              />
            </div>
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card className="border-border/60">
          <CardHeader className="pb-3"><CardTitle className="text-base">Endereço</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="end">Endereço</Label>
              <Input id="end" value={form.endereco}
                onChange={(e) => setForm(f => ({ ...f, endereco: e.target.value }))} maxLength={200} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cid">Cidade</Label>
                <Input id="cid" value={form.cidade}
                  onChange={(e) => setForm(f => ({ ...f, cidade: e.target.value }))} maxLength={80} />
              </div>
              <div>
                <Label htmlFor="uf">UF</Label>
                <Input id="uf" value={form.estado} maxLength={2}
                  onChange={(e) => setForm(f => ({ ...f, estado: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') }))} />
              </div>
            </div>
            <div>
              <Label htmlFor="cep">CEP</Label>
              <Input id="cep" inputMode="numeric" pattern="[0-9]*" placeholder="00000-000"
                value={form.cep} maxLength={9}
                onChange={(e) => setForm(f => ({ ...f, cep: formatCEP(e.target.value) }))} />
            </div>
          </CardContent>
        </Card>

        {/* Observações */}
        <Card className="border-border/60">
          <CardHeader className="pb-3"><CardTitle className="text-base">Observações</CardTitle></CardHeader>
          <CardContent>
            <Textarea
              value={form.observacoes}
              onChange={(e) => setForm(f => ({ ...f, observacoes: e.target.value }))}
              maxLength={500} rows={3}
              placeholder="Anotações pessoais (opcional)"
            />
          </CardContent>
        </Card>

        <Button onClick={salvar} disabled={saving} className="w-full h-12">
          {saving ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Save className="h-5 w-5 mr-2" />}
          Salvar alterações
        </Button>
      </div>
    </ParoquianoLayout>
  );
}
