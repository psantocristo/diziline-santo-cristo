import React, { useEffect, useState } from "react";
import { CheckCircle2, Copy, Clock, RefreshCw } from "lucide-react";
import TotemBeneficiario from "@/components/totem/TotemBeneficiario";
import { supabase } from "@/integrations/supabase/client";

interface TotemPixProps {
  valor: number;
  pagamentoId: string;
  onPago: () => void;
  onExpirar: () => void;
  onTrocarMetodo: () => void;
}

const EXPIRACAO_SEGUNDOS = 10 * 60; // 10 minutos no totem
const POLLING_INTERVAL = 4000; // 4 segundos

const TotemPix: React.FC<TotemPixProps> = ({ valor, pagamentoId, onPago, onExpirar, onTrocarMetodo }) => {
  const [segundos, setSegundos] = useState(EXPIRACAO_SEGUNDOS);
  const [copiado, setCopiado] = useState(false);
  const [aguardando, setAguardando] = useState(true);
  const [pixQrcode, setPixQrcode] = useState<string | null>(null);
  const [pixCopiaCola, setPixCopiaCola] = useState<string | null>(null);
  const [carregandoPix, setCarregandoPix] = useState(true);

  // Refs estáveis para callbacks — evita resetar timers a cada render
  const onExpirarRef = React.useRef(onExpirar);
  const onPagoRef = React.useRef(onPago);
  onExpirarRef.current = onExpirar;
  onPagoRef.current = onPago;

  const formatarReais = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Buscar dados do PIX (QR Code e copia-e-cola) via edge function segura
  useEffect(() => {
    let cancelled = false;
    const fetchPixData = async () => {
      try {
        // totem-pix-status usa service role — nenhum dado sensível exposto ao cliente
        const { data } = await supabase.functions.invoke("totem-pix-status", {
          body: { pagamento_id: pagamentoId, incluir_qrcode: true },
        });

        if (cancelled) return;
        if (data) {
          setPixQrcode(data.pix_qrcode || null);
          setPixCopiaCola(data.pix_copia_cola || null);
          if (data.status === "pago") {
            setAguardando(false);
            setTimeout(() => onPagoRef.current(), 1500);
          }
        }
      } catch { /* silencioso — polling irá verificar status */ }
      if (!cancelled) setCarregandoPix(false);
    };

    fetchPixData();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagamentoId]);

  // Countdown — sem dependência de onExpirar (usa ref)
  useEffect(() => {
    const t = setInterval(() => {
      setSegundos((s) => {
        if (s <= 1) { onExpirarRef.current(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Polling server-side para confirmar pagamento real e atualizar QR caso fique pronto depois
  useEffect(() => {
    if (!aguardando) return;

    const poll = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("totem-pix-status", {
          body: { pagamento_id: pagamentoId, incluir_qrcode: true },
        });

        if (data?.pix_qrcode) setPixQrcode(data.pix_qrcode);
        if (data?.pix_copia_cola) setPixCopiaCola(data.pix_copia_cola);

        if (data?.status === "pago") {
          clearInterval(poll);
          setAguardando(false);
          setTimeout(() => onPagoRef.current(), 1500);
        }
      } catch {
        // Ignorar erros de polling — continuar tentando
      }
    }, POLLING_INTERVAL);

    return () => clearInterval(poll);
  }, [pagamentoId, aguardando]);

  const copiarCodigo = async () => {
    const codigo = pixCopiaCola || pixQrcode || "";
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* ignore */ }
  };

  const min = Math.floor(segundos / 60);
  const sec = segundos % 60;

  if (!aguardando) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12">
        <CheckCircle2 style={{ width: 100, height: 100, color: "hsl(142 71% 45%)" }} />
        <p className="font-bold text-secondary-foreground" style={{ fontSize: 30 }}>
          Pagamento confirmado!
        </p>
        <p className="text-secondary-foreground/60" style={{ fontSize: 20 }}>
          Aguardando finalização...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="text-center space-y-2">
        <h2 className="font-bold text-secondary-foreground" style={{ fontSize: 32 }}>
          Pague com PIX
        </h2>
        <p className="text-secondary-foreground/60" style={{ fontSize: 20 }}>
          Escaneie o QR Code com seu celular
        </p>
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center gap-4">
        <div
          className="rounded-3xl p-6 flex items-center justify-center"
          style={{ background: "white", width: 280, height: 280 }}
        >
          {carregandoPix ? (
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          ) : pixQrcode ? (
            /* QR Code real como imagem base64 ou URL */
            <img
              src={pixQrcode.startsWith("data:") || pixQrcode.startsWith("http")
                ? pixQrcode
                : `data:image/png;base64,${pixQrcode}`}
              alt="QR Code PIX"
              style={{ width: 248, height: 248, objectFit: "contain" }}
              onError={(e) => {
                // fallback visual se imagem falhar
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            /* Loading spinner — nunca mostrar QR falso */
            <div className="flex flex-col items-center justify-center gap-3" style={{ width: 248, height: 248 }}>
              <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'hsl(var(--primary))', borderTopColor: 'transparent' }} />
              <p className="text-sm font-medium" style={{ color: 'hsl(var(--secondary-foreground) / 0.5)' }}>
                Gerando QR Code real...
              </p>
            </div>
          )}
        </div>

        {/* Valor */}
        <div className="text-center">
          <p className="text-secondary-foreground/50" style={{ fontSize: 16 }}>Valor</p>
          <p className="font-bold text-primary" style={{ fontSize: 42 }}>
            {formatarReais(valor)}
          </p>
        </div>

        {/* Countdown */}
        <div className="flex items-center gap-3 rounded-2xl px-6 py-3"
          style={{
            background: segundos < 60 ? "hsl(var(--destructive) / 0.15)" : "hsl(var(--secondary-foreground) / 0.08)",
            border: `1px solid ${segundos < 60 ? "hsl(var(--destructive) / 0.3)" : "hsl(var(--secondary-foreground) / 0.15)"}`,
          }}>
          <Clock size={22} style={{ color: segundos < 60 ? "hsl(var(--destructive))" : "hsl(var(--secondary-foreground) / 0.5)" }} />
          <span
            className="font-mono font-bold"
            style={{
              fontSize: 24,
              color: segundos < 60 ? "hsl(var(--destructive))" : "hsl(var(--secondary-foreground))",
            }}
          >
            {min}:{String(sec).padStart(2, "0")}
          </span>
          <span className="text-secondary-foreground/50" style={{ fontSize: 16 }}>restantes</span>
        </div>
      </div>

      {/* Copia e Cola */}
      {(pixCopiaCola || pixQrcode) && (
        <div>
          <p className="text-secondary-foreground/50 mb-2 text-center" style={{ fontSize: 16 }}>
            Ou copie o código PIX Copia e Cola:
          </p>
          <button
            onClick={copiarCodigo}
            className="w-full flex items-center gap-3 rounded-2xl px-5 py-4 font-mono transition-transform active:scale-95"
            style={{
              background: copiado ? "hsl(142 71% 45% / 0.15)" : "hsl(var(--secondary-foreground) / 0.06)",
              border: `1px solid ${copiado ? "hsl(142 71% 45% / 0.4)" : "hsl(var(--secondary-foreground) / 0.15)"}`,
              fontSize: 13,
              color: "hsl(var(--secondary-foreground) / 0.7)",
              wordBreak: "break-all",
            }}
          >
            <Copy size={20} className="shrink-0" style={{ color: copiado ? "hsl(142 71% 45%)" : undefined }} />
            {copiado ? "Copiado! ✓" : (pixCopiaCola || pixQrcode || "").slice(0, 60) + "..."}
          </button>
        </div>
      )}

      {/* Status aguardando */}
      <div className="flex items-center justify-center gap-3 py-3">
        <RefreshCw size={20} className="animate-spin text-primary" />
        <p className="text-secondary-foreground/60" style={{ fontSize: 18 }}>
          Aguardando confirmação do pagamento...
        </p>
      </div>

      {/* Trocar método */}
      <button
        onClick={onTrocarMetodo}
        className="w-full rounded-2xl py-4 font-medium flex items-center justify-center transition-opacity hover:opacity-70"
        style={{
          background: "hsl(var(--secondary-foreground) / 0.07)",
          border: "1px solid hsl(var(--secondary-foreground) / 0.15)",
          color: "hsl(var(--secondary-foreground) / 0.65)",
          fontSize: 18,
        }}
      >
        Trocar forma de pagamento
      </button>

      <TotemBeneficiario />
    </div>
  );
};

export default TotemPix;
