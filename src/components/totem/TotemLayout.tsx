import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import logoParoquiaFallback from "@/assets/logo-paroquia.png";
import { supabase } from "@/integrations/supabase/client";


interface TotemLayoutProps {
  children: React.ReactNode;
  idleSeconds?: number;
  onIdleWarning?: boolean;
}

const TotemLayout: React.FC<TotemLayoutProps> = ({ children, idleSeconds, onIdleWarning }) => {
  const { tema } = useTheme();
  const logoSrc = tema.logoUrl || logoParoquiaFallback;
  const warningThreshold = 30;
  const showWarning = onIdleWarning && idleSeconds !== undefined && idleSeconds <= warningThreshold;

  const [paroquiaInfo, setParoquiaInfo] = useState<{ nome: string | null; cnpj: string | null }>({ nome: null, cnpj: null });

  useEffect(() => {
    supabase.rpc("get_tema_paroquia").then(({ data }) => {
      if (data) {
        setParoquiaInfo({
          nome: (data as any).nome || null,
          cnpj: (data as any).cnpj || null,
        });
      }
    });
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "hsl(var(--secondary))" }}
    >
      {/* Cabeçalho */}
      <header className="flex items-center justify-between gap-4 px-4 sm:px-8 lg:px-12 py-4 sm:py-6 border-b border-white/10">
        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
          <img
            src={logoSrc}
            alt="Logo Paróquia"
            className="h-14 sm:h-16 md:h-20 w-auto object-contain shrink-0 drop-shadow-md"
          />

          <div className="min-w-0">
            <p className="text-primary font-bold uppercase" style={{ fontSize: "clamp(11px, 1.2vw, 14px)", letterSpacing: 2 }}>
              Paróquia
            </p>
            <h1 className="text-secondary-foreground font-bold leading-tight truncate" style={{ fontSize: "clamp(16px, 1.8vw, 22px)" }}>
              Senhor Santo Cristo dos Milagres
            </h1>
          </div>
        </div>

        {/* Timer de inatividade */}
        {idleSeconds !== undefined && (
          <div
            className={`flex items-center gap-2 px-3 sm:px-5 py-2 rounded-full border shrink-0 transition-colors ${
              showWarning
                ? "bg-destructive/20 border-destructive text-destructive-foreground"
                : "bg-white/10 border-white/20 text-secondary-foreground/70"
            }`}
          >
            <span className="hidden sm:inline" style={{ fontSize: 14 }}>
              {showWarning ? "⚠️ Encerrando em" : "Sessão encerra em"}
            </span>
            <span
              className="font-mono font-bold"
              style={{ fontSize: 18, color: showWarning ? "hsl(var(--destructive))" : "hsl(var(--primary))" }}
            >
              {Math.floor(idleSeconds / 60)}:{String(idleSeconds % 60).padStart(2, "0")}
            </span>
          </div>
        )}
      </header>

      {/* Conteúdo principal */}
      <main className="flex-1 flex items-start sm:items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-5xl">{children}</div>
      </main>

      {/* Rodapé */}
      <footer className="text-center py-3 border-t border-white/10 px-6">
        <div className="flex flex-col items-center gap-1">
          {(paroquiaInfo.nome || paroquiaInfo.cnpj) && (
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
              {paroquiaInfo.nome && <span>{paroquiaInfo.nome}</span>}
              {paroquiaInfo.nome && paroquiaInfo.cnpj && <span className="mx-2">·</span>}
              {paroquiaInfo.cnpj && <span>CNPJ: {paroquiaInfo.cnpj.replace(/\D/g, "").replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}</span>}
            </p>
          )}
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }} className="flex items-center gap-3">
            <span>v1.2.1 · Desenvolvido por: Sem. Guthierres</span>
          </div>

          
        </div>
      </footer>
    </div>
  );
};

export default TotemLayout;
