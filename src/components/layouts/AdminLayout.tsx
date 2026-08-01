import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, Users, CreditCard, 
  Megaphone, BarChart3, Settings, Shield, 
  LogOut, Menu, X, Home, ChevronRight, Keyboard, HandHeart, Monitor, Activity, Package, ShoppingBag, Award, ClipboardCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logoParoquiaFallback from '@/assets/logo-paroquia.png';
import AppFooter from '@/components/AppFooter';
import NotificacoesDropdown from '@/components/admin/NotificacoesDropdown';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { signOut, user, isSuperAdmin, role, isServo, nomeServo } = useAuth();
  const { tema } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const logoSrc = tema.logoUrl || logoParoquiaFallback;
  const superAdmin = isSuperAdmin();

  const navItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/pagamentos', icon: CreditCard, label: 'Pagamentos' },
    { path: '/admin/dizimistas', icon: Users, label: 'Dizimistas' },
    { path: '/admin/campanhas', icon: Megaphone, label: 'Campanhas' },
    { path: '/admin/kiosk', icon: Keyboard, label: 'Modo Kiosk' },
    { path: '/admin/produtos', icon: Package, label: 'Produtos' },
    { path: '/admin/pedidos', icon: ShoppingBag, label: 'Pedidos' },
    { path: '/admin/certificados', icon: Award, label: 'Certificados' },
    { path: '/admin/relatorios', icon: BarChart3, label: 'Relatórios' },
    ...(superAdmin ? [
      { path: '/admin/totens', icon: Monitor, label: 'Totens' },
      { path: '/admin/configuracoes', icon: Settings, label: 'Configurações' },
      { path: '/admin/diagnostico', icon: Activity, label: 'Diagnóstico' },
      { path: '/admin/checkup', icon: ClipboardCheck, label: 'Checkup' },
      { path: '/admin/auditoria', icon: Shield, label: 'Auditoria' },
    ] : []),
  ];

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const roleBadge = role === 'super_admin' ? 'Super Admin' : 'Admin';

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="bg-gradient-hero shadow-wine sticky top-0 z-40" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
        <div className="flex items-center justify-between px-4 py-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <img src={logoSrc} alt="Logo Paróquia" className="h-11 w-11 object-contain rounded shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight" style={{ color: 'rgba(255,255,255,0.95)' }}>Painel Administrativo</p>
              <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <NotificacoesDropdown />
            {/* Badges Colaborador logado */}
            {isServo && nomeServo && (
              <>
                <div className="hidden sm:flex items-center gap-1.5 bg-white/15 border border-white/30 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  <HandHeart className="h-3.5 w-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Colaborador: {nomeServo}</span>
                </div>
                <span className="hidden sm:inline-flex items-center bg-white/15 text-xs px-2 py-1 rounded-full font-semibold border border-white/30" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  Admin
                </span>
              </>
            )}
            {!isServo && (
              <span className="hidden sm:inline-block bg-white/15 text-xs px-2 py-1 rounded-full font-medium border border-white/30" style={{ color: 'rgba(255,255,255,0.9)' }}>
                {roleBadge}
              </span>
            )}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-lg hover:bg-white/10 lg:hidden" style={{ color: 'rgba(255,255,255,0.9)' }}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Badge colaborador mobile — abaixo do header */}
        {isServo && nomeServo && (
          <div className="sm:hidden flex items-center justify-center gap-1.5 bg-white/10 border-t border-white/20 px-4 py-1.5 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
            <HandHeart className="h-3.5 w-3.5 shrink-0" />
            <span>Colaborador: {nomeServo}</span>
          </div>
        )}

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
          </div>
        )}
      </header>

      <div className="flex flex-1">
        <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-r border-sidebar-border fixed h-full top-0 pt-14">
          <div className="p-4 flex-1 mt-4 overflow-y-auto">
            {/* Info do usuário na sidebar */}
            <div className="mb-4 px-3">
            {isServo && nomeServo ? (
                <div className="bg-amber-500/15 border border-amber-500/30 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-bold">
                      <HandHeart className="h-3.5 w-3.5" />
                      Colaborador
                    </div>
                    <span className="text-xs font-semibold text-primary bg-primary/15 border border-primary/25 px-1.5 py-0.5 rounded-full leading-none">
                      Admin
                    </span>
                  </div>
                  <p className="text-amber-700 dark:text-amber-300 text-sm font-semibold leading-tight">{nomeServo}</p>
                </div>
              ) : (
                <div className="bg-primary/10 rounded-lg px-3 py-2">
                  <p className="text-sidebar-foreground/50 text-xs">{roleBadge}</p>
                </div>
              )}
            </div>
            <p className="text-sidebar-foreground/50 text-xs font-medium uppercase tracking-wider px-3 mb-2">
              Administração
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
          </div>
          <div className="p-4 border-t border-sidebar-border">
            <Link to="/paroquiano">
              <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/60 mb-1">
                <Home className="h-4 w-4 mr-2" />
                Área Paroquiano
              </Button>
            </Link>
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

        <main className="flex-1 lg:ml-64 p-3 md:p-6 animate-in fade-in duration-300">
          {children}
        </main>
      </div>
      <div className="lg:ml-64">
        <AppFooter />
      </div>
    </div>
  );
};

export default AdminLayout;
