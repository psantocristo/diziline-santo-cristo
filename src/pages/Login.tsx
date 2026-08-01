import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import logoParoquiaFallback from '@/assets/logo-paroquia.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { validarCPF, formatarCPF, limparCPF } from '@/lib/cpf';

interface Comunidade {
  id: string;
  nome: string;
}

const Login = () => {
  const { signIn } = useAuth();
  const { tema } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [welcomeData, setWelcomeData] = useState<{ nome: string; matricula: string; email: string } | null>(null);

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [cadastroData, setCadastroData] = useState({
    nome: '', email: '', password: '', confirmPassword: '',
    cpf: '', telefone: '', data_nascimento: '', comunidade_id: '',
    estado_civil: '', melhor_dia_pagamento: '',
  });
  const [membrosFamilia, setMembrosFamilia] = useState<{ nome: string; parentesco: string; data_nascimento: string }[]>([]);

  const { data: comunidadesData } = useQuery({
    queryKey: ['comunidades-ativas'],
    queryFn: async () => {
      const { data } = await supabase.from('comunidades').select('id, nome').eq('ativo', true).order('nome');
      return (data || []) as Comunidade[];
    },
    enabled: !!tema.cadastroAberto,
    staleTime: 10 * 60 * 1000,
  });
  const comunidades = comunidadesData || [];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(loginData.email, loginData.password);
    if (error) {
      toast({ title: 'Erro ao entrar', description: 'Email ou senha incorretos.', variant: 'destructive' });
    } else {
      navigate('/');
    }
    setLoading(false);
  };

  const handleCpfChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 9) formatted = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
    else if (digits.length > 6) formatted = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
    else if (digits.length > 3) formatted = `${digits.slice(0,3)}.${digits.slice(3)}`;
    setCadastroData(p => ({ ...p, cpf: formatted }));
  };

  const handleTelefoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 6) formatted = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
    else if (digits.length > 2) formatted = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
    setCadastroData(p => ({ ...p, telefone: formatted }));
  };

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (cadastroData.password !== cadastroData.confirmPassword) {
      toast({ title: 'Senhas diferentes', description: 'As senhas não coincidem.', variant: 'destructive' });
      return;
    }
    if (cadastroData.password.length < 6) {
      toast({ title: 'Senha fraca', description: 'A senha deve ter pelo menos 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (!validarCPF(cadastroData.cpf)) {
      toast({ title: 'CPF inválido', description: 'Verifique o CPF informado.', variant: 'destructive' });
      return;
    }
    if (!cadastroData.data_nascimento) {
      toast({ title: 'Data de nascimento', description: 'Informe sua data de nascimento.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('register-dizimista', {
        body: {
          nome_completo: cadastroData.nome,
          email: cadastroData.email,
          senha: cadastroData.password,
          cpf: limparCPF(cadastroData.cpf),
          telefone: cadastroData.telefone.replace(/\D/g, '') || null,
          data_nascimento: cadastroData.data_nascimento,
          comunidade_id: cadastroData.comunidade_id || null,
          estado_civil: cadastroData.estado_civil || null,
          melhor_dia_pagamento: cadastroData.melhor_dia_pagamento ? parseInt(cadastroData.melhor_dia_pagamento, 10) : null,
          membros_familia: membrosFamilia.filter(m => m.nome.trim()),
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Erro no cadastro', description: data.error, variant: 'destructive' });
      } else {
        setWelcomeData({ nome: data.nome, matricula: data.matricula, email: cadastroData.email });
        setWelcomeOpen(true);
        setCadastroData({ nome: '', email: '', password: '', confirmPassword: '', cpf: '', telefone: '', data_nascimento: '', comunidade_id: '', estado_civil: '', melhor_dia_pagamento: '' });
        setMembrosFamilia([]);
      }
    } catch (err: any) {
      toast({ title: 'Erro no cadastro', description: err.message || 'Erro inesperado', variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <img
            src={tema.logoUrl || logoParoquiaFallback}
            alt="Logo Paróquia"
            className="h-24 w-auto object-contain drop-shadow-lg"
          />
        </div>
        <h1 className="text-3xl font-bold text-primary mb-1">{tema.nome || 'Dízimo Santo Cristo'}</h1>
        <p className="text-primary/70 text-sm">{tema.nome ? tema.nome : 'Paróquia Senhor Santo Cristo dos Milagres'}</p>
        <p className="text-primary/50 text-xs mt-1 italic">{tema.slogan || '"Sua contribuição sustenta a missão da fé"'}</p>
      </div>

      <Card className="w-full max-w-md shadow-lg border-primary/20">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-secondary text-xl">Acesse sua conta</CardTitle>
          <CardDescription>Entre ou cadastre-se como dizimista</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className={`mb-6 ${tema.cadastroAberto ? 'grid w-full grid-cols-2' : 'w-full'}`}>
              <TabsTrigger value="login">Entrar</TabsTrigger>
              {tema.cadastroAberto && <TabsTrigger value="cadastro">Cadastrar</TabsTrigger>}
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="email-login">Email</Label>
                  <Input id="email-login" type="email" placeholder="seu@email.com" value={loginData.email} onChange={e => setLoginData(p => ({ ...p, email: e.target.value }))} required className="mt-1 h-12 text-base" />
                </div>
                <div>
                  <Label htmlFor="senha-login">Senha</Label>
                  <Input id="senha-login" type="password" placeholder="••••••••" value={loginData.password} onChange={e => setLoginData(p => ({ ...p, password: e.target.value }))} required className="mt-1 h-12 text-base" />
                </div>
                <Button type="submit" className="w-full h-12 text-base font-semibold bg-secondary hover:bg-secondary/90 text-secondary-foreground" disabled={loading}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                  Entrar
                </Button>
              </form>
            </TabsContent>

            {!tema.cadastroAberto && (
              <div className="mt-4 p-4 rounded-lg bg-muted/60 border border-border text-center">
                <p className="text-sm text-muted-foreground">
                  📋 Cadastros desabilitados. Procure a secretaria da paróquia.
                </p>
              </div>
            )}

            {tema.cadastroAberto && (
              <TabsContent value="cadastro">
                <form onSubmit={handleCadastro} className="space-y-4">
                  {/* Seção: Dados pessoais */}
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados pessoais</p>
                  <div>
                    <Label htmlFor="nome-cadastro">Nome completo *</Label>
                    <Input id="nome-cadastro" type="text" placeholder="Seu nome completo" value={cadastroData.nome} onChange={e => setCadastroData(p => ({ ...p, nome: e.target.value }))} required className="mt-1 h-12 text-base" />
                  </div>
                  <div>
                    <Label htmlFor="cpf-cadastro">CPF *</Label>
                    <Input id="cpf-cadastro" inputMode="numeric" placeholder="000.000.000-00" value={cadastroData.cpf} onChange={e => handleCpfChange(e.target.value)} required className="mt-1 h-12 text-base" />
                  </div>
                  <div>
                    <Label htmlFor="nascimento-cadastro">Data de nascimento *</Label>
                    <Input id="nascimento-cadastro" type="date" value={cadastroData.data_nascimento} onChange={e => setCadastroData(p => ({ ...p, data_nascimento: e.target.value }))} required className="mt-1 h-12 text-base" />
                  </div>
                  <div>
                    <Label htmlFor="telefone-cadastro">Telefone</Label>
                    <Input id="telefone-cadastro" inputMode="numeric" placeholder="(00) 00000-0000" value={cadastroData.telefone} onChange={e => handleTelefoneChange(e.target.value)} className="mt-1 h-12 text-base" />
                  </div>
                  <div>
                    <Label htmlFor="estado-civil">Estado civil</Label>
                    <Select value={cadastroData.estado_civil} onValueChange={v => setCadastroData(p => ({ ...p, estado_civil: v }))}>
                      <SelectTrigger className="mt-1 h-12 text-base">
                        <SelectValue placeholder="Selecione (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                        <SelectItem value="casado">Casado(a)</SelectItem>
                        <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                        <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="melhor-dia">Melhor dia para pagar o dízimo</Label>
                    <Select value={cadastroData.melhor_dia_pagamento} onValueChange={v => setCadastroData(p => ({ ...p, melhor_dia_pagamento: v }))}>
                      <SelectTrigger className="mt-1 h-12 text-base">
                        <SelectValue placeholder="Escolha um dia (opcional)" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                          <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground mt-1">📲 Enviaremos um lembrete neste dia (se ativar notificações no app).</p>
                  </div>


                  {/* Seção: Membros da Família */}
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Membros da família</p>
                  {membrosFamilia.map((membro, idx) => (
                    <div key={idx} className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Membro {idx + 1}</span>
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setMembrosFamilia(prev => prev.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input placeholder="Nome completo" value={membro.nome} onChange={e => { const upd = [...membrosFamilia]; upd[idx] = { ...upd[idx], nome: e.target.value }; setMembrosFamilia(upd); }} className="h-10 text-sm" />
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={membro.parentesco} onValueChange={v => { const upd = [...membrosFamilia]; upd[idx] = { ...upd[idx], parentesco: v }; setMembrosFamilia(upd); }}>
                          <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Parentesco" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="conjuge">Cônjuge</SelectItem>
                            <SelectItem value="filho">Filho(a)</SelectItem>
                            <SelectItem value="pai">Pai</SelectItem>
                            <SelectItem value="mae">Mãe</SelectItem>
                            <SelectItem value="irmao">Irmão(ã)</SelectItem>
                            <SelectItem value="outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input type="date" placeholder="Nascimento" value={membro.data_nascimento} onChange={e => { const upd = [...membrosFamilia]; upd[idx] = { ...upd[idx], data_nascimento: e.target.value }; setMembrosFamilia(upd); }} className="h-10 text-sm" />
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setMembrosFamilia(prev => [...prev, { nome: '', parentesco: '', data_nascimento: '' }])}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar membro
                  </Button>

                  {/* Seção: Comunidade */}
                  {comunidades.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Comunidade</p>
                      <div>
                        <Label htmlFor="comunidade-cadastro">Comunidade paroquial</Label>
                        <Select value={cadastroData.comunidade_id} onValueChange={v => setCadastroData(p => ({ ...p, comunidade_id: v }))}>
                          <SelectTrigger className="mt-1 h-12 text-base">
                            <SelectValue placeholder="Selecione (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                            {comunidades.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {/* Seção: Acesso */}
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Dados de acesso</p>
                  <div>
                    <Label htmlFor="email-cadastro">Email *</Label>
                    <Input id="email-cadastro" type="email" placeholder="seu@email.com" value={cadastroData.email} onChange={e => setCadastroData(p => ({ ...p, email: e.target.value }))} required className="mt-1 h-12 text-base" />
                  </div>
                  <div>
                    <Label htmlFor="senha-cadastro">Senha *</Label>
                    <Input id="senha-cadastro" type="password" placeholder="Mínimo 6 caracteres" value={cadastroData.password} onChange={e => setCadastroData(p => ({ ...p, password: e.target.value }))} required className="mt-1 h-12 text-base" />
                  </div>
                  <div>
                    <Label htmlFor="confirma-senha">Confirmar senha *</Label>
                    <Input id="confirma-senha" type="password" placeholder="Repita a senha" value={cadastroData.confirmPassword} onChange={e => setCadastroData(p => ({ ...p, confirmPassword: e.target.value }))} required className="mt-1 h-12 text-base" />
                  </div>
                  <Button type="submit" className="w-full h-12 text-base font-semibold bg-secondary hover:bg-secondary/90 text-secondary-foreground" disabled={loading}>
                    {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                    Criar conta de dizimista
                  </Button>
                </form>
              </TabsContent>
            )}
          </Tabs>

          <div className="mt-6 text-center">
            <Link to="/" className="text-sm text-muted-foreground hover:text-primary underline">
              ← Voltar à página inicial
            </Link>
          </div>
        </CardContent>
      </Card>

      <p className="text-primary/40 text-xs mt-6 text-center">
        🔒 Seus dados estão protegidos com segurança
      </p>

      {/* Modal de boas-vindas */}
      <Dialog open={welcomeOpen} onOpenChange={setWelcomeOpen}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader className="items-center">
            <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-4 mb-2">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-2xl">
              Bem-vindo(a), {welcomeData?.nome?.split(' ')[0]}! 🙏
            </DialogTitle>
            <DialogDescription className="text-base space-y-3 pt-2">
              <p>Sua conta de dizimista foi criada com sucesso!</p>
              <div className="bg-muted rounded-lg p-4 text-left space-y-2">
                <p className="text-sm">
                  <span className="font-medium text-foreground">Matrícula:</span>{' '}
                  <span className="font-mono font-bold text-primary">{welcomeData?.matricula}</span>
                </p>
                <p className="text-sm">
                  <span className="font-medium text-foreground">Email:</span>{' '}
                  {welcomeData?.email}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                📧 Enviamos um e-mail de confirmação para <strong>{welcomeData?.email}</strong>. Após confirmar, você poderá acessar sua área e contribuir.
              </p>
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setWelcomeOpen(false)} className="mt-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground">
            Entendido
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
