import React, { useEffect, useState } from "react";
import { HandCoins, Gift, Heart, Megaphone, Wifi, WifiOff, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import TotemAvisos from "@/components/totem/TotemAvisos";
import TotemAvisosModal from "@/components/totem/TotemAvisosModal";
import { isLocalClientRunning } from "@/lib/local-client";
import { getCached, setCache } from "@/lib/cache";

type TipoContribuicao = "dizimo" | "oferta" | "campanha" | "eventual";

interface TotemInicioProps {
  onSelect: (tipo: TipoContribuicao) => void;
  onLoja?: () => void;
  lojaAtiva?: boolean;
}

const opcoes = [
  {
    tipo: "dizimo" as TipoContribuicao,
    label: "Dízimo",
    descricao: "Contribuição mensal do dizimista",
    icon: HandCoins,
    color: "hsl(var(--primary))",
    bg: "hsl(var(--primary) / 0.15)",
    border: "hsl(var(--primary) / 0.4)",
    sempreAtivo: true,
  },
  {
    tipo: "oferta" as TipoContribuicao,
    label: "Oferta",
    descricao: "Oferta espontânea à paróquia",
    icon: Gift,
    color: "hsl(var(--accent-foreground))",
    bg: "hsl(var(--accent) / 0.15)",
    border: "hsl(var(--accent-foreground) / 0.25)",
    sempreAtivo: true,
  },
  {
    tipo: "eventual" as TipoContribuicao,
    label: "Doação",
    descricao: "Doação para obra ou projeto social",
    icon: Heart,
    color: "hsl(var(--destructive))",
    bg: "hsl(var(--destructive) / 0.12)",
    border: "hsl(var(--destructive) / 0.3)",
    sempreAtivo: true,
  },
  {
    tipo: "campanha" as TipoContribuicao,
    label: "Campanha",
    descricao: "Contribuir para uma campanha especial",
    icon: Megaphone,
    color: "hsl(40 80% 70%)",
    bg: "hsl(40 80% 70% / 0.12)",
    border: "hsl(40 80% 70% / 0.35)",
    sempreAtivo: false,
  },
];

const TotemInicio: React.FC<TotemInicioProps> = ({ onSelect, onLoja, lojaAtiva }) => {
  const [temCampanhaAtiva, setTemCampanhaAtiva] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [clientOnline, setClientOnline] = useState<boolean | null>(null);
  const [avisosModal, setAvisosModal] = useState<any[] | null>(null);

  useEffect(() => {
    const verificarCampanhas = async () => {
      const cached = getCached<boolean>("totem_tem_campanha");
      if (cached !== null) {
        setTemCampanhaAtiva(cached);
        setCarregando(false);
        return;
      }
      const { count } = await supabase
        .from("campanhas")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true);
      const resultado = (count ?? 0) > 0;
      setTemCampanhaAtiva(resultado);
      setCache("totem_tem_campanha", resultado);
      setCarregando(false);
    };
    verificarCampanhas();
    isLocalClientRunning().then(setClientOnline);
  }, []);

  const isAtivo = (tipo: TipoContribuicao, sempreAtivo: boolean) => {
    if (sempreAtivo) return true;
    if (tipo === "campanha") return temCampanhaAtiva;
    return true;
  };

  return (
    <div className="text-center space-y-6 sm:space-y-8 lg:space-y-10">
      {/* Saudação */}
      <div className="space-y-2 sm:space-y-3">
        <h2
          className="font-bold text-secondary-foreground"
          style={{ fontSize: "clamp(26px, 3.6vw, 40px)", lineHeight: 1.2 }}
        >
          Bem-vindo!
        </h2>
        <p className="text-secondary-foreground/60" style={{ fontSize: "clamp(15px, 1.8vw, 22px)" }}>
          Toque em uma das opções abaixo para contribuir
        </p>
      </div>

      {/* Grade de opções */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {opcoes.map(({ tipo, label, descricao, icon: Icon, color, bg, border, sempreAtivo }) => {
          const ativo = !carregando && isAtivo(tipo, sempreAtivo);
          const desabilitado = !carregando && !isAtivo(tipo, sempreAtivo);

          return (
            <button
              key={tipo}
              onClick={() => ativo && onSelect(tipo)}
              disabled={desabilitado}
              className="flex flex-col items-center justify-center gap-4 sm:gap-6 rounded-3xl p-6 sm:p-8 lg:p-10 transition-transform duration-150 active:scale-95 select-none relative"
              style={{
                background: desabilitado ? "hsl(var(--muted) / 0.5)" : bg,
                border: `2px solid ${desabilitado ? "hsl(var(--border))" : border}`,
                minHeight: "clamp(180px, 26vw, 260px)",
                opacity: desabilitado ? 0.45 : 1,
                cursor: desabilitado ? "not-allowed" : "pointer",
              }}
            >
              <div
                className="rounded-2xl flex items-center justify-center"
                style={{
                  background: desabilitado ? "hsl(var(--muted))" : color + "22",
                  width: "clamp(72px, 9vw, 100px)",
                  height: "clamp(72px, 9vw, 100px)",
                }}
              >
                <Icon
                  style={{
                    width: "60%",
                    height: "60%",
                    color: desabilitado ? "hsl(var(--muted-foreground))" : color,
                  }}
                  strokeWidth={1.5}
                />
              </div>
              <div className="text-center">
                <p
                  className="font-bold"
                  style={{
                    fontSize: "clamp(22px, 2.8vw, 32px)",
                    color: desabilitado
                      ? "hsl(var(--muted-foreground))"
                      : "hsl(var(--secondary-foreground))",
                  }}
                >
                  {label}
                </p>
                <p
                  style={{
                    fontSize: "clamp(13px, 1.5vw, 18px)",
                    marginTop: 4,
                    color: desabilitado
                      ? "hsl(var(--muted-foreground) / 0.7)"
                      : "hsl(var(--secondary-foreground) / 0.6)",
                  }}
                >
                  {desabilitado ? "Nenhuma campanha disponível" : descricao}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Botão Loja */}
      {lojaAtiva && onLoja && (
        <button
          onClick={onLoja}
          className="w-full flex items-center justify-center gap-4 rounded-3xl p-8 transition-transform active:scale-95"
          style={{
            background: 'hsl(var(--primary) / 0.10)',
            border: '2px solid hsl(var(--primary) / 0.3)',
            minHeight: 100,
          }}
        >
          <div
            className="rounded-2xl flex items-center justify-center"
            style={{ background: 'hsl(var(--primary) / 0.15)', width: 64, height: 64 }}
          >
            <ShoppingBag style={{ width: 36, height: 36, color: 'hsl(var(--primary))' }} strokeWidth={1.5} />
          </div>
          <div className="text-left">
            <p className="font-bold" style={{ fontSize: 28, color: 'hsl(var(--secondary-foreground))' }}>Loja</p>
            <p style={{ fontSize: 16, color: 'hsl(var(--secondary-foreground) / 0.6)' }}>Compre produtos e retire no caixa</p>
          </div>
        </button>
      )}

      {/* Avisos em slide */}
      <TotemAvisos onVerAvisos={(avisos) => setAvisosModal(avisos)} />

      {/* Client Local status indicator */}
      {clientOnline !== null && (
        <div className="flex items-center justify-center gap-2 pt-2">
          {clientOnline ? (
            <>
              <Wifi size={14} style={{ color: 'hsl(142 71% 45%)' }} />
              <span style={{ fontSize: 13, color: 'hsl(142 71% 45%)' }}>Client local conectado</span>
            </>
          ) : (
            <>
              <WifiOff size={14} style={{ color: 'hsl(var(--muted-foreground))' }} />
              <span style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>Sem client local</span>
            </>
          )}
        </div>
      )}

      {/* Modal Avisos Paroquiais */}
      {avisosModal && (
        <TotemAvisosModal avisos={avisosModal} onClose={() => setAvisosModal(null)} />
      )}
    </div>
  );
};

export default TotemInicio;
