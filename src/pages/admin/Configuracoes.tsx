import React, { useEffect, useState, useRef } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useTheme, aplicarCores } from '@/contexts/ThemeContext';
import { Eye, EyeOff, Save, Wifi, RefreshCw, Plus, Pencil, Trash2, Copy, CheckCircle, XCircle, ExternalLink, BookOpen, Key, Church, Shield, Palette, Upload, Image, Printer, HandHeart, UserPlus, UserCheck, UserX, MonitorSmartphone, CreditCard, Smartphone, Wallet, Megaphone, Users, Mail, Send, MapPin, IdCard } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import ConfiguracoesTEF from '@/components/admin/ConfiguracoesTEF';
import TransactionLogTerminal from '@/components/admin/TransactionLogTerminal';
import { useToast } from '@/hooks/use-toast';
import { registrarAuditoria } from '@/lib/audit';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import PersonalizarComprovanteModal from '@/components/admin/PersonalizarComprovanteModal';
import { clearComprovanteConfigCache, PRESETS_IMPRESSORA, type PresetImpressora, type ComprovanteConfig } from '@/lib/comprovante-config';
import NotificacoesPushPanel from '@/components/admin/NotificacoesPushPanel';
import CarteirinhaCard from '@/components/carteirinha/CarteirinhaCard';

type Config = {
  id: string;
  nome: string;
  modo: string;
  merchant_id: string | null;
  webhook_secret: string | null;
  pix_expiracao_minutos: number | null;
  parcelamento_max: number | null;
  parcelamento_juros: number | null;
  client_id?: string | null;
  client_secret?: string | null;
  webhook_url?: string | null;
};

type MensagemPersonalizada = {
  id: string;
  tipo: string | null;
  titulo: string;
  mensagem: string;
  versiculo: string | null;
  ativo: boolean;
};

type LogWebhook = {
  id: string;
  created_at: string;
  evento: string;
  status_processamento: string | null;
  erro: string | null;
  pagamento_id: string | null;
};

type Servo = {
  id: string;
  user_id: string;
  nome: string;
  cpf: string | null;
  ativo: boolean;
  created_at: string;
  email?: string;
  comunidade_id: string | null;
  comunidade_nome?: string;
};

type ConfigParoquia = {
  id?: string;
  nome: string;
  cnpj: string;
  telefone: string;
  endereco: string;
  site: string;
  chave_pix: string;
  pin_totem: string;
  logo_url?: string;
  logo_termico_url?: string;
  logo_carteirinha_url?: string;
  cor_primaria?: string;
  cor_secundaria?: string;
  cor_acento?: string;
  cor_fonte?: string;
  tamanho_fonte?: string;
  slogan?: string;
  cadastro_aberto?: boolean;
  loja_ativa?: boolean;
  impressora_preset?: string | null;
  comprovante_config?: any;
};

// Conversão HSL ↔ HEX para color picker
function hslToHex(hslStr: string): string {
  try {
    const parts = hslStr.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return '#2d1a1a';
    const h = parseFloat(parts[0]);
    const s = parseFloat(parts[1]) / 100;
    const l = parseFloat(parts[2]) / 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  } catch { return '#2d1a1a'; }
}

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      case b: h = ((r - g) / d + 4); break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const TIPO_LABELS: Record<string, string> = {
  dizimo: 'Dízimo', oferta: 'Oferta', campanha: 'Campanha', eventual: 'Eventual'
};

// Máscaras de input
function mascaraCnpj(v: string) {
  return v.replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .slice(0, 18);
}

function mascaraTelefone(v: string) {
  return v.replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 15);
}

const AdminConfiguracoes: React.FC = () => {
  const [config, setConfig] = useState<Config | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Config>>({});
  const [salvando, setSalvando] = useState(false);
  const [modalComprovanteOpen, setModalComprovanteOpen] = useState(false);
  const [testando, setTestando] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const toggleShow = (k: string) => setShowSecret(s => ({ ...s, [k]: !s[k] }));
  // Credenciais isoladas por provedor — trocar de provedor NÃO sobrescreve nada.
  type ProviderCreds = {
    rede: { client_id: string; client_secret: string; merchant_id: string };
    sicredi: { client_id: string; client_secret: string; codigo_filiacao: string };
    pagarme: { api_key: string };
  };
  const emptyCreds: ProviderCreds = {
    rede: { client_id: '', client_secret: '', merchant_id: '' },
    sicredi: { client_id: '', client_secret: '', codigo_filiacao: '' },
    pagarme: { api_key: '' },
  };
  const [creds, setCreds] = useState<ProviderCreds>(emptyCreds);
  const [mensagens, setMensagens] = useState<MensagemPersonalizada[]>([]);
  const [logsWebhook, setLogsWebhook] = useState<LogWebhook[]>([]);
  const [modalMensagem, setModalMensagem] = useState(false);
  const [editandoMensagem, setEditandoMensagem] = useState<MensagemPersonalizada | null>(null);
  const [formMensagem, setFormMensagem] = useState<Partial<MensagemPersonalizada>>({});
  const [salvandoMensagem, setSalvandoMensagem] = useState(false);
  const [formParoquia, setFormParoquia] = useState<ConfigParoquia>({ nome: '', cnpj: '', telefone: '', endereco: '', site: '', chave_pix: '', pin_totem: '', cor_primaria: '40 55% 54%', cor_secundaria: '350 60% 28%', cor_acento: '40 75% 50%', cor_fonte: '350 40% 12%', tamanho_fonte: 'medio', slogan: '', logo_url: '', logo_termico_url: '', logo_carteirinha_url: '', cadastro_aberto: true, loja_ativa: false });
  const [paroquiaId, setParoquiaId] = useState<string | null>(null);
  const [salvandoParoquia, setSalvandoParoquia] = useState(false);
  const [salvandoIdentidade, setSalvandoIdentidade] = useState(false);
  const [uploadandoLogoTermico, setUploadandoLogoTermico] = useState(false);
  const [uploadandoLogoCart, setUploadandoLogoCart] = useState(false);
  const [modalLogoCarteirinha, setModalLogoCarteirinha] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputTermicoRef = useRef<HTMLInputElement>(null);
  const fileInputCartRef = useRef<HTMLInputElement>(null);
  // Servos
  const [servos, setServos] = useState<Servo[]>([]);
  const [loadingServos, setLoadingServos] = useState(false);
  const [cadastrandoServo, setCadastrandoServo] = useState(false);
  const [formServo, setFormServo] = useState({ nome: '', email: '', cpf: '', senha: '', repetirSenha: '', comunidade_id: '' });
  const [showSenhaServo, setShowSenhaServo] = useState(false);
  const [showRepetirSenha, setShowRepetirSenha] = useState(false);
  const [editandoServo, setEditandoServo] = useState<Servo | null>(null);
  const [formEditServo, setFormEditServo] = useState({ nome: '', cpf: '', comunidade_id: '' });
  const [salvandoEditServo, setSalvandoEditServo] = useState(false);
  // Avisos Totem
  const [avisos, setAvisos] = useState<any[]>([]);
  const [modalAviso, setModalAviso] = useState(false);
  const [editandoAviso, setEditandoAviso] = useState<any>(null);
  const [formAviso, setFormAviso] = useState({ titulo: '', mensagem: '', cor: '', ordem: 0, link_url: '', tela_cheia: true, duracao_segundos: 8 });
  const [salvandoAviso, setSalvandoAviso] = useState(false);
  const [avisoImageFile, setAvisoImageFile] = useState<File | null>(null);
  const [avisoImagePreview, setAvisoImagePreview] = useState<string | null>(null);
  const [uploadandoAvisoImg, setUploadandoAvisoImg] = useState(false);
  const avisoFileRef = useRef<HTMLInputElement>(null);
  // Comunidades
  const [comunidades, setComunidades] = useState<any[]>([]);
  const [modalComunidade, setModalComunidade] = useState(false);
  const [editandoComunidade, setEditandoComunidade] = useState<any>(null);
  const [formComunidade, setFormComunidade] = useState({ nome: '', descricao: '' });
  const [salvandoComunidade, setSalvandoComunidade] = useState(false);
  // Email Agradecimento (Resend)
  const [formEmail, setFormEmail] = useState({ resend_api_key: '', resend_from_email: '', email_agradecimento_ativo: false });
  const [salvandoEmail, setSalvandoEmail] = useState(false);
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [emailTeste, setEmailTeste] = useState('');
  const [showResendKey, setShowResendKey] = useState(false);
  const { toast } = useToast();
  const { recarregarTema } = useTheme();

  // Webhook URL depende do provedor ativo:
  //  - Rede usa o próprio endpoint `rede-gateway` (compatibilidade)
  //  - Sicredi/Pagar.me usam o endpoint público `webhook-pagamento?provedor=...`
  const buildWebhookUrl = (provedor: string) => {
    const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
    if (provedor === 'rede') return `${base}/rede-gateway`;
    return `${base}/webhook-pagamento?provedor=${provedor}`;
  };
  const webhookUrl = buildWebhookUrl(((form as any)?.provedor as string) || 'rede');

  useEffect(() => {
    fetchConfig();
    fetchMensagens();
    fetchLogsWebhook();
    fetchParoquia();
    fetchServos();
    fetchAvisos();
    fetchComunidades();
  }, []);

  // ======= SERVOS =======
  function mascaraCpf(v: string) {
    return v.replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
      .slice(0, 14);
  }

  function mascaraCpfOculto(cpf: string | null): string {
    if (!cpf) return '-';
    const limpo = cpf.replace(/\D/g, '');
    if (limpo.length !== 11) return cpf;
    return `***.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-**`;
  }

  const fetchServos = async () => {
    setLoadingServos(true);
    const { data } = await (supabase as any).from('servos').select('*, comunidades(nome)').order('created_at', { ascending: false });
    if (data && data.length > 0) {
      const userIds = data.map((s: any) => s.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, email').in('id', userIds);
      const emailMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { emailMap[p.id] = p.email || ''; });
      setServos(data.map((s: any) => ({ ...s, email: emailMap[s.user_id] || '', comunidade_nome: s.comunidades?.nome || null })));
    } else {
      setServos(data || []);
    }
    setLoadingServos(false);
  };

  const cadastrarServo = async () => {
    if (!formServo.nome.trim() || !formServo.email.trim() || !formServo.senha) {
      toast({ title: 'Preencha nome, e-mail e senha', variant: 'destructive' }); return;
    }
    if (formServo.senha.length < 6) {
      toast({ title: 'Senha deve ter no mínimo 6 caracteres', variant: 'destructive' }); return;
    }
    if (formServo.senha !== formServo.repetirSenha) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' }); return;
    }
    setCadastrandoServo(true);
    try {
      const resp = await supabase.functions.invoke('create-servo', {
        body: {
          nome: formServo.nome.trim(),
          email: formServo.email.trim().toLowerCase(),
          cpf: formServo.cpf.trim() || null,
          senha: formServo.senha,
          comunidade_id: formServo.comunidade_id || null,
        },
      });
      if (resp.error || resp.data?.error) {
        throw new Error(resp.data?.error || resp.error?.message || 'Erro desconhecido');
      }
      toast({ title: '✅ Colaborador cadastrado com acesso Admin!', description: `${formServo.nome} pode fazer login com o e-mail informado e acessar o painel administrativo.` });
      await registrarAuditoria({ acao: 'cadastrar_colaborador', entidade: 'servos', detalhes: { nome: formServo.nome, email: formServo.email } });
      setFormServo({ nome: '', email: '', cpf: '', senha: '', repetirSenha: '', comunidade_id: '' });
      fetchServos();
    } catch (err: any) {
      toast({ title: 'Erro ao cadastrar servo', description: err.message, variant: 'destructive' });
    }
    setCadastrandoServo(false);
  };

  const abrirEditarServo = (servo: Servo) => {
    setEditandoServo(servo);
    setFormEditServo({ nome: servo.nome, cpf: servo.cpf || '', comunidade_id: servo.comunidade_id || '' });
  };

  const salvarEditServo = async () => {
    if (!editandoServo) return;
    if (!formEditServo.nome.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' }); return;
    }
    setSalvandoEditServo(true);
    try {
      const { error } = await (supabase as any).from('servos').update({
        nome: formEditServo.nome.trim(),
        cpf: formEditServo.cpf.trim() || null,
        comunidade_id: formEditServo.comunidade_id || null,
      }).eq('id', editandoServo.id);
      if (error) throw error;
      // Also update profile name
      await supabase.from('profiles').update({ nome_completo: formEditServo.nome.trim() }).eq('id', editandoServo.user_id);
      toast({ title: '✅ Colaborador atualizado!' });
      await registrarAuditoria({ acao: 'editar_colaborador', entidade: 'servos', entidade_id: editandoServo.id, detalhes: { nome: formEditServo.nome } });
      setEditandoServo(null);
      fetchServos();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    }
    setSalvandoEditServo(false);
  };

  const toggleServoAtivo = async (servo: Servo) => {
    const novoAtivo = !servo.ativo;
    try {
      const resp = await supabase.functions.invoke('toggle-servo', {
        body: { servo_id: servo.id, user_id: servo.user_id, ativo: novoAtivo },
      });
      if (resp.error || resp.data?.error) {
        throw new Error(resp.data?.error || resp.error?.message || 'Erro desconhecido');
      }
      toast({
        title: novoAtivo
          ? `✅ ${servo.nome} ativado — acesso Admin concedido`
          : `🔒 ${servo.nome} inativado — acesso Admin revogado`,
      });
      await registrarAuditoria({ acao: 'toggle_colaborador', entidade: 'servos', entidade_id: servo.id, detalhes: { nome: servo.nome, ativo: novoAtivo } });
      fetchServos();
    } catch (err: any) {
      toast({ title: 'Erro ao alterar status', description: err.message, variant: 'destructive' });
    }
  };
  // ======= FIM SERVOS =======

  // ======= AVISOS TOTEM =======
  const fetchAvisos = async () => {
    const { data } = await (supabase as any).from('avisos_totem').select('*').order('ordem', { ascending: true });
    setAvisos(data || []);
  };

  const abrirModalAviso = (aviso?: any) => {
    setEditandoAviso(aviso || null);
    setFormAviso(aviso ? { titulo: aviso.titulo, mensagem: aviso.mensagem, cor: aviso.cor || '', ordem: aviso.ordem || 0, link_url: aviso.link_url || '', tela_cheia: aviso.tela_cheia ?? true, duracao_segundos: aviso.duracao_segundos ?? 8 } : { titulo: '', mensagem: '', cor: '', ordem: 0, link_url: '', tela_cheia: true, duracao_segundos: 8 });
    setAvisoImageFile(null);
    setAvisoImagePreview(aviso?.imagem_url || null);
    setModalAviso(true);
  };

  const uploadAvisoImagem = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('avisos-totem').upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) { toast({ title: 'Erro no upload', description: error.message, variant: 'destructive' }); return null; }
    const { data: urlData } = supabase.storage.from('avisos-totem').getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleAvisoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvisoImageFile(file);
    setAvisoImagePreview(URL.createObjectURL(file));
  };

  const removerAvisoImagem = () => {
    setAvisoImageFile(null);
    setAvisoImagePreview(null);
  };

  const salvarAviso = async () => {
    if (!formAviso.titulo.trim() || !formAviso.mensagem.trim()) {
      toast({ title: 'Título e mensagem são obrigatórios', variant: 'destructive' }); return;
    }
    setSalvandoAviso(true);
    let imagem_url = editandoAviso?.imagem_url || null;
    if (avisoImageFile) {
      const url = await uploadAvisoImagem(avisoImageFile);
      if (url) imagem_url = url;
    }
    if (!avisoImagePreview && !avisoImageFile) imagem_url = null;
    const payload = { titulo: formAviso.titulo, mensagem: formAviso.mensagem, cor: formAviso.cor || null, ordem: formAviso.ordem, link_url: formAviso.link_url || null, imagem_url, tela_cheia: formAviso.tela_cheia, duracao_segundos: formAviso.duracao_segundos };
    let error;
    if (editandoAviso) {
      ({ error } = await (supabase as any).from('avisos_totem').update(payload).eq('id', editandoAviso.id));
    } else {
      ({ error } = await (supabase as any).from('avisos_totem').insert(payload));
    }
    if (error) {
      toast({ title: 'Erro ao salvar aviso', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editandoAviso ? 'Aviso atualizado!' : 'Aviso criado!' });
      await registrarAuditoria({ acao: 'salvar_aviso', entidade: 'avisos_totem', entidade_id: editandoAviso?.id, detalhes: payload });
      setModalAviso(false);
      fetchAvisos();
    }
    setSalvandoAviso(false);
  };

  const toggleAvisoAtivo = async (aviso: any) => {
    await (supabase as any).from('avisos_totem').update({ ativo: !aviso.ativo }).eq('id', aviso.id);
    fetchAvisos();
  };

  const excluirAviso = async (id: string) => {
    await (supabase as any).from('avisos_totem').delete().eq('id', id);
    await registrarAuditoria({ acao: 'excluir_aviso', entidade: 'avisos_totem', entidade_id: id });
    toast({ title: 'Aviso excluído' });
    fetchAvisos();
  };
  // ======= FIM AVISOS =======

  // ======= COMUNIDADES =======
  const fetchComunidades = async () => {
    const { data } = await supabase.from('comunidades').select('*').order('nome');
    setComunidades(data || []);
  };

  const abrirModalComunidade = (c?: any) => {
    setEditandoComunidade(c || null);
    setFormComunidade(c ? { nome: c.nome, descricao: c.descricao || '' } : { nome: '', descricao: '' });
    setModalComunidade(true);
  };

  const salvarComunidade = async () => {
    if (!formComunidade.nome.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' }); return;
    }
    setSalvandoComunidade(true);
    const payload = { nome: formComunidade.nome, descricao: formComunidade.descricao || null };
    let error;
    if (editandoComunidade) {
      ({ error } = await supabase.from('comunidades').update(payload).eq('id', editandoComunidade.id));
    } else {
      ({ error } = await supabase.from('comunidades').insert(payload));
    }
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editandoComunidade ? 'Comunidade atualizada!' : 'Comunidade criada!' });
      await registrarAuditoria({ acao: 'salvar_comunidade', entidade: 'comunidades', entidade_id: editandoComunidade?.id, detalhes: payload });
      setModalComunidade(false);
      fetchComunidades();
    }
    setSalvandoComunidade(false);
  };

  const toggleComunidadeAtiva = async (c: any) => {
    await supabase.from('comunidades').update({ ativo: !c.ativo }).eq('id', c.id);
    fetchComunidades();
  };

  const excluirComunidade = async (id: string) => {
    if (!confirm('Excluir esta comunidade?')) return;
    await supabase.from('comunidades').delete().eq('id', id);
    await registrarAuditoria({ acao: 'excluir_comunidade', entidade: 'comunidades', entidade_id: id });
    toast({ title: 'Comunidade excluída' });
    fetchComunidades();
  };
  // ======= FIM COMUNIDADES =======

  // ======= EMAIL AGRADECIMENTO (RESEND) =======
  const salvarEmailConfig = async () => {
    if (!formEmail.resend_api_key.trim() || !formEmail.resend_from_email.trim()) {
      toast({ title: 'Preencha a API Key e o e-mail remetente', variant: 'destructive' }); return;
    }
    setSalvandoEmail(true);
    const payload = {
      resend_api_key: formEmail.resend_api_key,
      resend_from_email: formEmail.resend_from_email,
      email_agradecimento_ativo: formEmail.email_agradecimento_ativo,
    };
    let error;
    if (paroquiaId) {
      ({ error } = await (supabase.from('configuracoes_paroquia' as any) as any).update(payload).eq('id', paroquiaId));
    } else {
      ({ error } = await (supabase.from('configuracoes_paroquia' as any) as any).insert({ ...payload, nome: formParoquia.nome || 'Paróquia' }));
    }
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Configurações de e-mail salvas! ✉️' });
      await registrarAuditoria({ acao: 'atualizar_email_config', entidade: 'configuracoes_paroquia', entidade_id: paroquiaId || undefined, detalhes: { resend_from_email: formEmail.resend_from_email, email_agradecimento_ativo: formEmail.email_agradecimento_ativo } });
      fetchParoquia();
    }
    setSalvandoEmail(false);
  };

  const enviarEmailTeste = async () => {
    if (!emailTeste.trim()) {
      toast({ title: 'Informe o e-mail de destino para teste', variant: 'destructive' }); return;
    }
    setEnviandoTeste(true);
    try {
      const resp = await supabase.functions.invoke('enviar-email-agradecimento', {
        body: {
          pagamento_id: crypto.randomUUID(),
          nome_contribuinte: 'Paroquiano Teste',
          valor: 50.0,
          tipo: 'dizimo',
          metodo: 'pix',
          mes_referencia: new Date().toISOString().slice(0, 7),
          email_teste: emailTeste.trim(),
        },
      });
      if (resp.error) throw new Error(resp.error.message);
      const data = resp.data;
      if (data?.success) {
        toast({ title: '✅ E-mail de teste enviado!', description: `Enviado para ${data.email}` });
      } else {
        throw new Error(data?.error || data?.details || 'Erro desconhecido');
      }
    } catch (err: any) {
      toast({ title: 'Erro ao enviar e-mail de teste', description: err.message, variant: 'destructive' });
    }
    setEnviandoTeste(false);
  };
  // ======= FIM EMAIL =======

  const fetchParoquia = async () => {
    const { data } = await supabase
      .from('configuracoes_paroquia' as any)
      .select('*')
      .limit(1)
      .maybeSingle();
    if (data) {
      setParoquiaId((data as any).id);
      setFormParoquia({
        nome: (data as any).nome || '',
        cnpj: (data as any).cnpj || '',
        telefone: (data as any).telefone || '',
        endereco: (data as any).endereco || '',
        site: (data as any).site || '',
        chave_pix: (data as any).chave_pix || '',
        pin_totem: (data as any).pin_totem || '',
        logo_url: (data as any).logo_url || '',
        logo_termico_url: (data as any).logo_termico_url || '',
        logo_carteirinha_url: (data as any).logo_carteirinha_url || '',
        cor_primaria: (data as any).cor_primaria || '40 55% 54%',
        cor_secundaria: (data as any).cor_secundaria || '350 60% 28%',
        cor_acento: (data as any).cor_acento || '40 75% 50%',
        cor_fonte: (data as any).cor_fonte || '350 40% 12%',
        tamanho_fonte: (data as any).tamanho_fonte || 'medio',
        slogan: (data as any).slogan || '',
        cadastro_aberto: (data as any).cadastro_aberto !== false,
        loja_ativa: (data as any).loja_ativa === true,
        impressora_preset: (data as any).impressora_preset || 'epson_tm_t20',
        comprovante_config: (data as any).comprovante_config || null,
      });
      setFormEmail({
        resend_api_key: (data as any).resend_api_key || '',
        resend_from_email: (data as any).resend_from_email || '',
        email_agradecimento_ativo: (data as any).email_agradecimento_ativo || false,
      });
    }
  };


  const salvarParoquia = async () => {
    setSalvandoParoquia(true);
    const payload = {
      nome: formParoquia.nome || null,
      cnpj: formParoquia.cnpj || null,
      telefone: formParoquia.telefone || null,
      endereco: formParoquia.endereco || null,
      site: formParoquia.site || null,
      chave_pix: formParoquia.chave_pix || null,
      pin_totem: formParoquia.pin_totem ? formParoquia.pin_totem.replace(/\D/g, '').slice(0, 8) || null : null,
    };
    let error;
    if (paroquiaId) {
      ({ error } = await (supabase.from('configuracoes_paroquia' as any) as any).update(payload).eq('id', paroquiaId));
    } else {
      ({ error } = await (supabase.from('configuracoes_paroquia' as any) as any).insert(payload));
    }
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Dados da paróquia salvos com sucesso!' });
      await registrarAuditoria({ acao: 'atualizar_paroquia', entidade: 'configuracoes_paroquia', entidade_id: paroquiaId || undefined, detalhes: payload });
      fetchParoquia();
    }
    setSalvandoParoquia(false);
  };

  const salvarIdentidade = async () => {
    setSalvandoIdentidade(true);
    const payload = {
      logo_url: formParoquia.logo_url || null,
      logo_termico_url: formParoquia.logo_termico_url || null,
      logo_carteirinha_url: formParoquia.logo_carteirinha_url || null,
      cor_primaria: formParoquia.cor_primaria || '40 55% 54%',
      cor_secundaria: formParoquia.cor_secundaria || '350 60% 28%',
      cor_acento: formParoquia.cor_acento || '40 75% 50%',
      cor_fonte: formParoquia.cor_fonte || '350 40% 12%',
      tamanho_fonte: formParoquia.tamanho_fonte || 'medio',
      slogan: formParoquia.slogan || null,
    };
    let error;
    if (paroquiaId) {
      ({ error } = await (supabase.from('configuracoes_paroquia' as any) as any).update(payload).eq('id', paroquiaId));
    } else {
      ({ error } = await (supabase.from('configuracoes_paroquia' as any) as any).insert({ ...payload, nome: formParoquia.nome || 'Paróquia' }));
    }
    if (error) {
      toast({ title: 'Erro ao salvar identidade visual', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Identidade visual salva! 🎨', description: 'O tema foi atualizado em todo o sistema.' });
      await registrarAuditoria({ acao: 'atualizar_identidade_visual', entidade: 'configuracoes_paroquia', entidade_id: paroquiaId || undefined, detalhes: payload });
      await recarregarTema();
      fetchParoquia();
    }
    setSalvandoIdentidade(false);
  };

  const salvarComprovanteConfig = async (cfg: ComprovanteConfig, preset: PresetImpressora) => {
    if (!paroquiaId) {
      toast({ title: 'Configure os dados da paróquia antes', variant: 'destructive' });
      return;
    }
    const { error } = await (supabase.from('configuracoes_paroquia' as any) as any)
      .update({ comprovante_config: cfg, impressora_preset: preset })
      .eq('id', paroquiaId);
    if (error) {
      toast({ title: 'Erro ao salvar personalização', description: error.message, variant: 'destructive' });
      throw error;
    }
    clearComprovanteConfigCache();
    setFormParoquia(f => ({ ...f, comprovante_config: cfg, impressora_preset: preset }));
    await registrarAuditoria({ acao: 'atualizar_comprovante_config', entidade: 'configuracoes_paroquia', entidade_id: paroquiaId, detalhes: { preset, ...cfg } });
    toast({ title: 'Comprovante personalizado!', description: `Preset: ${PRESETS_IMPRESSORA[preset].label}` });
  };


  const handleLogoTermicoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'O logo térmico deve ter no máximo 2MB.', variant: 'destructive' });
      return;
    }
    setUploadandoLogoTermico(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from('logos-termicos')
        .upload('logo-termico.png', file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('logos-termicos')
        .getPublicUrl('logo-termico.png');

      // Adicionar cache-bust para forçar reload da imagem
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setFormParoquia(f => ({ ...f, logo_termico_url: publicUrl }));
      toast({ title: 'Logo térmico enviado!', description: 'Clique em "Salvar Identidade Visual" para confirmar.' });
    } catch (err: any) {
      toast({ title: 'Erro ao enviar logo', description: err.message, variant: 'destructive' });
    }
    setUploadandoLogoTermico(false);
    // Reset input
    if (fileInputTermicoRef.current) fileInputTermicoRef.current.value = '';
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'O logo deve ter no máximo 200KB.', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormParoquia(f => ({ ...f, logo_url: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleLogoCarteirinhaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'O logo deve ter no máximo 1.5MB.', variant: 'destructive' });
      return;
    }
    setUploadandoLogoCart(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `logo-carteirinha-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('logos-termicos')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('logos-termicos').getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setFormParoquia(f => ({ ...f, logo_carteirinha_url: publicUrl }));
      toast({ title: 'Logo da carteirinha enviado!', description: 'Clique em "Salvar Identidade Visual" para confirmar.' });
    } catch (err: any) {
      toast({ title: 'Erro ao enviar logo', description: err.message, variant: 'destructive' });
    }
    setUploadandoLogoCart(false);
    if (fileInputCartRef.current) fileInputCartRef.current.value = '';
  };

  const fetchConfig = async () => {
    const { data } = await supabase.from('configuracoes_gateway').select('*').limit(1).single();
    if (data) {
      setConfig(data as Config);
      setConfigId(data.id);
      setForm(data as Config);
      // Hidrata credenciais por provedor a partir de extra_config.credentials,
      // com fallback aos campos legados (mapeados para o provedor ativo).
      const ec: any = (data as any).extra_config || {};
      const saved: Partial<ProviderCreds> | undefined = ec.credentials;
      const ativo = ((data as any).provedor || 'rede') as keyof ProviderCreds;
      const hydrated: ProviderCreds = JSON.parse(JSON.stringify(emptyCreds));
      if (saved) {
        hydrated.rede = { ...hydrated.rede, ...(saved.rede || {}) };
        hydrated.sicredi = { ...hydrated.sicredi, ...(saved.sicredi || {}) };
        hydrated.pagarme = { ...hydrated.pagarme, ...(saved.pagarme || {}) };
      }
      // Fallback: se a credencial do ativo está vazia, puxa dos campos top-level
      if (ativo === 'rede' && !hydrated.rede.client_id) {
        hydrated.rede = {
          client_id: (data as any).client_id || '',
          client_secret: (data as any).client_secret || '',
          merchant_id: (data as any).merchant_id || '',
        };
      } else if (ativo === 'sicredi' && !hydrated.sicredi.client_id) {
        hydrated.sicredi = {
          client_id: (data as any).client_id || '',
          client_secret: (data as any).client_secret || '',
          codigo_filiacao: (data as any).merchant_id || '',
        };
      } else if (ativo === 'pagarme' && !hydrated.pagarme.api_key) {
        hydrated.pagarme = { api_key: (data as any).api_key || '' };
      }
      setCreds(hydrated);
    }
  };

  const fetchMensagens = async () => {
    const { data } = await supabase.from('mensagens_personalizadas').select('*').order('tipo');
    setMensagens((data as any) || []);
  };

  const fetchLogsWebhook = async () => {
    const { data } = await supabase.from('logs_webhook').select('*').order('created_at', { ascending: false }).limit(50);
    setLogsWebhook(data || []);
  };

  const salvar = async () => {
    setSalvando(true);
    const provedor = ((form as any).provedor || 'rede') as 'rede' | 'sicredi' | 'pagarme';
    // Espelha as credenciais do provedor ATIVO nas colunas top-level
    // para manter compatibilidade com o dispatcher das Edge Functions.
    const ativoCreds = creds[provedor] as any;
    const topClientId =
      provedor === 'pagarme' ? null : (ativoCreds.client_id || null);
    const topClientSecret =
      provedor === 'pagarme' ? null : (ativoCreds.client_secret || null);
    const topMerchantId =
      provedor === 'sicredi'
        ? (ativoCreds.codigo_filiacao || null)
        : provedor === 'rede'
          ? (ativoCreds.merchant_id || null)
          : null;
    const topApiKey = provedor === 'pagarme' ? (ativoCreds.api_key || null) : null;
    const mergedExtra = { ...((form as any).extra_config || {}), credentials: creds };
    const payload = {
      nome: form.nome || 'Gateway de Pagamento',
      modo: form.modo || 'simulacao',
      merchant_id: topMerchantId,
      webhook_secret: form.webhook_secret || null,
      pix_expiracao_minutos: form.pix_expiracao_minutos ? Number(form.pix_expiracao_minutos) : 30,
      parcelamento_max: form.parcelamento_max ? Number(form.parcelamento_max) : 12,
      parcelamento_juros: form.parcelamento_juros ? Number(form.parcelamento_juros) : 0.0199,
      // @ts-ignore — colunas adicionadas via migração, tipos não atualizados ainda
      client_id: topClientId,
      // @ts-ignore
      client_secret: topClientSecret,
      // @ts-ignore
      webhook_url: webhookUrl,
      // @ts-ignore
      pix_ativo: (form as any).pix_ativo ?? true,
      // @ts-ignore
      credito_ativo: (form as any).credito_ativo ?? true,
      // @ts-ignore
      debito_ativo: (form as any).debito_ativo ?? true,
      // @ts-ignore — multi-provedor
      provedor,
      // @ts-ignore
      api_key: topApiKey,
      // @ts-ignore
      extra_config: mergedExtra,
    };

    let error;
    if (configId) {
      ({ error } = await supabase.from('configuracoes_gateway').update(payload).eq('id', configId));
    } else {
      ({ error } = await supabase.from('configuracoes_gateway').insert(payload));
    }

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Configurações salvas com sucesso!' });
      fetchConfig();
    }
    setSalvando(false);
  };

  const testarConexao = async () => {
    setTestando(true);
    setResultadoTeste(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await supabase.functions.invoke('rede-gateway', {
        body: { action: 'test-connection' },
      });
      if (resp.error) throw new Error(resp.error.message);
      const result = resp.data;
      setResultadoTeste({
        ok: result?.success === true,
        msg: result?.message || (result?.success ? 'Conexão estabelecida com sucesso!' : 'Falha na conexão'),
      });
    } catch (e: any) {
      setResultadoTeste({ ok: false, msg: e.message || 'Erro ao testar conexão' });
    }
    setTestando(false);
  };

  const copiarWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: 'URL copiada!' });
  };

  // Mensagens
  const abrirModalMensagem = (m?: MensagemPersonalizada) => {
    setEditandoMensagem(m || null);
    setFormMensagem(m ? { ...m } : { ativo: true });
    setModalMensagem(true);
  };

  const salvarMensagem = async () => {
    if (!formMensagem.titulo?.trim() || !formMensagem.mensagem?.trim()) {
      toast({ title: 'Título e mensagem são obrigatórios', variant: 'destructive' });
      return;
    }
    setSalvandoMensagem(true);
    const payload = {
      titulo: formMensagem.titulo,
      mensagem: formMensagem.mensagem,
      tipo: (formMensagem.tipo as any) || null,
      versiculo: formMensagem.versiculo || null,
      ativo: formMensagem.ativo !== false,
    };
    let error;
    if (editandoMensagem) {
      ({ error } = await supabase.from('mensagens_personalizadas').update(payload).eq('id', editandoMensagem.id));
    } else {
      ({ error } = await supabase.from('mensagens_personalizadas').insert(payload));
    }
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Mensagem salva!' });
      setModalMensagem(false);
      fetchMensagens();
    }
    setSalvandoMensagem(false);
  };

  const excluirMensagem = async (id: string) => {
    if (!confirm('Excluir esta mensagem?')) return;
    await supabase.from('mensagens_personalizadas').delete().eq('id', id);
    fetchMensagens();
  };

  const FieldSecret = ({
    label, value, show, onToggle, onChange, placeholder
  }: { label: React.ReactNode; value: string; show: boolean; onToggle: () => void; onChange: (v: string) => void; placeholder?: string }) => (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || ''}
          className="pr-10"
        />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );



  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
            <p className="text-muted-foreground text-sm">Gateway de pagamento Rede (e.Rede Itaú) · Acesso restrito a super_admin</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                const [gw, tef, par] = await Promise.all([
                  supabase.from('configuracoes_gateway').select('*').limit(1).maybeSingle(),
                  supabase.from('configuracoes_tef').select('*').limit(1).maybeSingle(),
                  supabase.from('configuracoes_paroquia').select('*').limit(1).maybeSingle(),
                ]);
                // Remove campos sensíveis (chaves privadas) do export
                const sanitize = (o: any) => {
                  if (!o) return null;
                  const { client_secret, api_key, webhook_secret, middleware_token, ...rest } = o;
                  return { ...rest, _sensiveis_omitidos: ['client_secret','api_key','webhook_secret','middleware_token'] };
                };
                const dump = {
                  exportado_em: new Date().toISOString(),
                  gateway: sanitize(gw.data),
                  tef: sanitize(tef.data),
                  paroquia: par.data,
                };
                const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `config-paroquia-${new Date().toISOString().slice(0,10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast({ title: 'Configuração exportada', description: 'Chaves sensíveis foram omitidas por segurança.' });
              } catch (err: any) {
                toast({ title: 'Erro', description: err.message, variant: 'destructive' });
              }
            }}
            className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors flex items-center gap-1.5 shrink-0"
          >
            ⬇ Exportar configuração
          </button>
        </div>

        <Tabs defaultValue="credenciais">
          <TabsList className="flex-wrap h-auto gap-1 overflow-x-auto">
            <TabsTrigger value="credenciais">Provedor de Pagamento</TabsTrigger>
            <TabsTrigger value="mensagens">Mensagens e Citações</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks e Logs</TabsTrigger>
            <TabsTrigger value="paroquia">Dados da Paróquia</TabsTrigger>
            <TabsTrigger value="identidade">
              <Palette className="h-3.5 w-3.5 mr-1.5" />
              Identidade Visual
            </TabsTrigger>
          <TabsTrigger value="servos">
              <HandHeart className="h-3.5 w-3.5 mr-1.5" />
              Colaboradores
            </TabsTrigger>
            <TabsTrigger value="tef">
              <MonitorSmartphone className="h-3.5 w-3.5 mr-1.5" />
              Maquininha TEF
            </TabsTrigger>
            <TabsTrigger value="avisos">
              <Megaphone className="h-3.5 w-3.5 mr-1.5" />
              Avisos Totem
            </TabsTrigger>
            <TabsTrigger value="comunidades">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Comunidades
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              E-mail e Notificações
            </TabsTrigger>
          </TabsList>

          {/* === ABA CREDENCIAIS === */}
          <TabsContent value="credenciais" className="space-y-4 mt-4">
            {(() => {
              const provedorAtivo = ((form as any).provedor || 'rede') as 'rede' | 'sicredi' | 'pagarme';
              const ativar = (p: 'rede' | 'sicredi' | 'pagarme') =>
                setForm(f => ({ ...f, provedor: p } as any));
              const ProviderHeader = ({
                id, nome, descricao, badgeColor,
              }: { id: 'rede' | 'sicredi' | 'pagarme'; nome: string; descricao: string; badgeColor: string }) => {
                const ativo = provedorAtivo === id;
                return (
                  <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${badgeColor}`} />
                        {nome}
                        {ativo
                          ? <Badge className="ml-1">Ativo</Badge>
                          : <Badge variant="outline" className="ml-1">Inativo</Badge>}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{descricao}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pt-1">
                      <Label htmlFor={`sw-${id}`} className="text-xs text-muted-foreground">
                        {ativo ? 'Ativado' : 'Ativar'}
                      </Label>
                      <Switch
                        id={`sw-${id}`}
                        checked={ativo}
                        onCheckedChange={(c) => { if (c) ativar(id); }}
                      />
                    </div>
                  </CardHeader>
                );
              };
              return (
                <>
                  <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <span className="text-muted-foreground">Gateway online ativo: </span>
                      <strong className="capitalize">{provedorAtivo === 'rede' ? 'Rede (Itaú)' : provedorAtivo === 'sicredi' ? 'Sicredi (Sipag)' : 'Pagar.me'}</strong>
                    </div>
                    <span className="text-xs text-muted-foreground flex-1 min-w-[200px]">
                      Apenas um gateway pode ficar ativo. As credenciais de cada provedor são salvas separadamente — alternar não apaga nada.
                    </span>
                  </div>

                  {/* Seletor de Ambiente (Sandbox / Produção / Simulação) — aplica-se ao gateway ativo */}
                  <Card className="border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/10">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        🌐 Ambiente do Gateway
                        <Badge
                          variant={form.modo === 'producao' ? 'default' : 'outline'}
                          className={
                            form.modo === 'producao'
                              ? 'bg-green-600 hover:bg-green-700'
                              : form.modo === 'sandbox'
                              ? 'border-blue-500 text-blue-700 dark:text-blue-400'
                              : 'border-amber-500 text-amber-700 dark:text-amber-400'
                          }
                        >
                          {form.modo === 'producao' ? '🚀 Produção (dinheiro real)'
                            : form.modo === 'sandbox' ? '🧪 Sandbox (teste real)'
                            : '🔧 Simulação (sem chamada externa)'}
                        </Badge>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Define qual ambiente do <strong className="capitalize">{provedorAtivo}</strong> será chamado pelo site, totem e pelo cliente local. Salve após alterar.
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {([
                          { v: 'simulacao', label: '🔧 Simulação', desc: 'Sem chamada real. Use para validar fluxo de tela.' },
                          { v: 'sandbox',   label: '🧪 Sandbox',   desc: 'Chama a API de teste do gateway. Não movimenta dinheiro.' },
                          { v: 'producao',  label: '🚀 Produção',  desc: 'Movimenta dinheiro de verdade. Confirme credenciais antes.' },
                        ] as const).map(opt => {
                          const ativo = (form.modo || 'simulacao') === opt.v;
                          return (
                            <button
                              key={opt.v}
                              type="button"
                              onClick={() => setForm(f => ({ ...f, modo: opt.v }))}
                              className={`text-left rounded-lg border-2 p-3 transition ${
                                ativo
                                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                  : 'border-border hover:border-primary/40 hover:bg-muted/40'
                              }`}
                            >
                              <div className="font-semibold text-sm">{opt.label}</div>
                              <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                      {form.modo === 'producao' && (
                        <p className="text-xs bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-900 rounded-lg px-3 py-2 mt-3">
                          ⚠️ Modo <strong>Produção</strong> ativo — transações reais serão cobradas dos dizimistas. Teste a conexão antes de receber pagamentos.
                        </p>
                      )}
                      {form.modo === 'sandbox' && (
                        <p className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900 rounded-lg px-3 py-2 mt-3">
                          🧪 Sandbox usa as URLs/credenciais de teste do provedor. Cartões válidos de teste estão na documentação de cada gateway.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* === REDE === */}
                  <Card className={provedorAtivo === 'rede' ? 'border-primary/40' : 'opacity-90'}>
                    <ProviderHeader
                      id="rede"
                      nome="Rede (Itaú) — e.Rede"
                      descricao="OAuth 2.0. Client ID = PV; Client Secret = Chave de Integração (Portal Use Rede)."
                      badgeColor="bg-orange-500"
                    />
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FieldSecret
                        label="Client ID (PV / Número de Filiação)"
                        value={creds.rede.client_id}
                        show={!!showSecret['rede_id']}
                        onToggle={() => toggleShow('rede_id')}
                        onChange={v => setCreds(c => ({ ...c, rede: { ...c.rede, client_id: v } }))}
                        placeholder="Ex: 12345678"
                      />
                      <FieldSecret
                        label="Client Secret (Chave de Integração)"
                        value={creds.rede.client_secret}
                        show={!!showSecret['rede_sec']}
                        onToggle={() => toggleShow('rede_sec')}
                        onChange={v => setCreds(c => ({ ...c, rede: { ...c.rede, client_secret: v } }))}
                        placeholder="Gerado no Portal Use Rede"
                      />
                      <div className="md:col-span-2">
                        <Label>Merchant ID <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
                        <Input
                          value={creds.rede.merchant_id}
                          onChange={e => setCreds(c => ({ ...c, rede: { ...c.rede, merchant_id: e.target.value } }))}
                          placeholder="Opcional"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Button variant="outline" size="sm" onClick={() => window.open('https://www.userede.com.br', '_blank')}>
                          <ExternalLink className="h-4 w-4 mr-2" />Portal Use Rede
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* === SICREDI === */}
                  <Card className={provedorAtivo === 'sicredi' ? 'border-primary/40' : 'opacity-90'}>
                    <ProviderHeader
                      id="sicredi"
                      nome="Sicredi (Sipag)"
                      descricao="OAuth 2.0. Informe Client ID, Client Secret e o Código de Filiação Sipag."
                      badgeColor="bg-green-600"
                    />
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FieldSecret
                        label="Client ID (Sipag)"
                        value={creds.sicredi.client_id}
                        show={!!showSecret['sic_id']}
                        onToggle={() => toggleShow('sic_id')}
                        onChange={v => setCreds(c => ({ ...c, sicredi: { ...c.sicredi, client_id: v } }))}
                        placeholder="Fornecido pelo Sipag"
                      />
                      <FieldSecret
                        label="Client Secret (Sipag)"
                        value={creds.sicredi.client_secret}
                        show={!!showSecret['sic_sec']}
                        onToggle={() => toggleShow('sic_sec')}
                        onChange={v => setCreds(c => ({ ...c, sicredi: { ...c.sicredi, client_secret: v } }))}
                        placeholder="Fornecido pelo Sipag"
                      />
                      <div className="md:col-span-2">
                        <Label>Código de Filiação Sipag <span className="text-destructive">*</span></Label>
                        <Input
                          value={creds.sicredi.codigo_filiacao}
                          onChange={e => setCreds(c => ({ ...c, sicredi: { ...c.sicredi, codigo_filiacao: e.target.value } }))}
                          placeholder="Código do estabelecimento Sipag"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>
                          Chave PIX recebedora <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          value={((form as any).extra_config?.chave_pix) || ''}
                          onChange={e => setForm(f => ({ ...f, extra_config: { ...((f as any).extra_config || {}), chave_pix: e.target.value } } as any))}
                          placeholder="CNPJ, e-mail, telefone (+55…) ou chave aleatória (UUID)"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Chave cadastrada na conta Sicredi que receberá os PIX gerados pelo sistema.
                        </p>
                      </div>

                      <details className="md:col-span-2 rounded-md border p-3 bg-muted/30">
                        <summary className="text-sm font-medium cursor-pointer">URLs e ambiente (avançado)</summary>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                          <div>
                            <Label className="text-xs">OAuth — Produção</Label>
                            <Input
                              value={((form as any).extra_config?.oauth_url_producao) || ''}
                              onChange={e => setForm(f => ({ ...f, extra_config: { ...((f as any).extra_config || {}), oauth_url_producao: e.target.value } } as any))}
                              placeholder="https://api-pix.sicredi.com.br/oauth/token"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">OAuth — Sandbox</Label>
                            <Input
                              value={((form as any).extra_config?.oauth_url_sandbox) || ''}
                              onChange={e => setForm(f => ({ ...f, extra_config: { ...((f as any).extra_config || {}), oauth_url_sandbox: e.target.value } } as any))}
                              placeholder="https://api-pix-h.sicredi.com.br/oauth/token"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">PIX Base — Produção</Label>
                            <Input
                              value={((form as any).extra_config?.pix_base_url_producao) || ''}
                              onChange={e => setForm(f => ({ ...f, extra_config: { ...((f as any).extra_config || {}), pix_base_url_producao: e.target.value } } as any))}
                              placeholder="https://api-pix.sicredi.com.br"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">PIX Base — Sandbox</Label>
                            <Input
                              value={((form as any).extra_config?.pix_base_url_sandbox) || ''}
                              onChange={e => setForm(f => ({ ...f, extra_config: { ...((f as any).extra_config || {}), pix_base_url_sandbox: e.target.value } } as any))}
                              placeholder="https://api-pix-h.sicredi.com.br"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">
                          Deixe em branco para usar os endpoints padrão. Preencha apenas se o Sicredi indicar URLs específicas para a sua filiação.
                        </p>
                      </details>

                      <details className="md:col-span-2 rounded-md border p-3 bg-amber-50/50 dark:bg-amber-950/20">
                        <summary className="text-sm font-medium cursor-pointer">
                          Certificado mTLS (obrigatório em produção)
                        </summary>
                        <div className="mt-3 space-y-3">
                          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-100">
                            <strong>Importante:</strong> a API PIX do Sicredi exige autenticação mútua (mTLS) com certificado <code>.pem</code> emitido pelo banco.
                            As Edge Functions do Supabase <strong>não enviam certificado de cliente diretamente</strong>. O cadastro abaixo armazena o certificado de forma segura para que ele seja utilizado quando o proxy mTLS estiver configurado.
                            Em <em>sandbox/simulação</em> os campos podem ficar em branco.
                          </div>
                          <div>
                            <Label className="text-xs">Certificado (PEM)</Label>
                            <textarea
                              className="w-full min-h-[120px] rounded-md border bg-background p-2 text-xs font-mono"
                              value={((form as any).extra_config?.mtls_cert_pem) || ''}
                              onChange={e => setForm(f => ({ ...f, extra_config: { ...((f as any).extra_config || {}), mtls_cert_pem: e.target.value } } as any))}
                              placeholder={'-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Chave privada (PEM)</Label>
                            <textarea
                              className="w-full min-h-[120px] rounded-md border bg-background p-2 text-xs font-mono"
                              value={((form as any).extra_config?.mtls_key_pem) || ''}
                              onChange={e => setForm(f => ({ ...f, extra_config: { ...((f as any).extra_config || {}), mtls_key_pem: e.target.value } } as any))}
                              placeholder={'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'}
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Passphrase (opcional)</Label>
                              <Input
                                type="password"
                                value={((form as any).extra_config?.mtls_passphrase) || ''}
                                onChange={e => setForm(f => ({ ...f, extra_config: { ...((f as any).extra_config || {}), mtls_passphrase: e.target.value } } as any))}
                                placeholder="Senha do .pem (se houver)"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">URL do proxy mTLS (opcional)</Label>
                              <Input
                                value={((form as any).extra_config?.mtls_proxy_url) || ''}
                                onChange={e => setForm(f => ({ ...f, extra_config: { ...((f as any).extra_config || {}), mtls_proxy_url: e.target.value } } as any))}
                                placeholder="https://meu-proxy.exemplo.com"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">Nome do segredo do proxy (header x-proxy-secret)</Label>
                            <Input
                              value={((form as any).extra_config?.mtls_proxy_secret_name) || ''}
                              onChange={e => setForm(f => ({ ...f, extra_config: { ...((f as any).extra_config || {}), mtls_proxy_secret_name: e.target.value } } as any))}
                              placeholder="SICREDI_PROXY_SECRET (padrão)"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Nome da variável de ambiente (Supabase Secret) que guarda o token compartilhado com o Worker do Cloudflare.
                              Deixe em branco para usar o padrão <code>SICREDI_PROXY_SECRET</code>. Veja <code>docs/sicredi-mtls-cloudflare.md</code>.
                            </p>
                          </div>
                        </div>
                      </details>

                      <div className="md:col-span-2">
                        <Button variant="outline" size="sm" onClick={() => window.open('https://developer.sicredi.com.br', '_blank')}>
                          <ExternalLink className="h-4 w-4 mr-2" />Portal Sicredi Developer
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* === PAGAR.ME === */}
                  <Card className={provedorAtivo === 'pagarme' ? 'border-primary/40' : 'opacity-90'}>
                    <ProviderHeader
                      id="pagarme"
                      nome="Pagar.me"
                      descricao="Basic Auth com Secret Key (sk_test_… para sandbox / sk_live_… para produção)."
                      badgeColor="bg-blue-600"
                    />
                    <CardContent className="grid grid-cols-1 gap-4">
                      <FieldSecret
                        label="Secret Key"
                        value={creds.pagarme.api_key}
                        show={!!showSecret['pm_key']}
                        onToggle={() => toggleShow('pm_key')}
                        onChange={v => setCreds(c => ({ ...c, pagarme: { api_key: v } }))}
                        placeholder="sk_test_… ou sk_live_…"
                      />
                      <div>
                        <Button variant="outline" size="sm" onClick={() => window.open('https://dashboard.pagar.me', '_blank')}>
                          <ExternalLink className="h-4 w-4 mr-2" />Dashboard Pagar.me
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* === CONFIGURAÇÕES COMUNS === */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Configurações Gerais (todos os provedores)</CardTitle>
                      <p className="text-xs text-muted-foreground">Aplicam-se ao gateway atualmente ativo.</p>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>PIX — Expiração (minutos)</Label>
                        <Input
                          type="number"
                          value={form.pix_expiracao_minutos || 30}
                          onChange={e => setForm(f => ({ ...f, pix_expiracao_minutos: Number(e.target.value) }))}
                        />
                      </div>
                      <div>
                        <Label>Parcelamento máximo</Label>
                        <Input
                          type="number"
                          value={form.parcelamento_max || 12}
                          onChange={e => setForm(f => ({ ...f, parcelamento_max: Number(e.target.value) }))}
                        />
                      </div>
                      <div>
                        <Label>Taxa de juros (ex: 0.0199 = 1,99%)</Label>
                        <Input
                          type="number"
                          step="0.0001"
                          value={form.parcelamento_juros || 0.0199}
                          onChange={e => setForm(f => ({ ...f, parcelamento_juros: Number(e.target.value) }))}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <FieldSecret
                          label={<>Webhook Secret <span className="text-muted-foreground font-normal text-xs">(opcional)</span></>}
                          value={form.webhook_secret || ''}
                          show={showWebhookSecret}
                          onToggle={() => setShowWebhookSecret(!showWebhookSecret)}
                          onChange={v => setForm(f => ({ ...f, webhook_secret: v }))}
                          placeholder="Configurar depois, quando ativar webhooks"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Valida assinatura HMAC das notificações enviadas pelo provedor.
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <Label>URL do Webhook (cadastre no painel do provedor)</Label>
                        <div className="flex gap-2">
                          <Input value={webhookUrl} readOnly className="bg-muted text-xs font-mono" />
                          <Button variant="outline" size="icon" onClick={copiarWebhookUrl} title="Copiar">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              );
            })()}

            {/* Teste de conexão */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Teste de Conexão</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Testa autenticação real com o gateway atualmente ativo usando as credenciais salvas.
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 flex-wrap">
                  <Button onClick={testarConexao} disabled={testando} variant="outline">
                    {testando ? (
                      <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Testando...</>
                    ) : (
                      <><Wifi className="h-4 w-4 mr-2" />Testar Conexão</>
                    )}
                  </Button>

                  {resultadoTeste && (
                    <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${resultadoTeste.ok ? 'bg-primary/10 text-primary border-primary/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
                      {resultadoTeste.ok
                        ? <CheckCircle className="h-4 w-4 shrink-0" />
                        : <XCircle className="h-4 w-4 shrink-0" />}
                      {resultadoTeste.msg}
                    </div>
                  )}
                </div>

                {form.modo === 'simulacao' && (
                  <p className="text-xs text-muted-foreground bg-muted border border-border rounded-lg px-3 py-2 mt-3">
                    ⚠️ O modo <strong>Simulação</strong> não realiza chamadas reais ao gateway. Mude para <strong>Sandbox</strong> ou <strong>Produção</strong> para testar a conexão real.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={salvar} disabled={salvando} size="lg">
                {salvando ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" />Salvar Configurações</>
                )}
              </Button>
            </div>

            {/* Meios de pagamento online */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Meios de Pagamento Online
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Habilite ou desabilite os meios de pagamento disponíveis no Totem e área do paroquiano (via gateway e.Rede).
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-sm">PIX</p>
                      <p className="text-xs text-muted-foreground">Pagamento instantâneo via QR Code</p>
                    </div>
                  </div>
                  <Switch
                    checked={(form as any).pix_ativo ?? true}
                    onCheckedChange={v => setForm(f => ({ ...f, pix_ativo: v } as any))}
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">Cartão de Crédito</p>
                      <p className="text-xs text-muted-foreground">Visa, Mastercard, Elo e outros</p>
                    </div>
                  </div>
                  <Switch
                    checked={(form as any).credito_ativo ?? true}
                    onCheckedChange={v => setForm(f => ({ ...f, credito_ativo: v } as any))}
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">Cartão de Débito</p>
                      <p className="text-xs text-muted-foreground">Débito direto na conta</p>
                    </div>
                  </div>
                  <Switch
                    checked={(form as any).debito_ativo ?? true}
                    onCheckedChange={v => setForm(f => ({ ...f, debito_ativo: v } as any))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Terminal de Logs em tempo real */}
            <TransactionLogTerminal />
          </TabsContent>

          {/* === ABA MENSAGENS === */}
          <TabsContent value="mensagens" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-semibold">Mensagens Personalizadas</h2>
                <p className="text-xs text-muted-foreground">Mensagens e citações bíblicas exibidas nos comprovantes</p>
              </div>
              <Button size="sm" onClick={() => abrirModalMensagem()}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Mensagem
              </Button>
            </div>

            {mensagens.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma mensagem cadastrada.</CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mensagens.map(m => (
                  <Card key={m.id} className={m.ativo ? '' : 'opacity-60'}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {m.tipo ? TIPO_LABELS[m.tipo] : 'Geral'}
                          </span>
                          <h3 className="font-medium text-sm mt-1">{m.titulo}</h3>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => abrirModalMensagem(m)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => excluirMensagem(m.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{m.mensagem}</p>
                      {m.versiculo && (
                        <p className="text-xs text-primary/70 italic mt-1">📖 {m.versiculo}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* === ABA WEBHOOKS === */}
          <TabsContent value="webhooks" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-semibold">Logs de Webhook</h2>
                <p className="text-xs text-muted-foreground">Últimos 50 eventos recebidos da API da Rede</p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchLogsWebhook}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {logsWebhook.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">Nenhum webhook recebido ainda.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Evento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Pagamento ID</TableHead>
                        <TableHead>Erro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logsWebhook.map(l => (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(l.created_at), 'dd/MM/yy HH:mm:ss', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{l.evento}</span>
                          </TableCell>
                          <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                              l.status_processamento === 'processado'
                                ? 'bg-green-100 text-green-800 border-green-300'
                                : l.status_processamento === 'erro'
                                ? 'bg-destructive/10 text-destructive border-destructive/20'
                                : 'bg-muted text-muted-foreground border-border'
                            }`}>
                              {l.status_processamento || 'recebido'}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{l.pagamento_id?.slice(0, 8) || '-'}...</TableCell>
                          <TableCell className="text-xs text-destructive max-w-[200px] truncate">{l.erro || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === ABA DADOS DA PARÓQUIA === */}
          <TabsContent value="paroquia" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Church className="h-4 w-4 text-primary" />
                  Dados Institucionais da Paróquia
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Estas informações são exibidas nos comprovantes térmicos emitidos pelo Totem.
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Nome da Paróquia</Label>
                  <Input
                    value={formParoquia.nome}
                    onChange={e => setFormParoquia(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Ex: Paróquia Senhor Santo Cristo dos Milagres"
                  />
                </div>
                <div>
                  <Label>CNPJ</Label>
                  <Input
                    value={formParoquia.cnpj}
                    onChange={e => setFormParoquia(f => ({ ...f, cnpj: mascaraCnpj(e.target.value) }))}
                    placeholder="00.000.000/0001-00"
                    maxLength={18}
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={formParoquia.telefone}
                    onChange={e => setFormParoquia(f => ({ ...f, telefone: mascaraTelefone(e.target.value) }))}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Endereço</Label>
                  <Input
                    value={formParoquia.endereco}
                    onChange={e => setFormParoquia(f => ({ ...f, endereco: e.target.value }))}
                    placeholder="Rua, número, bairro, cidade — UF"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Site</Label>
                  <Input
                    value={formParoquia.site}
                    onChange={e => setFormParoquia(f => ({ ...f, site: e.target.value }))}
                    placeholder="www.paroquiasantocristo.com.br"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Chave PIX</Label>
                  <Input
                    value={formParoquia.chave_pix}
                    onChange={e => setFormParoquia(f => ({ ...f, chave_pix: e.target.value }))}
                    placeholder="Ex: cnpj@paroquia.com.br ou 00.000.000/0001-00"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Exibida no rodapé do Totem para que o fiel saiba para quem está doando.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* PIN do Totem */}
            <Card className="border-warning/40 bg-warning/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-warning" />
                  PIN de Acesso ao Totem
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Quando configurado, o operador precisará digitar este PIN para liberar o terminal de pagamento físico.
                  Deixe em branco para manter o totem aberto (sem PIN).
                </p>
              </CardHeader>
              <CardContent>
                <div className="max-w-xs">
                  <Label>PIN (4–8 dígitos numéricos)</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    value={formParoquia.pin_totem}
                    onChange={e => setFormParoquia(f => ({ ...f, pin_totem: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                    placeholder="Ex: 1234"
                    maxLength={8}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formParoquia.pin_totem ? `✅ PIN configurado com ${formParoquia.pin_totem.length} dígito(s)` : '⚠️ Sem PIN — qualquer um pode acessar o Totem pela URL'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Controle de Cadastros */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-primary" />
                  Controle de Cadastros
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Quando desabilitado, novos usuários não poderão se cadastrar pela tela de login.
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Permitir novos cadastros</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formParoquia.cadastro_aberto ? '✅ Cadastros abertos — qualquer pessoa pode criar conta' : '🔒 Cadastros fechados — apenas o admin pode criar contas'}
                    </p>
                  </div>
                  <Switch
                    checked={formParoquia.cadastro_aberto !== false}
                    onCheckedChange={async (checked) => {
                      setFormParoquia(f => ({ ...f, cadastro_aberto: checked }));
                      if (paroquiaId) {
                        await (supabase.from('configuracoes_paroquia' as any) as any).update({ cadastro_aberto: checked }).eq('id', paroquiaId);
                        await registrarAuditoria({ acao: 'toggle_cadastro_aberto', entidade: 'configuracoes_paroquia', entidade_id: paroquiaId, detalhes: { cadastro_aberto: checked } });
                        toast({ title: checked ? 'Cadastros abertos!' : 'Cadastros fechados!' });
                      }
                    }}
                  />
                </div>

                {/* Toggle Loja */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <Label className="text-sm font-medium">Loja de Produtos</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formParoquia.loja_ativa ? '🛒 Loja habilitada — produtos visíveis no totem e portal' : '🔒 Loja desabilitada — módulo oculto em todo o sistema'}
                    </p>
                  </div>
                  <Switch
                    checked={formParoquia.loja_ativa === true}
                    onCheckedChange={async (checked) => {
                      setFormParoquia(f => ({ ...f, loja_ativa: checked }));
                      if (paroquiaId) {
                        await (supabase.from('configuracoes_paroquia' as any) as any).update({ loja_ativa: checked }).eq('id', paroquiaId);
                        await registrarAuditoria({ acao: 'toggle_loja', entidade: 'configuracoes_paroquia', entidade_id: paroquiaId, detalhes: { loja_ativa: checked } });
                        toast({ title: checked ? '🛒 Loja habilitada!' : '🔒 Loja desabilitada!' });
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={salvarParoquia} disabled={salvandoParoquia} size="lg">
                {salvandoParoquia ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" />Salvar Dados da Paróquia</>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* === ABA IDENTIDADE VISUAL === */}
          <TabsContent value="identidade" className="space-y-4 mt-4">
            {/* Presets de paleta */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" />
                  Paletas Predefinidas
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Clique em uma paleta para aplicar as cores da paróquia ao sistema.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { nome: 'Dourado + Vinho (Padrão)', primaria: '40 55% 44%', secundaria: '350 65% 22%', acento: '40 75% 50%', fonte: '0 0% 95%', corA: '#A8872E', corB: '#5C1420', corC: '#D4A017' },
                    { nome: 'Azul Mariano + Dourado', primaria: '214 64% 35%', secundaria: '40 55% 28%', acento: '200 40% 70%', fonte: '0 0% 95%', corA: '#14508E', corB: '#7A5A1E', corC: '#7AAFCC' },
                    { nome: 'Verde São Francisco', primaria: '152 50% 28%', secundaria: '35 50% 22%', acento: '145 35% 65%', fonte: '0 0% 95%', corA: '#1E6040', corB: '#5C3E14', corC: '#6EAE80' },
                    { nome: 'Roxo Episcopal + Dourado', primaria: '270 55% 32%', secundaria: '40 55% 28%', acento: '265 35% 65%', fonte: '0 0% 95%', corA: '#42206E', corB: '#7A5A1E', corC: '#9A78C0' },
                    { nome: 'Cinza Moderno + Vermelho', primaria: '215 20% 28%', secundaria: '0 65% 30%', acento: '210 15% 70%', fonte: '0 0% 95%', corA: '#3A4252', corB: '#861818', corC: '#A0A8B5' },
                    { nome: 'Azul Noturno + Prata', primaria: '220 50% 25%', secundaria: '220 40% 15%', acento: '210 10% 70%', fonte: '0 0% 95%', corA: '#1F3560', corB: '#161E2E', corC: '#A5AAB5' },
                    { nome: 'Bordô + Creme', primaria: '350 55% 30%', secundaria: '350 50% 18%', acento: '40 40% 70%', fonte: '0 0% 95%', corA: '#762030', corB: '#481622', corC: '#C4AA70' },
                    { nome: 'Verde Escuro + Bronze', primaria: '160 45% 25%', secundaria: '160 40% 14%', acento: '35 50% 55%', fonte: '0 0% 95%', corA: '#235C42', corB: '#142E24', corC: '#B8883A' },
                    { nome: 'Azul Petróleo + Cobre', primaria: '195 55% 25%', secundaria: '195 45% 14%', acento: '25 60% 55%', fonte: '0 0% 95%', corA: '#1C5068', corB: '#122C38', corC: '#C4763A' },
                    { nome: 'Grafite + Laranja', primaria: '220 10% 25%', secundaria: '220 12% 14%', acento: '25 80% 55%', fonte: '0 0% 95%', corA: '#3A3D44', corB: '#1E2024', corC: '#E07820' },
                  ].map(p => (
                    <button
                      key={p.nome}
                      onClick={() => {
                        setFormParoquia(f => ({ ...f, cor_primaria: p.primaria, cor_secundaria: p.secundaria, cor_acento: p.acento, cor_fonte: p.fonte }));
                        aplicarCores(p.primaria, p.secundaria, p.acento, p.fonte, formParoquia.tamanho_fonte);
                      }}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left hover:border-primary transition-colors ${
                        formParoquia.cor_primaria === p.primaria ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                    >
                      <div className="flex gap-1 shrink-0">
                        <div className="w-6 h-6 rounded-full border border-border/40" style={{ background: p.corA }} />
                        <div className="w-6 h-6 rounded-full border border-border/40" style={{ background: p.corB }} />
                        <div className="w-6 h-6 rounded-full border border-border/40" style={{ background: p.corC }} />
                      </div>
                      <span className="text-xs font-medium text-foreground">{p.nome}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Cores personalizadas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cores Personalizadas</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Valores em formato HSL (ex: <code className="bg-muted px-1 rounded">40 55% 54%</code>).
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Cor Primária (botões, destaques)', key: 'cor_primaria' as const, fallback: '40 55% 54%' },
                  { label: 'Cor Secundária (sidebar, cabeçalho)', key: 'cor_secundaria' as const, fallback: '350 60% 28%' },
                  { label: 'Cor de Acento (detalhes, badges)', key: 'cor_acento' as const, fallback: '40 75% 50%' },
                ].map(({ label, key, fallback }) => (
                  <div key={key}>
                    <Label>{label}</Label>
                    <div className="flex items-center gap-3 mt-1">
                      <label className="relative cursor-pointer">
                        <div
                          className="w-12 h-12 rounded-lg border-2 border-border shrink-0 shadow-sm hover:shadow-md transition-shadow"
                          style={{ background: `hsl(${formParoquia[key] || fallback})` }}
                        />
                        <input
                          type="color"
                          value={hslToHex(formParoquia[key] || fallback)}
                          onChange={e => {
                            const hsl = hexToHsl(e.target.value);
                            setFormParoquia(f => ({ ...f, [key]: hsl }));
                            const updated = { ...formParoquia, [key]: hsl };
                            aplicarCores(
                              updated.cor_primaria || '40 55% 54%',
                              updated.cor_secundaria || '350 60% 28%',
                              updated.cor_acento,
                              updated.cor_fonte,
                              updated.tamanho_fonte,
                            );
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </label>
                      <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded">{formParoquia[key] || fallback}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Tipografia */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tipografia</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Configure a cor e o tamanho das fontes do sistema.
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Cor da Fonte</Label>
                  <p className="text-xs text-muted-foreground mb-2">Clique no quadrado para escolher a cor</p>
                  <div className="flex items-center gap-3 mt-1">
                    <label className="relative cursor-pointer">
                      <div
                        className="w-12 h-12 rounded-lg border-2 border-border shrink-0 shadow-sm hover:shadow-md transition-shadow"
                        style={{ background: `hsl(${formParoquia.cor_fonte})` }}
                      />
                      <input
                        type="color"
                        value={hslToHex(formParoquia.cor_fonte || '350 40% 12%')}
                        onChange={e => {
                          const hsl = hexToHsl(e.target.value);
                          setFormParoquia(f => ({ ...f, cor_fonte: hsl }));
                          aplicarCores(formParoquia.cor_primaria || '40 55% 54%', formParoquia.cor_secundaria || '350 60% 28%', formParoquia.cor_acento, hsl, formParoquia.tamanho_fonte);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </label>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{formParoquia.cor_fonte || '350 40% 12%'}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Tamanho da Fonte</Label>
                  <Select
                    value={formParoquia.tamanho_fonte || 'medio'}
                    onValueChange={val => {
                      setFormParoquia(f => ({ ...f, tamanho_fonte: val }));
                      aplicarCores(formParoquia.cor_primaria || '40 55% 54%', formParoquia.cor_secundaria || '350 60% 28%', formParoquia.cor_acento, formParoquia.cor_fonte, val);
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pequeno">Pequeno (14px)</SelectItem>
                      <SelectItem value="medio">Médio (16px) — Padrão</SelectItem>
                      <SelectItem value="grande">Grande (18px)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Logo e slogan */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Image className="h-4 w-4 text-primary" />
                  Logo e Slogan
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  O logo é exibido no cabeçalho, Totem e comprovantes. Máximo 200KB (PNG/JPG/SVG).
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-6">
                  {/* Preview do logo */}
                  <div className="shrink-0 w-24 h-24 rounded-xl border border-border bg-muted flex items-center justify-center overflow-hidden">
                    {formParoquia.logo_url ? (
                      <img src={formParoquia.logo_url} alt="Preview" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Image className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <Label>Upload de Logo</Label>
                      <div className="flex gap-2 mt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Selecionar arquivo
                        </Button>
                        {formParoquia.logo_url && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setFormParoquia(f => ({ ...f, logo_url: '' }))}
                          >
                            Remover
                          </Button>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG ou SVG · máx. 200KB</p>
                    </div>
                    <div>
                      <Label>Ou cole uma URL de imagem</Label>
                      <Input
                        className="mt-1"
                        value={formParoquia.logo_url?.startsWith('data:') ? '' : formParoquia.logo_url || ''}
                        onChange={e => setFormParoquia(f => ({ ...f, logo_url: e.target.value }))}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Slogan (exibido na tela de login e Totem)</Label>
                  <Input
                    className="mt-1"
                    value={formParoquia.slogan || ''}
                    onChange={e => setFormParoquia(f => ({ ...f, slogan: e.target.value }))}
                    placeholder={'"Sua contribuição sustenta a missão da fé"'}
                    maxLength={120}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Logo da Paróquia para a Carteirinha */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <IdCard className="h-4 w-4 text-primary" />
                  Logo da Paróquia na Carteirinha
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Exibido na <strong>frente</strong> da carteirinha do dizimista, no canto superior direito —
                  espelhando o brasão da Diocese (canto superior esquerdo). Recomendado: PNG quadrado, fundo transparente, máx. 1.5MB.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-6 flex-wrap">
                  <div
                    className="shrink-0 w-28 h-28 rounded-xl border border-border bg-white flex items-center justify-center overflow-hidden"
                  >
                    {formParoquia.logo_carteirinha_url ? (
                      <img
                        src={formParoquia.logo_carteirinha_url}
                        alt="Logo carteirinha"
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <IdCard className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-[220px] space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Este logo aparece <strong>apenas na carteirinha</strong>. O brasão da Diocese
                      permanece fixo do lado esquerdo. Visualize a posição exata antes de salvar.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="default" size="sm" onClick={() => setModalLogoCarteirinha(true)}>
                        <Pencil className="h-4 w-4 mr-2" /> Configurar e visualizar
                      </Button>
                      {formParoquia.logo_carteirinha_url && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setFormParoquia(f => ({ ...f, logo_carteirinha_url: '' }))}>
                          Remover
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Logo para Impressora Térmica */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Printer className="h-4 w-4 text-primary" />
                  Logo para Impressora Térmica
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Usado nos comprovantes impressos no Totem (80mm). Recomendado: <strong>preto e branco</strong>, PNG com fundo transparente, máx. 2MB.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-6">
                  {/* Preview miniatura logo térmico */}
                  <div
                    className="shrink-0 w-28 flex items-center justify-center overflow-hidden rounded border"
                    style={{ background: '#fff', borderColor: '#ccc', minHeight: 80, padding: 8 }}
                  >
                    {formParoquia.logo_termico_url ? (
                      <img
                        src={formParoquia.logo_termico_url}
                        alt="Logo térmico"
                        style={{ maxWidth: '100%', maxHeight: 72, objectFit: 'contain', filter: 'grayscale(100%)' }}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', color: '#999', fontSize: 11 }}>
                        <Printer style={{ width: 28, height: 28, margin: '0 auto 4px' }} />
                        Sem logo
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <Label>Upload do Logo Térmico</Label>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadandoLogoTermico}
                          onClick={() => fileInputTermicoRef.current?.click()}
                        >
                          {uploadandoLogoTermico ? (
                            <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
                          ) : (
                            <><Upload className="h-4 w-4 mr-2" />Selecionar arquivo</>
                          )}
                        </Button>
                        {formParoquia.logo_termico_url && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setFormParoquia(f => ({ ...f, logo_termico_url: '' }))}
                          >
                            Remover
                          </Button>
                        )}
                      </div>
                      <input
                        ref={fileInputTermicoRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleLogoTermicoUpload}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG, JPG · máx. 2MB · O arquivo é armazenado de forma segura e a URL é salva automaticamente após o upload.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Botão de personalização do comprovante */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-primary/30 bg-primary/5">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <Printer className="h-4 w-4 text-primary" />
                      Personalizar layout do comprovante
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Modelo da impressora, campos exibidos, textos e corte da guilhotina.
                      {' '}
                      <Badge variant="outline" className="ml-1 text-[10px] font-normal">
                        {PRESETS_IMPRESSORA[(formParoquia.impressora_preset as PresetImpressora) || 'epson_tm_t20']?.label || 'Epson TM-T20'}
                      </Badge>
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setModalComprovanteOpen(true)}>
                    <Pencil className="h-4 w-4 mr-2" /> Personalizar
                  </Button>
                </div>


                {/* Preview do comprovante térmico ao vivo */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Preview do Comprovante Impresso (80mm)</Label>
                  <div style={{ background: '#e5e7eb', padding: 24, borderRadius: 12, display: 'flex', justifyContent: 'center' }}>
                    <div style={{
                      width: 302,
                      background: '#ffffff',
                      fontFamily: '"Courier New", Courier, monospace',
                      fontSize: 11,
                      color: '#000',
                      padding: '16px 14px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      lineHeight: 1.5,
                    }}>
                      {/* Logo */}
                      <div style={{ textAlign: 'center', marginBottom: 8 }}>
                        {(formParoquia.logo_termico_url || formParoquia.logo_url) ? (
                          <img
                            src={formParoquia.logo_termico_url || formParoquia.logo_url}
                            alt="logo"
                            style={{ maxHeight: 56, maxWidth: 180, objectFit: 'contain', filter: 'grayscale(100%)', margin: '0 auto' }}
                          />
                        ) : (
                          <div style={{ fontSize: 14, fontWeight: 'bold', letterSpacing: 1 }}>
                            {formParoquia.nome || '[ PARÓQUIA ]'}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'center', fontSize: 10, marginBottom: 2 }}>
                        {formParoquia.nome && <div style={{ fontWeight: 'bold' }}>{formParoquia.nome.toUpperCase()}</div>}
                        {formParoquia.cnpj && <div>CNPJ: {formParoquia.cnpj}</div>}
                      </div>
                      <div style={{ borderTop: '1px solid #000', margin: '6px 0' }} />
                      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 12, letterSpacing: 0.5 }}>
                        COMPROVANTE DE CONTRIBUIÇÃO
                      </div>
                      <div style={{ borderTop: '1px solid #000', margin: '6px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Data:</span>
                        <span>{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Tipo:</span>
                        <span>Dízimo</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Dizimista:</span>
                        <span>João da Silva</span>
                      </div>
                      <div style={{ border: '1px solid #000', margin: '8px 0', padding: '6px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10 }}>Valor Total</div>
                        <div style={{ fontSize: 16, fontWeight: 'bold' }}>R$ 150,00</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Método:</span>
                        <span>PIX</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Status:</span>
                        <span style={{ fontWeight: 'bold' }}>PAGO ✓</span>
                      </div>
                      <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
                      <div style={{ textAlign: 'center', fontSize: 10 }}>
                        <div>Deus lhe pague! 🙏</div>
                        {formParoquia.site && <div>{formParoquia.site}</div>}
                        {formParoquia.telefone && <div>Tel: {formParoquia.telefone}</div>}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preview ao vivo do sistema */}
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-base">Preview ao Vivo</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="rounded-xl overflow-hidden border border-border"
                  style={{ background: `linear-gradient(135deg, hsl(${formParoquia.cor_secundaria}) 0%, hsl(${formParoquia.cor_primaria}) 100%)` }}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    {formParoquia.logo_url && (
                      <img src={formParoquia.logo_url} alt="logo" className="h-8 w-8 object-contain rounded" />
                    )}
                    <div>
                      <p className="font-bold text-sm" style={{ color: `hsl(${formParoquia.cor_primaria})` }}>
                        {formParoquia.nome || 'Nome da Paróquia'}
                      </p>
                      <p className="text-xs opacity-60 text-white">{formParoquia.slogan || 'Slogan da paróquia'}</p>
                    </div>
                    <div
                      className="ml-auto px-3 py-1 rounded-full text-xs font-semibold"
                      style={{ background: `hsl(${formParoquia.cor_primaria} / 0.25)`, color: `hsl(${formParoquia.cor_primaria})` }}
                    >
                      Super Admin
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={salvarIdentidade} disabled={salvandoIdentidade} size="lg">
                {salvandoIdentidade ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" />Salvar Identidade Visual</>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* === ABA COLABORADORES === */}
          <TabsContent value="servos" className="space-y-6 mt-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <HandHeart className="h-5 w-5 text-amber-500" />
                  Colaboradores do Dízimo
                </h2>
                <p className="text-muted-foreground text-sm">
                  Colaboradores com acesso completo de Administrador ao painel. Podem visualizar e gerenciar pagamentos, dizimistas, campanhas, relatórios e o modo Kiosk.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchServos} disabled={loadingServos}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingServos ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>

            {/* Formulário de cadastro */}
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-amber-600" />
                  Cadastrar Novo Colaborador
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  O colaborador receberá acesso de Admin ao painel. Você pode inativá-lo a qualquer momento para revogar o acesso.
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Nome Completo *</Label>
                  <Input
                    value={formServo.nome}
                    onChange={e => setFormServo(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Ex: João da Silva"
                  />
                </div>
                <div>
                  <Label>E-mail *</Label>
                  <Input
                    type="email"
                    value={formServo.email}
                    onChange={e => setFormServo(f => ({ ...f, email: e.target.value }))}
                    placeholder="servo@paroquia.com"
                  />
                </div>
                <div>
                  <Label>CPF <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
                  <Input
                    value={formServo.cpf}
                    onChange={e => setFormServo(f => ({ ...f, cpf: mascaraCpf(e.target.value) }))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </div>
                <div>
                  <Label>Comunidade *</Label>
                  <Select value={formServo.comunidade_id} onValueChange={v => setFormServo(f => ({ ...f, comunidade_id: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a comunidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {comunidades.filter((c: any) => c.ativo).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Senha *</Label>
                  <div className="relative">
                    <Input
                      type={showSenhaServo ? 'text' : 'password'}
                      value={formServo.senha}
                      onChange={e => setFormServo(f => ({ ...f, senha: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowSenhaServo(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showSenhaServo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label>Repetir Senha *</Label>
                  <div className="relative">
                    <Input
                      type={showRepetirSenha ? 'text' : 'password'}
                      value={formServo.repetirSenha}
                      onChange={e => setFormServo(f => ({ ...f, repetirSenha: e.target.value }))}
                      placeholder="Confirme a senha"
                      className={`pr-10 ${formServo.repetirSenha && formServo.senha !== formServo.repetirSenha ? 'border-destructive' : ''}`}
                    />
                    <button type="button" onClick={() => setShowRepetirSenha(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showRepetirSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {formServo.repetirSenha && formServo.senha !== formServo.repetirSenha && (
                    <p className="text-destructive text-xs mt-1">As senhas não coincidem</p>
                  )}
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button
                    onClick={cadastrarServo}
                    disabled={cadastrandoServo}
                  >
                    {cadastrandoServo ? (
                      <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Cadastrando...</>
                    ) : (
                      <><UserPlus className="h-4 w-4 mr-2" />Cadastrar Colaborador</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Lista de colaboradores */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Colaboradores Cadastrados</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingServos ? (
                  <div className="p-8 text-center text-muted-foreground">Carregando...</div>
                ) : servos.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <HandHeart className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Nenhum colaborador cadastrado ainda.</p>
                    <p className="text-sm mt-1">Cadastre o primeiro colaborador usando o formulário acima.</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile cards */}
                    <div className="md:hidden divide-y divide-border">
                      {servos.map(servo => (
                        <div key={servo.id} className={`p-4 cursor-pointer hover:bg-muted/40 transition-colors space-y-2 ${!servo.ativo ? 'opacity-60' : ''}`} onClick={() => abrirEditarServo(servo)}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <HandHeart className="h-4 w-4 text-amber-500 shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{servo.nome}</p>
                                <p className="text-xs text-muted-foreground truncate">{servo.email || '-'}</p>
                              </div>
                            </div>
                            {servo.ativo ? (
                              <Badge className="bg-green-100 text-green-800 border-green-300 border text-xs shrink-0">Ativo</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs shrink-0">Inativo</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                            {servo.comunidade_nome && (
                              <Badge variant="outline" className="text-xs"><MapPin className="h-3 w-3 mr-1" />{servo.comunidade_nome}</Badge>
                            )}
                            <span>Desde {format(new Date(servo.created_at), 'dd/MM/yy', { locale: ptBR })}</span>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); abrirEditarServo(servo); }}>
                              <Pencil className="h-3.5 w-3.5 mr-1.5" />Editar
                            </Button>
                            <Button
                              variant="outline" size="sm"
                              onClick={(e) => { e.stopPropagation(); toggleServoAtivo(servo); }}
                              className={servo.ativo ? 'text-destructive border-destructive/30' : 'text-green-700 border-green-300'}
                            >
                              {servo.ativo ? <><UserX className="h-3.5 w-3.5 mr-1.5" />Inativar</> : <><UserCheck className="h-3.5 w-3.5 mr-1.5" />Ativar</>}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>E-mail</TableHead>
                            <TableHead>Comunidade</TableHead>
                            <TableHead>CPF</TableHead>
                            <TableHead>Desde</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {servos.map(servo => (
                            <TableRow key={servo.id} className={`cursor-pointer hover:bg-muted/50 ${!servo.ativo ? 'opacity-60' : ''}`} onClick={() => abrirEditarServo(servo)}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <HandHeart className="h-4 w-4 text-amber-500 shrink-0" />
                                  <span className="font-medium text-sm">{servo.nome}</span>
                                  {servo.ativo && (
                                    <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Admin</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{servo.email || '-'}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {servo.comunidade_nome ? (
                                  <Badge variant="outline" className="text-xs"><MapPin className="h-3 w-3 mr-1" />{servo.comunidade_nome}</Badge>
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground">{mascaraCpfOculto(servo.cpf)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {format(new Date(servo.created_at), 'dd/MM/yy', { locale: ptBR })}
                              </TableCell>
                              <TableCell>
                                {servo.ativo ? (
                                  <Badge className="bg-green-100 text-green-800 border-green-300 border text-xs">Ativo</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">Inativo</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); abrirEditarServo(servo); }}>
                                    <Pencil className="h-3.5 w-3.5 mr-1.5" />Editar
                                  </Button>
                                  <Button
                                    variant="outline" size="sm"
                                    onClick={(e) => { e.stopPropagation(); toggleServoAtivo(servo); }}
                                    className={servo.ativo ? 'text-destructive border-destructive/30 hover:bg-destructive/10' : 'text-green-700 border-green-300 hover:bg-green-50'}
                                  >
                                    {servo.ativo ? <><UserX className="h-3.5 w-3.5 mr-1.5" />Inativar</> : <><UserCheck className="h-3.5 w-3.5 mr-1.5" />Ativar</>}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Modal Editar Colaborador */}
            <Dialog open={!!editandoServo} onOpenChange={open => { if (!open) setEditandoServo(null); }}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Pencil className="h-4 w-4" />
                    Editar Colaborador
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nome Completo *</Label>
                    <Input
                      value={formEditServo.nome}
                      onChange={e => setFormEditServo(f => ({ ...f, nome: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>CPF <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
                    <Input
                      value={formEditServo.cpf}
                      onChange={e => setFormEditServo(f => ({ ...f, cpf: mascaraCpf(e.target.value) }))}
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                  </div>
                  <div>
                    <Label>Comunidade</Label>
                    <Select value={formEditServo.comunidade_id} onValueChange={v => setFormEditServo(f => ({ ...f, comunidade_id: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a comunidade" />
                      </SelectTrigger>
                      <SelectContent>
                        {comunidades.filter((c: any) => c.ativo).map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    E-mail: <span className="font-mono">{editandoServo?.email || '-'}</span> (não editável)
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditandoServo(null)}>Cancelar</Button>
                  <Button onClick={salvarEditServo} disabled={salvandoEditServo}>
                    {salvandoEditServo ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : <><Save className="h-4 w-4 mr-2" />Salvar</>}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* === ABA TEF / MAQUININHA === */}
          <TabsContent value="tef" className="space-y-4 mt-4">
            <ConfiguracoesTEF />
          </TabsContent>

          {/* === ABA AVISOS TOTEM === */}
          <TabsContent value="avisos" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5" />
                  Avisos do Totem
                </CardTitle>
                <Button size="sm" onClick={() => abrirModalAviso()}>
                  <Plus className="h-4 w-4 mr-1" /> Novo Aviso
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Avisos são exibidos em formato de slide na tela inicial do totem.
                </p>
                {avisos.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum aviso cadastrado.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ordem</TableHead>
                        <TableHead>Imagem</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Mensagem</TableHead>
                        <TableHead>Link</TableHead>
                        <TableHead>Cor</TableHead>
                        <TableHead>Ativo</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {avisos.map((aviso) => (
                        <TableRow key={aviso.id}>
                          <TableCell>{aviso.ordem}</TableCell>
                          <TableCell>
                            {aviso.imagem_url ? (
                              <img src={aviso.imagem_url} alt="" className="w-10 h-10 rounded object-cover" />
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell className="font-medium">{aviso.titulo}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{aviso.mensagem}</TableCell>
                          <TableCell>
                            {aviso.link_url ? (
                              <a href={aviso.link_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs flex items-center gap-1">
                                <ExternalLink className="h-3 w-3" /> Link
                              </a>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell>
                            {aviso.cor ? (
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: aviso.cor }} />
                                <span className="text-xs text-muted-foreground">{aviso.cor}</span>
                              </div>
                            ) : <span className="text-muted-foreground text-xs">Padrão</span>}
                          </TableCell>
                          <TableCell>
                            <Switch checked={aviso.ativo} onCheckedChange={() => toggleAvisoAtivo(aviso)} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" onClick={() => abrirModalAviso(aviso)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => excluirAviso(aviso.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === ABA COMUNIDADES === */}
          <TabsContent value="comunidades" className="space-y-4 mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Comunidades</h3>
                    <p className="text-xs text-muted-foreground">Gerencie as comunidades vinculadas aos dizimistas</p>
                  </div>
                  <Button size="sm" onClick={() => abrirModalComunidade()}>
                    <Plus className="h-4 w-4 mr-1" /> Nova
                  </Button>
                </div>
                {comunidades.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-6 text-center">Nenhuma comunidade cadastrada.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Ativa</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comunidades.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.nome}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{c.descricao || '-'}</TableCell>
                          <TableCell>
                            <Switch checked={c.ativo} onCheckedChange={() => toggleComunidadeAtiva(c)} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" onClick={() => abrirModalComunidade(c)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => excluirComunidade(c.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === ABA EMAIL AGRADECIMENTO === */}
          <TabsContent value="email" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  E-mail de Agradecimento — Resend
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Configure a integração com o Resend para envio automático de e-mails de agradecimento aos dizimistas após cada contribuição.
                  A API Key e o e-mail remetente são armazenados de forma segura no banco de dados.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Toggle ativo */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">E-mail de agradecimento ativo</Label>
                    <p className="text-xs text-muted-foreground">Quando ativado, um e-mail será enviado automaticamente após cada pagamento de dízimo confirmado.</p>
                  </div>
                  <Switch
                    checked={formEmail.email_agradecimento_ativo}
                    onCheckedChange={v => setFormEmail(f => ({ ...f, email_agradecimento_ativo: v }))}
                  />
                </div>

                {/* Credenciais */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FieldSecret
                    label={<span className="flex items-center gap-1"><Key className="h-3.5 w-3.5" /> API Key do Resend</span>}
                    value={formEmail.resend_api_key}
                    show={showResendKey}
                    onToggle={() => setShowResendKey(!showResendKey)}
                    onChange={v => setFormEmail(f => ({ ...f, resend_api_key: v }))}
                    placeholder="re_xxxxxxxxx..."
                  />
                  <div>
                    <Label className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> E-mail Remetente</Label>
                    <Input
                      type="email"
                      value={formEmail.resend_from_email}
                      onChange={e => setFormEmail(f => ({ ...f, resend_from_email: e.target.value }))}
                      placeholder="noreply@suaparoquia.com.br"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      O domínio deve estar verificado no Resend. Ex: noreply@suaparoquia.com.br
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={salvarEmailConfig} disabled={salvandoEmail}>
                    <Save className="h-4 w-4 mr-2" />
                    {salvandoEmail ? 'Salvando...' : 'Salvar Configurações'}
                  </Button>
                </div>

                {/* Teste de e-mail */}
                <div className="border-t pt-6">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Enviar E-mail de Teste
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Envia um e-mail simulado com dados fictícios para verificar se a integração está funcionando.
                    O e-mail será enviado mesmo se o envio automático estiver desativado.
                  </p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label>E-mail de destino</Label>
                      <Input
                        type="email"
                        value={emailTeste}
                        onChange={e => setEmailTeste(e.target.value)}
                        placeholder="seu@email.com"
                      />
                    </div>
                    <Button
                      onClick={enviarEmailTeste}
                      disabled={enviandoTeste || !formEmail.resend_api_key || !formEmail.resend_from_email}
                      variant="outline"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {enviandoTeste ? 'Enviando...' : 'Enviar Teste'}
                    </Button>
                  </div>
                  {(!formEmail.resend_api_key || !formEmail.resend_from_email) && (
                    <p className="text-xs text-amber-600 mt-2">
                      ⚠️ Salve as credenciais do Resend antes de enviar um teste.
                    </p>
                  )}
                </div>

                {/* E-mail de Aniversário */}
                <div className="border-t pt-6">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    🎂 E-mail de Aniversário
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Envia um e-mail especial de aniversário para todos os dizimistas ativos que fazem aniversário hoje.
                    Utiliza as mesmas credenciais do Resend configuradas acima.
                  </p>
                  <Button
                    variant="outline"
                    disabled={enviandoTeste || !formEmail.resend_api_key || !formEmail.resend_from_email || !formEmail.email_agradecimento_ativo}
                    onClick={async () => {
                      setEnviandoTeste(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('enviar-email-aniversario');
                        if (error) throw error;
                        if (data?.success) {
                          toast({ title: `🎂 ${data.enviados} e-mail(s) de aniversário enviado(s)!`, description: data.enviados === 0 ? 'Nenhum aniversariante hoje.' : undefined });
                        } else {
                          toast({ title: data?.error || data?.reason || 'Erro', variant: 'destructive' });
                        }
                      } catch (e: any) {
                        toast({ title: 'Erro ao enviar', description: e.message, variant: 'destructive' });
                      } finally {
                        setEnviandoTeste(false);
                      }
                    }}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Aniversários de Hoje
                  </Button>
                </div>

                {/* Instrução */}
                <div className="border-t pt-6">
                  <h3 className="text-sm font-semibold mb-2">Como configurar o Resend</h3>
                  <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                    <li>Acesse <a href="https://resend.com" target="_blank" rel="noopener" className="underline text-primary">resend.com</a> e crie uma conta gratuita (até 3.000 e-mails/mês).</li>
                    <li>Adicione e verifique o domínio da paróquia (DNS).</li>
                    <li>Gere uma API Key em <strong>API Keys → Create API Key</strong>.</li>
                    <li>Cole a chave no campo acima e defina o e-mail remetente com o domínio verificado.</li>
                    <li>Ative o envio automático e faça um teste!</li>
                  </ol>
                </div>
              </CardContent>
            </Card>

            <NotificacoesPushPanel />
          </TabsContent>

        </Tabs>
      </div>

      {/* Modal Aviso */}
      <Dialog open={modalAviso} onOpenChange={setModalAviso}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editandoAviso ? 'Editar Aviso' : 'Novo Aviso'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Título *</Label>
              <Input value={formAviso.titulo} onChange={e => setFormAviso(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Missa de Natal" />
            </div>
            <div>
              <Label>Mensagem *</Label>
              <Input value={formAviso.mensagem} onChange={e => setFormAviso(f => ({ ...f, mensagem: e.target.value }))} placeholder="Ex: Dia 25/12 às 20h na Igreja Matriz" />
            </div>
            <div>
              <Label>Imagem (opcional)</Label>
              <input ref={avisoFileRef} type="file" accept="image/*" className="hidden" onChange={handleAvisoFileChange} />
              {avisoImagePreview ? (
                <div className="flex items-center gap-3 mt-1">
                  <img src={avisoImagePreview} alt="" className="w-20 h-20 rounded-lg object-cover border" />
                  <div className="flex flex-col gap-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => avisoFileRef.current?.click()}>
                      <Upload className="h-3.5 w-3.5 mr-1" /> Trocar
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={removerAvisoImagem}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                    </Button>
                  </div>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" className="mt-1" onClick={() => avisoFileRef.current?.click()}>
                  <Image className="h-4 w-4 mr-1" /> Selecionar imagem
                </Button>
              )}
            </div>
            <div>
              <Label>Link de inscrição / ação (opcional)</Label>
              <Input value={formAviso.link_url} onChange={e => setFormAviso(f => ({ ...f, link_url: e.target.value }))} placeholder="https://forms.gle/..." />
              <p className="text-xs text-muted-foreground mt-1">Se preenchido, um QR Code será exibido no totem para o paroquiano escanear.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cor (hex opcional)</Label>
                <div className="flex gap-2">
                  <Input value={formAviso.cor} onChange={e => setFormAviso(f => ({ ...f, cor: e.target.value }))} placeholder="#FF6600" />
                  {formAviso.cor && <div className="w-10 h-10 rounded border shrink-0" style={{ backgroundColor: formAviso.cor }} />}
                </div>
              </div>
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={formAviso.ordem} onChange={e => setFormAviso(f => ({ ...f, ordem: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Exibir no modo descanso (tela cheia)</Label>
                  <p className="text-xs text-muted-foreground">Quando o totem fica ocioso, este aviso entra no carrossel em tela cheia com transições suaves.</p>
                </div>
                <Switch
                  checked={formAviso.tela_cheia}
                  onCheckedChange={v => setFormAviso(f => ({ ...f, tela_cheia: v }))}
                />
              </div>
              {formAviso.tela_cheia && (
                <div>
                  <Label className="text-xs">Duração na tela (segundos)</Label>
                  <Input
                    type="number"
                    min={4}
                    max={60}
                    value={formAviso.duracao_segundos}
                    onChange={e => setFormAviso(f => ({ ...f, duracao_segundos: Math.max(4, parseInt(e.target.value) || 8) }))}
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAviso(false)}>Cancelar</Button>
            <Button onClick={salvarAviso} disabled={salvandoAviso}>{salvandoAviso ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={modalMensagem} onOpenChange={setModalMensagem}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editandoMensagem ? 'Editar Mensagem' : 'Nova Mensagem'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Tipo de Contribuição</Label>
              <Select value={formMensagem.tipo || 'geral'} onValueChange={v => setFormMensagem(f => ({ ...f, tipo: v === 'geral' ? null : v }))}>
                <SelectTrigger><SelectValue placeholder="Geral (todos os tipos)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="geral">Geral (todos os tipos)</SelectItem>
                  <SelectItem value="dizimo">Dízimo</SelectItem>
                  <SelectItem value="oferta">Oferta</SelectItem>
                  <SelectItem value="campanha">Campanha</SelectItem>
                  <SelectItem value="eventual">Eventual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título *</Label>
              <Input value={formMensagem.titulo || ''} onChange={e => setFormMensagem(f => ({ ...f, titulo: e.target.value }))} />
            </div>
            <div>
              <Label>Mensagem *</Label>
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formMensagem.mensagem || ''}
                onChange={e => setFormMensagem(f => ({ ...f, mensagem: e.target.value }))}
                placeholder="Mensagem a exibir no comprovante..."
              />
            </div>
            <div>
              <Label>Versículo / Citação Bíblica</Label>
              <Input
                value={formMensagem.versiculo || ''}
                onChange={e => setFormMensagem(f => ({ ...f, versiculo: e.target.value }))}
                placeholder="Ex: Lc 3,34 · Sl 23,1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalMensagem(false)}>Cancelar</Button>
            <Button onClick={salvarMensagem} disabled={salvandoMensagem}>{salvandoMensagem ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal Comunidade */}
      <Dialog open={modalComunidade} onOpenChange={setModalComunidade}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editandoComunidade ? 'Editar Comunidade' : 'Nova Comunidade'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input value={formComunidade.nome} onChange={e => setFormComunidade(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: São José" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={formComunidade.descricao} onChange={e => setFormComunidade(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalComunidade(false)}>Cancelar</Button>
            <Button onClick={salvarComunidade} disabled={salvandoComunidade}>{salvandoComunidade ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PersonalizarComprovanteModal
        open={modalComprovanteOpen}
        onOpenChange={setModalComprovanteOpen}
        initialConfig={formParoquia.comprovante_config}
        initialPreset={formParoquia.impressora_preset}
        logoUrl={formParoquia.logo_termico_url || formParoquia.logo_url}
        nomeParoquia={formParoquia.nome}
        cnpjParoquia={formParoquia.cnpj}
        siteParoquia={formParoquia.site}
        telefoneParoquia={formParoquia.telefone}
        onSave={salvarComprovanteConfig}
      />

      {/* Modal: Logo da Paróquia na Carteirinha */}
      <Dialog open={modalLogoCarteirinha} onOpenChange={setModalLogoCarteirinha}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IdCard className="h-5 w-5 text-primary" />
              Logo da Paróquia na Carteirinha
            </DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Coluna upload */}
            <div className="space-y-4">
              <div>
                <Label>Upload do logo</Label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadandoLogoCart}
                    onClick={() => fileInputCartRef.current?.click()}
                  >
                    {uploadandoLogoCart ? (
                      <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Enviando…</>
                    ) : (
                      <><Upload className="h-4 w-4 mr-2" />Selecionar arquivo</>
                    )}
                  </Button>
                  {formParoquia.logo_carteirinha_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormParoquia(f => ({ ...f, logo_carteirinha_url: '' }))}
                    >
                      Remover
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputCartRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={handleLogoCarteirinhaUpload}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  PNG (transparente) ou SVG, preferencialmente <strong>quadrado</strong>, máx. 1.5MB.
                </p>
              </div>

              <div>
                <Label>Ou cole uma URL de imagem</Label>
                <Input
                  className="mt-1"
                  value={formParoquia.logo_carteirinha_url || ''}
                  onChange={e => setFormParoquia(f => ({ ...f, logo_carteirinha_url: e.target.value }))}
                  placeholder="https://…"
                />
              </div>

              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-foreground/80 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5 text-amber-600" />
                  Posicionamento na carteirinha
                </p>
                <ul className="list-disc pl-5 space-y-0.5">
                  <li><strong>Brasão da Diocese:</strong> canto superior <strong>esquerdo</strong> (fixo).</li>
                  <li><strong>Logo da Paróquia:</strong> canto superior <strong>direito</strong> (este upload).</li>
                  <li>Ambos ficam alinhados na mesma linha do título, em 9×9 mm.</li>
                </ul>
              </div>
            </div>

            {/* Coluna preview */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Pré-visualização (frente)</Label>
              <div className="flex justify-center bg-muted/30 p-4 rounded-lg">
                <CarteirinhaCard
                  nomeParoquia={formParoquia.nome || 'Nome da Paróquia'}
                  nomeCompleto="João da Silva"
                  cpf="00000000000"
                  registroId="DIZSC-00001"
                  dataInicio={new Date().toISOString().slice(0, 10)}
                  status="ativo"
                  fotoUrl={null}
                  logoParoquiaUrl={formParoquia.logo_carteirinha_url || null}
                  qrPayload="preview"
                  lado="frente"
                  width={340}
                />
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                A imagem será reduzida proporcionalmente a 9 × 9 mm na carteirinha real (85,6 × 54 mm).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalLogoCarteirinha(false)}>Fechar</Button>
            <Button onClick={() => { setModalLogoCarteirinha(false); salvarIdentidade(); }} disabled={salvandoIdentidade}>
              {salvandoIdentidade ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Salvando…</> : <><Save className="h-4 w-4 mr-2" />Salvar agora</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminConfiguracoes;
