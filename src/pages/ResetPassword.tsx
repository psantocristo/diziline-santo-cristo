import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound } from 'lucide-react';
import logoParoquia from '@/assets/logo-paroquia.png';

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Detectar se o link é de recovery
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || hash.includes('access_token')) {
      setIsRecovery(true);
    } else {
      // Verificar pelo onAuthStateChange
      supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsRecovery(true);
        }
      });
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: 'Senhas diferentes', description: 'As senhas não coincidem.', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'Senha fraca', description: 'A senha deve ter pelo menos 6 caracteres.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: 'Erro ao redefinir senha', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Senha redefinida! 🙏', description: 'Sua nova senha foi salva. Você será redirecionado.' });
      setTimeout(() => navigate('/login'), 2000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <img
            src={logoParoquia}
            alt="Logo Paróquia Senhor Santo Cristo dos Milagres"
            className="h-20 w-auto object-contain drop-shadow-lg"
          />
        </div>
        <h1 className="text-3xl font-bold text-primary mb-1">Dízimo Santo Cristo</h1>
        <p className="text-primary/70 text-sm">Paróquia Senhor Santo Cristo dos Milagres</p>
      </div>

      <Card className="w-full max-w-md shadow-lg border-primary/20">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-2">
            <KeyRound className="h-8 w-8 text-secondary" />
          </div>
          <CardTitle className="text-secondary text-xl">Redefinir senha</CardTitle>
          <CardDescription>
            {isRecovery
              ? 'Crie uma nova senha para sua conta'
              : 'Link de redefinição inválido ou expirado. Solicite um novo link na tela de login.'}
          </CardDescription>
        </CardHeader>

        {isRecovery && (
          <CardContent>
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <Label htmlFor="nova-senha">Nova senha</Label>
                <Input
                  id="nova-senha"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="mt-1 h-12 text-base"
                />
              </div>
              <div>
                <Label htmlFor="confirma-nova-senha">Confirmar nova senha</Label>
                <Input
                  id="confirma-nova-senha"
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  className="mt-1 h-12 text-base"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                Salvar nova senha
              </Button>
            </form>
          </CardContent>
        )}

        {!isRecovery && (
          <CardContent className="text-center pb-6">
            <Button
              variant="outline"
              onClick={() => navigate('/login')}
              className="mt-2"
            >
              Voltar ao login
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default ResetPassword;
