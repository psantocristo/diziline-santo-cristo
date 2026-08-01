import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Church, HandCoins, Clock, FileText, User,
  LogOut, Menu, X, Home, ChevronRight, ShoppingBag, Shield, Settings, RefreshCw, IdCard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AppFooter from '@/components/AppFooter';

interface ParoquianoLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/paroquiano', icon: Home, label: 'Início' },
  { path: '/paroquiano/contribuir', icon: HandCoins, label: 'Contribuir' },
  { path: '/paroquiano/historico', icon: Clock, label: 'Histórico' },
  { path: '/paroquiano/comprovantes', icon: FileText, label: 'Comprovantes' },
  { path: '/paroquiano/carteirinha', icon: IdCard, label: 'Carteirinha' },
  { path: '/paroquiano/loja', icon: ShoppingBag, label: 'Loja' },
  { path: '/paroquiano/minha-conta', icon: User, label: 'Minha Conta' },
  { path: '/paroquiano/ajustes', icon: Settings, label: 'Ajustes' },
];

const ParoquianoLayout: React.FC<ParoquianoLayoutProps> = ({ children }) => {
  const { signOut, user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries();
      await queryClient.refetchQueries();
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.update();
      }
      toast({ title: 'Atualizado!', description: 'Informações sincronizadas.' });
    } catch {
      toast({ title: 'Não foi possível atualizar', variant: 'destructive' });
    }
    setRefreshing(false);
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-gradient-hero shadow-wine sticky top-0 z-40" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Church className="h-6 w-6" style={{ color: 'rgba(255,255,255,0.9)' }} />
            <div>
              <p className="font-bold text-sm leading-tight" style={{ color: 'rgba(255,255,255,0.95)' }}>Dízimo Santo Cristo</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-lg hover:bg-white/10 lg:hidden"
            style={{ color: 'rgba(255,255,255,0.9)' }}
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="bg-secondary/95 backdrop-blur px-4 pb-4 lg:hidden">
            {navItems.map(({ path, icon: Icon, label }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 py-3 px-3 rounded-lg mb-1 text-sm font-medium transition-colors",
                  location.pathname === path
                    ? "bg-white/20"
                    : "hover:bg-white/10"
                )}
                style={{ color: 'rgba(255,255,255,0.9)' }}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            ))}
            {isAdmin() && (
              <Link
                to="/admin"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 py-3 px-3 rounded-lg mb-1 text-sm font-medium bg-primary/20 hover:bg-primary/30 mt-2"
                style={{ color: 'rgba(255,255,255,0.95)' }}
              >
                <Shield className="h-5 w-5" />
                Painel admin
              </Link>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-3 py-3 px-3 rounded-lg w-full text-sm font-medium hover:bg-white/10 mt-2 disabled:opacity-60"
              style={{ color: 'rgba(255,255,255,0.9)' }}
            >
              <RefreshCw className={cn("h-5 w-5", refreshing && "animate-spin")} />
              {refreshing ? 'Atualizando…' : 'Atualizar'}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 py-3 px-3 rounded-lg w-full text-sm font-medium hover:bg-white/10 mt-1"
              style={{ color: 'rgba(255,200,200,0.9)' }}
            >
              <LogOut className="h-5 w-5" />
              Sair
            </button>
          </div>
        )}
      </header>

      <div className="flex flex-1">
        <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-r border-sidebar-border fixed h-full top-0 pt-16">
          <div className="p-4 flex-1 mt-4">
            <p className="text-sidebar-foreground/50 text-xs font-medium uppercase tracking-wider px-3 mb-2">
              Menu
            </p>
            {navItems.map(({ path, icon: Icon, label }) => (
              <Link
                key={path}
                to={path}
                className={cn(
                  "flex items-center gap-3 py-3 px-3 rounded-lg mb-1 text-sm font-medium transition-colors",
                  location.pathname === path
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
                {location.pathname === path && <ChevronRight className="h-4 w-4 ml-auto" />}
              </Link>
            ))}
            {isAdmin() && (
              <Link
                to="/admin"
                className="flex items-center gap-3 py-3 px-3 rounded-lg mt-3 text-sm font-medium bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
              >
                <Shield className="h-5 w-5" />
                Painel admin
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Link>
            )}
          </div>
          <div className="p-4 border-t border-sidebar-border space-y-1">
            <Button
              variant="ghost"
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <RefreshCw className={cn("h-5 w-5 mr-2", refreshing && "animate-spin")} />
              {refreshing ? 'Atualizando…' : 'Atualizar'}
            </Button>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-5 w-5 mr-2" />
              Sair
            </Button>
          </div>
        </aside>

        <main className="flex-1 lg:ml-64 p-4 md:p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>
      <div className="lg:ml-64 hidden lg:block">
        <AppFooter />
      </div>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-sidebar border-t border-sidebar-border z-40">
        <div className="flex">
          {navItems.slice(0, 4).map(({ path, icon: Icon, label }) => (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex-1 flex flex-col items-center py-2 text-xs transition-colors",
                location.pathname === path
                  ? "text-sidebar-primary"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-5 w-5 mb-0.5" />
              {label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="flex-1 flex flex-col items-center py-2 text-xs text-destructive"
          >
            <LogOut className="h-5 w-5 mb-0.5" />
            Sair
          </button>
        </div>
      </nav>
    </div>
  );
};

export default ParoquianoLayout;
