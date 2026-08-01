import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTheme } from '@/contexts/ThemeContext';
import { gerarCertificadoPDF } from '@/lib/certificados/gerar-certificado';
import { TIPOS_CERTIFICADO, type TipoCertificado, type TamanhoCertificado, type DadosCertificado } from '@/lib/certificados/types';
import { FileDown, Eye, Award, Droplets, BookOpen, Flame, Heart, GraduationCap, ScrollText, History, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const TIPO_ICONS: Record<TipoCertificado, React.ReactNode> = {
  batismo: <Droplets className="h-5 w-5" />,
  primeira_eucaristia: <BookOpen className="h-5 w-5" />,
  crisma: <Flame className="h-5 w-5" />,
  casamento: <Heart className="h-5 w-5" />,
  curso_batismo: <GraduationCap className="h-5 w-5" />,
  curso_noivos: <ScrollText className="h-5 w-5" />,
};

const TIPO_COLORS: Record<TipoCertificado, string> = {
  batismo: 'text-blue-600 bg-blue-50 border-blue-200',
  primeira_eucaristia: 'text-purple-600 bg-purple-50 border-purple-200',
  crisma: 'text-amber-600 bg-amber-50 border-amber-200',
  casamento: 'text-red-600 bg-red-50 border-red-200',
  curso_batismo: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  curso_noivos: 'text-orange-600 bg-orange-50 border-orange-200',
};

const TIPO_BADGE: Record<string, string> = {
  batismo: 'bg-blue-100 text-blue-700',
  primeira_eucaristia: 'bg-purple-100 text-purple-700',
  crisma: 'bg-amber-100 text-amber-700',
  casamento: 'bg-red-100 text-red-700',
  curso_batismo: 'bg-emerald-100 text-emerald-700',
  curso_noivos: 'bg-orange-100 text-orange-700',
};

const STORAGE_KEY = 'certificados_form_state';

const TEXTOS_PADRAO: Record<TipoCertificado, string> = {
  batismo: `No dia [Data da Cerimônia], nesta Paróquia Senhor Santo Cristo, no município de São Paulo/SP, foi batizado(a) solenemente por [Nome do Celebrante]:\n\n[Nome Completo]\n\nNascido(a) no dia [Data de Nascimento], em São Paulo/SP, filho(a) de [Nome do Pai] e de [Nome da Mãe]. Foram padrinhos: [Nome do Padrinho] e [Nome da Madrinha].\n\nPor ser verdade, assino a presente lembrança.`,
  primeira_eucaristia: `No dia [Data da Cerimônia], nesta Paróquia Senhor Santo Cristo, no município de São Paulo/SP, recebeu pela primeira vez o Santíssimo Sacramento da Eucaristia:\n\n[Nome Completo]\n\nNascido(a) no dia [Data de Nascimento], em São Paulo/SP, filho(a) de [Nome do Pai] e de [Nome da Mãe]. Catequista: [Nome do Catequista].\n\nPor ser verdade, assino a presente lembrança.`,
  crisma: `No dia [Data da Cerimônia], nesta Paróquia Senhor Santo Cristo, no município de São Paulo/SP, pela imposição das mãos do Sr. [Nome do Celebrante], recebeu solenemente o SACRAMENTO DA CRISMA:\n\n[Nome Completo]\n\nNascido(a) no dia [Data de Nascimento], em São Paulo/SP, filho(a) de [Nome do Pai] e de [Nome da Mãe]. Foi padrinho [Nome do Padrinho]. Catequista: [Nome do Catequista].\n\nPor ser verdade, assino a presente lembrança.`,
  casamento: `No dia [Data da Cerimônia], nesta Paróquia Senhor Santo Cristo, no município de São Paulo/SP, em celebração presidida por [Nome do Celebrante], uniram-se pelo Sacramento do Matrimônio:\n\n[Nome do Noivo] e [Nome da Noiva]\n\nPerante a Igreja e as testemunhas [Nome da Testemunha 1] e [Nome da Testemunha 2].\n\nPor ser verdade, assino a presente lembrança.`,
  curso_batismo: `Certificamos que [Nome Completo] participou do Encontro de Preparação para o Sacramento do Batismo, realizado no dia [Data], nesta Paróquia Senhor Santo Cristo, abordando a responsabilidade da vida cristã e a doutrina da Igreja.\n\nPor ser verdade, assino o presente certificado.`,
  curso_noivos: `Certificamos que os nubentes [Nome do Noivo] e [Nome da Noiva] participaram regularmente do Encontro de Preparação para a Vida Matrimonial, realizado nos dias [Datas], nesta Paróquia Senhor Santo Cristo, cumprindo os requisitos exigidos pelo Direito Canônico para a celebração do Matrimônio.\n\nPor ser verdade, assino o presente certificado.`,
};

function loadPersistedState() {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

function persistState(state: any) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export default function Certificados() {
  const { tema } = useTheme();
  const queryClient = useQueryClient();
  const persisted = loadPersistedState();

  const [activeTab, setActiveTab] = useState(persisted?.activeTab || 'emitir');
  const [tipo, setTipo] = useState<TipoCertificado>(persisted?.tipo || 'batismo');
  const [tamanho, setTamanho] = useState<TamanhoCertificado>(persisted?.tamanho || 'A4');
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const saved = persisted?.formData || {};
    if (!saved.textoPersonalizado) {
      saved.textoPersonalizado = TEXTOS_PADRAO[(persisted?.tipo || 'batismo') as TipoCertificado];
    }
    return saved;
  });

  // Persist state on every change
  useEffect(() => {
    persistState({ activeTab, tipo, tamanho, formData });
  }, [activeTab, tipo, tamanho, formData]);

  const set = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

  const CERT_POR_PAGINA = 20;
  const [certLimit, setCertLimit] = useState(CERT_POR_PAGINA);

  // History query
  const { data: historicoData, isLoading: loadingHistorico } = useQuery({
    queryKey: ['certificados-emitidos'],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('certificados_emitidos')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return { items: data || [], total: count || 0 };
    },
    staleTime: 2 * 60 * 1000,
  });
  const historico = historicoData?.items?.slice(0, certLimit) || [];
  const totalCerts = historicoData?.total || 0;

  const buildDados = useCallback((): DadosCertificado => ({
    tipo,
    tamanho,
    nomeParoquia: tema.nome || 'Paróquia',
    logoUrl: tema.logoUrl || undefined,
    nomeCompleto: formData.nomeCompleto || '',
    dataCerimonia: formData.dataCerimonia || '',
    localCerimonia: formData.localCerimonia,
    celebrante: formData.celebrante,
    parocoNome: formData.parocoNome,
    nomePai: formData.nomePai,
    nomeMae: formData.nomeMae,
    padrinhoNome: formData.padrinhoNome,
    madrinhaNome: formData.madrinhaNome,
    dataNascimento: formData.dataNascimento,
    nomeConjuge: formData.nomeConjuge,
    testemunha1: formData.testemunha1,
    testemunha2: formData.testemunha2,
    nomeSanto: formData.nomeSanto,
    cargaHoraria: formData.cargaHoraria,
    dataInicio: formData.dataInicio,
    dataFim: formData.dataFim,
    observacoes: formData.observacoes,
    textoPersonalizado: formData.textoPersonalizado,
  }), [tipo, tamanho, tema, formData]);

  const salvarHistorico = async (dados: DadosCertificado) => {
    try {
      // Check for duplicate: same tipo + nome + data_cerimonia
      let checkQuery = supabase
        .from('certificados_emitidos')
        .select('id', { count: 'exact', head: true })
        .eq('tipo', dados.tipo)
        .eq('nome_completo', dados.nomeCompleto);

      if (dados.dataCerimonia) {
        checkQuery = checkQuery.eq('data_cerimonia', dados.dataCerimonia);
      } else {
        checkQuery = checkQuery.is('data_cerimonia', null);
      }

      const { count } = await checkQuery;
      if (count && count > 0) {
        // Already exists, skip duplicate insert
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('certificados_emitidos').insert({
        tipo: dados.tipo,
        tamanho: dados.tamanho,
        nome_completo: dados.nomeCompleto,
        data_cerimonia: dados.dataCerimonia || null,
        dados: dados as any,
        emitido_por: user?.id || null,
      });
      queryClient.invalidateQueries({ queryKey: ['certificados-emitidos'] });
    } catch (e) {
      console.error('Erro ao salvar histórico:', e);
    }
  };

  const handlePreview = async () => {
    if (!formData.nomeCompleto) { toast.error('Informe o nome completo'); return; }
    try {
      const dados = buildDados();
      const doc = await gerarCertificadoPDF(dados);
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e: any) {
      toast.error('Erro ao gerar preview: ' + e.message);
    }
  };

  const handleDownload = async () => {
    if (!formData.nomeCompleto) { toast.error('Informe o nome completo'); return; }
    try {
      const dados = buildDados();
      const doc = await gerarCertificadoPDF(dados);
      const label = TIPOS_CERTIFICADO[tipo].label.replace(/ /g, '_');
      doc.save(`Certificado_${label}_${formData.nomeCompleto.split(' ')[0]}.pdf`);
      toast.success('Certificado baixado com sucesso!');
      await salvarHistorico(dados);
    } catch (e: any) {
      toast.error('Erro ao gerar certificado: ' + e.message);
    }
  };

  const handleReissue = (item: any) => {
    const dados = item.dados as DadosCertificado;
    setTipo(dados.tipo);
    setTamanho(dados.tamanho);
    setFormData({
      nomeCompleto: dados.nomeCompleto || '',
      dataCerimonia: dados.dataCerimonia || '',
      localCerimonia: dados.localCerimonia || '',
      celebrante: dados.celebrante || '',
      parocoNome: dados.parocoNome || '',
      nomePai: dados.nomePai || '',
      nomeMae: dados.nomeMae || '',
      padrinhoNome: dados.padrinhoNome || '',
      madrinhaNome: dados.madrinhaNome || '',
      dataNascimento: dados.dataNascimento || '',
      nomeConjuge: dados.nomeConjuge || '',
      testemunha1: dados.testemunha1 || '',
      testemunha2: dados.testemunha2 || '',
      nomeSanto: dados.nomeSanto || '',
      cargaHoraria: dados.cargaHoraria || '',
      dataInicio: dados.dataInicio || '',
      dataFim: dados.dataFim || '',
      observacoes: dados.observacoes || '',
      textoPersonalizado: dados.textoPersonalizado || '',
    });
    setActiveTab('emitir');
    toast.info('Dados carregados. Revise e emita a 2ª via.');
  };

  const renderCamposComuns = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Nome Completo *</Label>
        <Input value={formData.nomeCompleto || ''} onChange={e => set('nomeCompleto', e.target.value)} placeholder="Nome do(a) certificando(a)" />
      </div>
      <div className="space-y-2">
        <Label>Data da Cerimônia *</Label>
        <Input type="date" value={formData.dataCerimonia || ''} onChange={e => set('dataCerimonia', e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Local da Cerimônia</Label>
        <Input value={formData.localCerimonia || ''} onChange={e => set('localCerimonia', e.target.value)} placeholder="Ex: Igreja Matriz" />
      </div>
      <div className="space-y-2">
        <Label>Celebrante</Label>
        <Input value={formData.celebrante || ''} onChange={e => set('celebrante', e.target.value)} placeholder="Nome do celebrante" />
      </div>
      <div className="space-y-2 md:col-span-2 p-4 rounded-lg border-2 border-dashed border-primary/20 bg-primary/5">
        <Label className="text-primary font-semibold flex items-center gap-2">
          ✍️ Assinatura do Pároco
        </Label>
        <Input
          value={formData.parocoNome || ''}
          onChange={e => set('parocoNome', e.target.value)}
          placeholder="Ex: Pe. João da Silva"
          className="text-lg font-medium"
        />
        <p className="text-xs text-muted-foreground">Este nome aparecerá na linha de assinatura do certificado PDF</p>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label className="font-semibold flex items-center gap-2">📝 Texto Personalizado do Certificado</Label>
        <Textarea
          value={formData.textoPersonalizado || ''}
          onChange={e => set('textoPersonalizado', e.target.value)}
          placeholder="Ex: Certificamos que o sacramento foi realizado conforme os ritos da Santa Igreja Católica..."
          rows={3}
        />
        <p className="text-xs text-muted-foreground">Este texto será exibido no corpo do certificado antes da assinatura</p>
      </div>
    </div>
  );

  const renderCamposEspecificos = () => {
    switch (tipo) {
      case 'batismo':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2"><Label>Data de Nascimento</Label><Input type="date" value={formData.dataNascimento || ''} onChange={e => set('dataNascimento', e.target.value)} /></div>
            <div className="space-y-2"><Label>Nome do Pai</Label><Input value={formData.nomePai || ''} onChange={e => set('nomePai', e.target.value)} /></div>
            <div className="space-y-2"><Label>Nome da Mãe</Label><Input value={formData.nomeMae || ''} onChange={e => set('nomeMae', e.target.value)} /></div>
            <div className="space-y-2"><Label>Padrinho</Label><Input value={formData.padrinhoNome || ''} onChange={e => set('padrinhoNome', e.target.value)} /></div>
            <div className="space-y-2"><Label>Madrinha</Label><Input value={formData.madrinhaNome || ''} onChange={e => set('madrinhaNome', e.target.value)} /></div>
          </div>
        );
      case 'crisma':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2"><Label>Nome de Crisma (Santo)</Label><Input value={formData.nomeSanto || ''} onChange={e => set('nomeSanto', e.target.value)} placeholder="Ex: São Francisco de Assis" /></div>
            <div className="space-y-2"><Label>Padrinho/Madrinha</Label><Input value={formData.padrinhoNome || ''} onChange={e => set('padrinhoNome', e.target.value)} /></div>
          </div>
        );
      case 'casamento':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2"><Label>Nome do(a) Cônjuge</Label><Input value={formData.nomeConjuge || ''} onChange={e => set('nomeConjuge', e.target.value)} /></div>
            <div className="space-y-2"><Label>Testemunha 1</Label><Input value={formData.testemunha1 || ''} onChange={e => set('testemunha1', e.target.value)} /></div>
            <div className="space-y-2"><Label>Testemunha 2</Label><Input value={formData.testemunha2 || ''} onChange={e => set('testemunha2', e.target.value)} /></div>
          </div>
        );
      case 'curso_batismo':
      case 'curso_noivos':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {tipo === 'curso_noivos' && (
              <div className="space-y-2"><Label>Nome do(a) Noivo(a)</Label><Input value={formData.nomeConjuge || ''} onChange={e => set('nomeConjuge', e.target.value)} /></div>
            )}
            <div className="space-y-2"><Label>Carga Horária</Label><Input value={formData.cargaHoraria || ''} onChange={e => set('cargaHoraria', e.target.value)} placeholder="Ex: 12 horas" /></div>
            <div className="space-y-2"><Label>Data Início</Label><Input type="date" value={formData.dataInicio || ''} onChange={e => set('dataInicio', e.target.value)} /></div>
            <div className="space-y-2"><Label>Data Fim</Label><Input type="date" value={formData.dataFim || ''} onChange={e => set('dataFim', e.target.value)} /></div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Award className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Certificados</h1>
            <p className="text-sm text-muted-foreground">Gere certificados paroquiais com design profissional</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="emitir" className="gap-2">
              <Award className="h-4 w-4" /> Emitir Certificado
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-2">
              <History className="h-4 w-4" /> Histórico / 2ª Via
            </TabsTrigger>
          </TabsList>

          <TabsContent value="emitir" className="space-y-6 mt-4">
            {/* Seletor de tipo */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {(Object.entries(TIPOS_CERTIFICADO) as [TipoCertificado, { label: string }][]).map(([key, { label }]) => (
                <button
                  key={key}
                  onClick={() => { setTipo(key); setFormData({ textoPersonalizado: TEXTOS_PADRAO[key] }); }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                    tipo === key
                      ? `${TIPO_COLORS[key]} border-current shadow-md scale-[1.02]`
                      : 'bg-card border-border hover:border-primary/30 hover:shadow-sm'
                  }`}
                >
                  <span className={tipo === key ? '' : 'text-muted-foreground'}>{TIPO_ICONS[key]}</span>
                  <span className="text-xs font-semibold text-center leading-tight">{label}</span>
                </button>
              ))}
            </div>

            {/* Formulário */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  {TIPO_ICONS[tipo]}
                  <div>
                    <CardTitle className="text-lg">{TIPOS_CERTIFICADO[tipo].label}</CardTitle>
                    <CardDescription>Preencha os dados do certificado</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  <Label className="shrink-0">Tamanho:</Label>
                  <Select value={tamanho} onValueChange={(v) => setTamanho(v as TamanhoCertificado)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4 (Retrato)</SelectItem>
                      <SelectItem value="A5">A5 (Retrato)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {renderCamposComuns()}
                {renderCamposEspecificos()}

                <div className="flex flex-wrap gap-3 pt-4 border-t">
                  <Button onClick={handlePreview} variant="outline" className="gap-2">
                    <Eye className="h-4 w-4" /> Visualizar
                  </Button>
                  <Button onClick={handleDownload} className="gap-2">
                    <FileDown className="h-4 w-4" /> Baixar PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5 text-primary" />
                      Histórico de Certificados Emitidos
                    </CardTitle>
                    <CardDescription>Selecione um certificado para emitir 2ª via</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['certificados-emitidos'] })}
                    className="gap-1"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Atualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingHistorico ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : historico.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Award className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhum certificado emitido ainda.</p>
                    <p className="text-xs mt-1">Os certificados aparecerão aqui após a emissão.</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Data Cerimônia</TableHead>
                            <TableHead>Emitido em</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historico.map((item: any) => {
                            const tipoKey = item.tipo as TipoCertificado;
                            const tipoInfo = TIPOS_CERTIFICADO[tipoKey];
                            return (
                              <TableRow key={item.id}>
                                <TableCell>
                                  <Badge className={`${TIPO_BADGE[tipoKey] || ''} text-xs`}>
                                    {tipoInfo?.label || item.tipo}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium">{item.nome_completo}</TableCell>
                                <TableCell>
                                  {item.data_cerimonia
                                    ? format(new Date(item.data_cerimonia + 'T12:00:00'), 'dd/MM/yyyy')
                                    : '—'}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5"
                                    onClick={() => handleReissue(item)}
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" /> 2ª Via
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    {historico.length < totalCerts && (
                      <div className="flex justify-center pt-4">
                        <Button
                          variant="outline"
                          onClick={() => setCertLimit(prev => prev + CERT_POR_PAGINA)}
                          className="gap-2"
                        >
                          Ver Mais ({historico.length} de {totalCerts})
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
