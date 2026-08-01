import React, { useEffect, useState, useRef } from "react";
import { Smartphone, CreditCard, Wallet, MonitorSmartphone, ArrowRight, ArrowLeft, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getLocalHealth } from "@/lib/local-client";

type MetodoPagamento = "pix" | "credito" | "debito";

interface TotemMetodoProps {
  valor: number;
  onSelecionar: (metodo: MetodoPagamento) => void;
  onSelecionarMaquininha?: (tipo: "credito" | "debito") => void;
}

interface MetodosConfig {
  pixAtivo: boolean;
  creditoAtivo: boolean;
  debitoAtivo: boolean;
  tefAtivo: boolean;
  tefCreditoAtivo: boolean;
  tefDebitoAtivo: boolean;
}

type SubEtapa = "principal" | "online" | "maquininha";

const TotemMetodo: React.FC<TotemMetodoProps> = ({ valor, onSelecionar, onSelecionarMaquininha }) => {
  const [cfg, setCfg] = useState<MetodosConfig>({
    pixAtivo: true, creditoAtivo: true, debitoAtivo: true,
    tefAtivo: false, tefCreditoAtivo: true, tefDebitoAtivo: true,
  });
  const [subEtapa, setSubEtapa] = useState<SubEtapa>("principal");
  const [pinpadOnline, setPinpadOnline] = useState(false);
  const pinpadPollRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('totem-config');
        if (error || !data) {
          console.error('Erro ao buscar config do totem:', error);
          return;
        }
        setCfg({
          pixAtivo: data.pix_ativo ?? true,
          creditoAtivo: data.credito_ativo ?? true,
          debitoAtivo: data.debito_ativo ?? true,
          tefAtivo: data.tef_ativo ?? false,
          tefCreditoAtivo: data.tef_credito_ativo ?? true,
          tefDebitoAtivo: data.tef_debito_ativo ?? true,
        });
      } catch (e) {
        console.error('Erro ao buscar config do totem:', e);
      }
    };
    fetchConfigs();
  }, []);

  // Auto-detect PINPad via Client Local health check
  useEffect(() => {
    if (!cfg.tefAtivo) { setPinpadOnline(false); return; }

    const checkPinpad = async () => {
      try {
        const health = await getLocalHealth();
        setPinpadOnline(health?.devices?.pinpad?.connected ?? false);
      } catch {
        setPinpadOnline(false);
      }
    };

    checkPinpad();
    pinpadPollRef.current = window.setInterval(checkPinpad, 10_000);
    return () => { if (pinpadPollRef.current) clearInterval(pinpadPollRef.current); };
  }, [cfg.tefAtivo]);

  const formatarReais = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const onlineDisponivel = cfg.creditoAtivo || cfg.debitoAtivo;
  const maquininhaDisponivel = cfg.tefAtivo && pinpadOnline && onSelecionarMaquininha && (cfg.tefCreditoAtivo || cfg.tefDebitoAtivo);

  const renderBotao = (
    key: string,
    label: string,
    descricao: string,
    Icon: React.ComponentType<any>,
    onClick: () => void,
    destaque = false,
    badge?: string,
  ) => (
    <button
      key={key}
      onClick={onClick}
      className="w-full flex items-center gap-6 rounded-3xl p-7 transition-transform active:scale-[0.98] text-left"
      style={{
        background: destaque
          ? "hsl(var(--primary) / 0.15)"
          : "hsl(var(--secondary-foreground) / 0.06)",
        border: destaque
          ? "2px solid hsl(var(--primary) / 0.5)"
          : "2px solid hsl(var(--secondary-foreground) / 0.15)",
      }}
    >
      <div
        className="rounded-2xl flex items-center justify-center shrink-0"
        style={{
          width: 80,
          height: 80,
          background: destaque
            ? "hsl(var(--primary) / 0.2)"
            : "hsl(var(--secondary-foreground) / 0.08)",
        }}
      >
        <Icon
          style={{
            width: 42,
            height: 42,
            color: destaque ? "hsl(var(--primary))" : "hsl(var(--secondary-foreground))",
          }}
          strokeWidth={1.5}
        />
      </div>
      <div className="flex-1">
        <p
          className="font-bold"
          style={{
            fontSize: 26,
            color: destaque ? "hsl(var(--primary))" : "hsl(var(--secondary-foreground))",
          }}
        >
          {label}
          {badge && (
            <span
              className="ml-3 rounded-full px-3 py-1 font-bold"
              style={{
                fontSize: 12,
                background: "hsl(var(--primary))",
                color: "hsl(var(--primary-foreground))",
                verticalAlign: "middle",
              }}
            >
              {badge}
            </span>
          )}
        </p>
        <p className="text-secondary-foreground/55" style={{ fontSize: 18 }}>
          {descricao}
        </p>
      </div>
      <ArrowRight
        style={{ color: "hsl(var(--secondary-foreground) / 0.4)", width: 28, height: 28 }}
      />
    </button>
  );

  const renderVoltar = () => (
    <button
      onClick={() => setSubEtapa("principal")}
      className="flex items-center gap-2 mb-2 font-medium transition-opacity hover:opacity-70"
      style={{ color: "hsl(var(--secondary-foreground) / 0.55)", fontSize: 18 }}
    >
      <ArrowLeft size={18} /> Voltar
    </button>
  );

  // ─── Sub-seleção: Crédito ou Débito (online) ───
  if (subEtapa === "online") {
    return (
      <div className="space-y-8">
        {renderVoltar()}
        <div className="text-center space-y-2">
          <h2 className="font-bold text-secondary-foreground" style={{ fontSize: 32 }}>
            Pagamento Online
          </h2>
          <p className="text-secondary-foreground/60" style={{ fontSize: 22 }}>
            Total: <span className="text-primary font-bold">{formatarReais(valor)}</span>
          </p>
          <p className="text-secondary-foreground/40" style={{ fontSize: 18 }}>
            Selecione o tipo de cartão
          </p>
        </div>
        <div className="space-y-5">
          {cfg.creditoAtivo &&
            renderBotao("credito", "Crédito", "Visa, Mastercard, Elo e outros", CreditCard, () => onSelecionar("credito"))
          }
          {cfg.debitoAtivo &&
            renderBotao("debito", "Débito", "Débito direto na conta", Wallet, () => onSelecionar("debito"))
          }
        </div>
      </div>
    );
  }

  // ─── Sub-seleção: Crédito ou Débito (maquininha) ───
  if (subEtapa === "maquininha" && onSelecionarMaquininha) {
    return (
      <div className="space-y-8">
        {renderVoltar()}
        <div className="text-center space-y-2">
          <h2 className="font-bold text-secondary-foreground" style={{ fontSize: 32 }}>
            Maquininha
          </h2>
          <p className="text-secondary-foreground/60" style={{ fontSize: 22 }}>
            Total: <span className="text-primary font-bold">{formatarReais(valor)}</span>
          </p>
          <p className="text-secondary-foreground/40" style={{ fontSize: 18 }}>
            Selecione o tipo de cartão
          </p>
        </div>
        <div className="space-y-5">
          {cfg.tefCreditoAtivo &&
            renderBotao("maq-credito", "Crédito", "Aproxime ou insira o cartão", CreditCard, () => onSelecionarMaquininha("credito"))
          }
          {cfg.tefDebitoAtivo &&
            renderBotao("maq-debito", "Débito", "Aproxime ou insira o cartão", Wallet, () => onSelecionarMaquininha("debito"))
          }
        </div>
      </div>
    );
  }

  // ─── Tela principal: PIX | Pagamento Online | Maquininha ───
  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="font-bold text-secondary-foreground" style={{ fontSize: 32 }}>
          Como deseja pagar?
        </h2>
        <p className="text-secondary-foreground/60" style={{ fontSize: 22 }}>
          Total: <span className="text-primary font-bold">{formatarReais(valor)}</span>
        </p>
      </div>

      <div className="space-y-5">
        {cfg.pixAtivo &&
          renderBotao("pix", "PIX", "Pagamento instantâneo via QR Code", Smartphone, () => onSelecionar("pix"), true, "RECOMENDADO")
        }
        {onlineDisponivel &&
          renderBotao("online", "Pagamento Online", "Crédito ou débito via gateway", Globe, () => setSubEtapa("online"))
        }
        {maquininhaDisponivel &&
          renderBotao("maquininha", "Maquininha", "Pague direto na maquininha", MonitorSmartphone, () => setSubEtapa("maquininha"))
        }
      </div>
    </div>
  );
};

export default TotemMetodo;
