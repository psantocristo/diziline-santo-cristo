import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Loader2 } from "lucide-react";

import ErrorBoundary from "./components/ErrorBoundary";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Totem from "./pages/Totem";
import ProtectedRoute from "./components/ProtectedRoute";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import TermosUso from "./pages/TermosUso";
import VerificarCarteirinha from "./pages/VerificarCarteirinha";
import Apresentacao from "./pages/Apresentacao";
import { lazyWithRetry } from "./lib/lazy-with-retry";

// Lazy-loaded pages — admin
const AdminDashboard = lazyWithRetry(() => import("./pages/admin/Dashboard"));
const AdminPagamentos = lazyWithRetry(() => import("./pages/admin/Pagamentos"));
const AdminDizimistas = lazyWithRetry(() => import("./pages/admin/Dizimistas"));
const AdminCampanhas = lazyWithRetry(() => import("./pages/admin/Campanhas"));
const AdminRelatorios = lazyWithRetry(() => import("./pages/admin/Relatorios"));
const AdminKiosk = lazyWithRetry(() => import("./pages/admin/Kiosk"));
const AdminConfiguracoes = lazyWithRetry(() => import("./pages/admin/Configuracoes"));
const AdminAuditoria = lazyWithRetry(() => import("./pages/admin/Auditoria"));
const AdminTotens = lazyWithRetry(() => import("./pages/admin/Totens"));
const AdminDiagnostico = lazyWithRetry(() => import("./pages/admin/Diagnostico"));
const AdminCheckup = lazyWithRetry(() => import("./pages/admin/Checkup"));
const AdminProdutos = lazyWithRetry(() => import("./pages/admin/Produtos"));
const AdminPedidos = lazyWithRetry(() => import("./pages/admin/Pedidos"));
const AdminCertificados = lazyWithRetry(() => import("./pages/admin/Certificados"));

// Lazy-loaded pages — paroquiano
const ParoquianoDashboard = lazyWithRetry(() => import("./pages/paroquiano/Dashboard"));
const Contribuir = lazyWithRetry(() => import("./pages/paroquiano/Contribuir"));
const Historico = lazyWithRetry(() => import("./pages/paroquiano/Historico"));
const Comprovantes = lazyWithRetry(() => import("./pages/paroquiano/Comprovantes"));
const ParoquianoLoja = lazyWithRetry(() => import("./pages/paroquiano/Loja"));
const MinhaConta = lazyWithRetry(() => import("./pages/paroquiano/MinhaConta"));
const Ajustes = lazyWithRetry(() => import("./pages/paroquiano/Ajustes"));
const Carteirinha = lazyWithRetry(() => import("./pages/paroquiano/Carteirinha"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Carregando...</p>
    </div>
  </div>
);

const AppRedirect = () => {
  const { user, role, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (role === 'admin' || role === 'super_admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/paroquiano" replace />;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/" element={<AppRedirect />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/totem" element={<Totem />} />
                  <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
                  <Route path="/termos-de-uso" element={<TermosUso />} />
                  <Route path="/v/:token" element={<VerificarCarteirinha />} />
                  <Route path="/apresentacao" element={<Apresentacao />} />

                  {/* Área do Paroquiano */}
                  <Route path="/paroquiano" element={<ProtectedRoute><ParoquianoDashboard /></ProtectedRoute>} />
                  <Route path="/paroquiano/contribuir" element={<ProtectedRoute><Contribuir /></ProtectedRoute>} />
                  <Route path="/paroquiano/historico" element={<ProtectedRoute><Historico /></ProtectedRoute>} />
                  <Route path="/paroquiano/comprovantes" element={<ProtectedRoute><Comprovantes /></ProtectedRoute>} />
                  <Route path="/paroquiano/loja" element={<ProtectedRoute><ParoquianoLoja /></ProtectedRoute>} />
                  <Route path="/paroquiano/minha-conta" element={<ProtectedRoute><MinhaConta /></ProtectedRoute>} />
                  <Route path="/paroquiano/carteirinha" element={<ProtectedRoute><Carteirinha /></ProtectedRoute>} />
                  <Route path="/paroquiano/ajustes" element={<ProtectedRoute><Ajustes /></ProtectedRoute>} />

                  {/* Área Admin */}
                  <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
                  <Route path="/admin/pagamentos" element={<ProtectedRoute requireAdmin><AdminPagamentos /></ProtectedRoute>} />
                  <Route path="/admin/dizimistas" element={<ProtectedRoute requireAdmin><AdminDizimistas /></ProtectedRoute>} />
                  <Route path="/admin/campanhas" element={<ProtectedRoute requireAdmin><AdminCampanhas /></ProtectedRoute>} />
                  <Route path="/admin/relatorios" element={<ProtectedRoute requireAdmin><AdminRelatorios /></ProtectedRoute>} />
                  <Route path="/admin/kiosk" element={<ProtectedRoute requireAdmin><AdminKiosk /></ProtectedRoute>} />
                  <Route path="/admin/produtos" element={<ProtectedRoute requireAdmin><AdminProdutos /></ProtectedRoute>} />
                  <Route path="/admin/pedidos" element={<ProtectedRoute requireAdmin><AdminPedidos /></ProtectedRoute>} />
                  <Route path="/admin/certificados" element={<ProtectedRoute requireAdmin><AdminCertificados /></ProtectedRoute>} />
                  {/* Super Admin only */}
                  <Route path="/admin/totens" element={<ProtectedRoute requireSuperAdmin><AdminTotens /></ProtectedRoute>} />
                  <Route path="/admin/configuracoes" element={<ProtectedRoute requireSuperAdmin><AdminConfiguracoes /></ProtectedRoute>} />
                  <Route path="/admin/auditoria" element={<ProtectedRoute requireSuperAdmin><AdminAuditoria /></ProtectedRoute>} />
                  <Route path="/admin/diagnostico" element={<ProtectedRoute requireSuperAdmin><AdminDiagnostico /></ProtectedRoute>} />
                  <Route path="/admin/checkup" element={<ProtectedRoute requireSuperAdmin><AdminCheckup /></ProtectedRoute>} />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
