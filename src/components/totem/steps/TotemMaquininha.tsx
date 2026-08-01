import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { MonitorSmartphone, CheckCircle, XCircle, Clock, CreditCard, Wallet, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createTefPayment, getTefTransactionStatus,
  confirmTefTransaction, undoTefTransaction,
  type TefStatusResponse,
} from "@/lib/local-client";

interface TotemMaquininhaProps {
  valor: number;
  pagamentoId: string | null;
  tipo: "credito" | "debito";
  onPago: () => void;
  onTrocarMetodo: () => void;
}

type Status = "enviando" | "aguardando" | "aprovado" | "recusado" | "erro" | "timeout";

interface TefConfig {
  modo: string;
  middleware_url: string;
  middleware_token: string;
  terminal_id: string;
  timeout_segundos: number;
}

const STATUS_CONFIG: Record<Status, { icon: React.ElementType; color: string; bg: string; pulse?: boolean; spin?: boolean }> = {
  enviando: { icon: MonitorSmartphone, color: "hsl(var(--primary))", bg: "hsl(var(--primary) / 0.12)", spin: true },
  aguardando: { icon: MonitorSmartphone, color: "hsl(var(--primary))", bg: "hsl(var(--primary) / 0.12)", pulse: true },
  aprovado: { icon: CheckCircle, color: "hsl(142 76% 36%)", bg: "hsl(142 76% 36% / 0.15)" },
  recusado: { icon: XCircle, color: "hsl(0 72% 51%)", bg: "hsl(0 72% 51% / 0.15)" },
  erro: { icon: AlertTriangle, color: "hsl(0 72% 51%)", bg: "hsl(0 72% 51% / 0.15)" },
  timeout: { icon: Clock, color: "hsl(var(--primary))", bg: "hsl(var(--primary) / 0.12)" },
};

// ─── Animated pulsing progress bar ───
const PulseProgressBar: React.FC<{ timeoutSeconds: number; active: boolean }> = ({ timeoutSeconds, active }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    const interval = setInterval(() => setElapsed((Date.now() - start) / 1000), 200);
    return () => clearInterval(interval);
  }, [active]);

  const pct = Math.min((elapsed / timeoutSeconds) * 100, 100);

  return (
    <div className="w-full max-w-md mx-auto space-y-2">
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: 8, background: "hsl(var(--secondary-foreground) / 0.1)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.6))",
            animation: active ? "pulse-glow 2s ease-in-out infinite" : "none",
          }}
        />
      </div>
      {active && (
        <p className="text-secondary-foreground/30 text-center" style={{ fontSize: 13 }}>
          Tempo restante: {Math.max(0, Math.ceil(timeoutSeconds - elapsed))}s
        </p>
      )}
    </div>
  );
};

const TotemMaquininha: React.FC<TotemMaquininhaProps> = ({
  valor,
  pagamentoId,
  tipo,
  onPago,
  onTrocarMetodo,
}) => {
  const [status, setStatus] = useState<Status>("enviando");
  const [mensagem, setMensagem] = useState("Enviando para a maquininha...");
  const [submensagem, setSubmensagem] = useState("Preparando pagamento, aguarde");
  const [tefTxId, setTefTxId] = useState<string | null>(null);
  const [tefConfig, setTefConfig] = useState<TefConfig | null>(null);
  const pollingRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const formatarReais = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const timeoutSec = useMemo(() => tefConfig?.timeout_segundos || 120, [tefConfig]);

  // ─── Helper: log TEF event ───
  const logTef = useCallback(async (tipoLog: string, msg: string, detalhes?: string) => {
    try {
      await supabase.functions.invoke("tef-gateway", {
        body: { action: "log-tef", tipo: tipoLog, mensagem: msg, detalhes: detalhes || null, pagamento_id: pagamentoId },
      });
    } catch { /* non-blocking */ }
  }, [pagamentoId]);

  // ─── Fetch TEF config (sem expor middleware_token) ───
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data } = await supabase.functions.invoke("tef-gateway", {
          body: { action: "get-config" },
        });
        if (data?.config) {
          setTefConfig({
            modo: data.config.modo || "simulacao",
            middleware_url: "",
            middleware_token: "",
            terminal_id: "",
            timeout_segundos: data.config.timeout_segundos || 60,
          });
        }
      } catch {
        setTefConfig({ modo: "simulacao", middleware_url: "", middleware_token: "", terminal_id: "", timeout_segundos: 60 });
      }
    };
    fetchConfig();
  }, []);

  // ─── Helper: update payment in DB ───
  const updatePagamentoDB = useCallback(async (updates: Record<string, any>) => {
    await supabase.functions.invoke("tef-gateway", {
      body: { action: "update-payment", pagamento_id: pagamentoId, updates },
    });
  }, [pagamentoId]);

  // ─── Send payment ───
  useEffect(() => {
    if (!pagamentoId || !tefConfig) return;

    const enviar = async () => {
      try {
        if (tefConfig.modo === "localhost") {
          await logTef("info", `🖥️ TEF Local — Enviando ${tipo} R$ ${formatarReais(valor)}`);

          // Use local-client bridge instead of direct fetch
          const result = await createTefPayment({
            pagamentoId,
            valor,
            tipo,
            parcelas: 1,
          });

          if (!result.success || !result.transaction_id) {
            setStatus("erro");
            setMensagem("Erro ao enviar para maquininha");
            setSubmensagem(result.message || "Client local não respondeu");
            return;
          }

          const txId = result.transaction_id;
          setTefTxId(txId);
          setStatus("aguardando");
          setMensagem("Aproxime ou insira o cartão");
          setSubmensagem("Siga as instruções na maquininha");

          await logTef("info", `🖥️ TEF Local — Pagamento enviado, aguardando PIN PAD`, `TxID: ${txId}`);
          await updatePagamentoDB({ gateway_id: txId, gateway_status: "aguardando_maquininha" });
        } else {
          // Simulação / Cloud mode via edge function
          const { data, error } = await supabase.functions.invoke("tef-gateway", {
            body: { action: "create-payment", pagamento_id: pagamentoId },
          });
          if (error || !data?.success) {
            setStatus("erro");
            setMensagem("Erro ao enviar para maquininha");
            setSubmensagem(data?.message || error?.message || "Tente novamente ou escolha outro método");
            return;
          }
          setTefTxId(data.tef_transaction_id);
          setStatus("aguardando");
          setMensagem("Aproxime ou insira o cartão");
          setSubmensagem("Siga as instruções na maquininha");
        }
      } catch (err: any) {
        setStatus("erro");
        setMensagem("Falha na comunicação");
        setSubmensagem(err.message || "Não foi possível conectar à maquininha");
        await logTef("error", `❌ TEF — Erro ao enviar pagamento`, err.message || "Erro desconhecido");
      }
    };

    enviar();
  }, [pagamentoId, tefConfig, tipo, valor, logTef, updatePagamentoDB]);

  // ─── Polling ───
  useEffect(() => {
    if (status !== "aguardando" || !pagamentoId || !tefConfig) return;

    const poll = async () => {
      try {
        if (tefConfig.modo === "localhost") {
          const txId = tefTxId || pagamentoId;

          // Use local-client bridge
          const data: TefStatusResponse = await getTefTransactionStatus(txId);

          if (data.status === "approved") {
            setStatus("aprovado");
            setMensagem("Pagamento aprovado!");
            setSubmensagem("Obrigado pela sua contribuição");
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);

            await logTef("success", `✅ TEF Local — APROVADO`, `TxID: ${txId}`);
            confirmTefTransaction(txId).catch(() => {});

            await updatePagamentoDB({
              status: "pago",
              pago_em: new Date().toISOString(),
              gateway_status: "aprovado_maquininha",
              gateway_payload: data,
            });
            setTimeout(onPago, 2500);
            return;
          }

          if (data.status === "declined" || data.status === "error") {
            setStatus("recusado");
            setMensagem("Pagamento recusado");
            setSubmensagem(data.message || "O cartão não foi aceito. Tente outro cartão ou método.");
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);

            await logTef("error", `❌ TEF Local — RECUSADO`, `TxID: ${txId} | Motivo: ${data.message || '-'}`);
            undoTefTransaction(txId).catch(() => {});
            await updatePagamentoDB({ status: "cancelado", gateway_status: "recusado_maquininha", gateway_payload: data });
            return;
          }
        } else {
          // Cloud/simulação polling via edge function
          const { data } = await supabase.functions.invoke("tef-gateway", {
            body: { action: "check-status", pagamento_id: pagamentoId, tef_transaction_id: tefTxId },
          });
          if (data?.status === "aprovado") {
            setStatus("aprovado");
            setMensagem("Pagamento aprovado!");
            setSubmensagem("Obrigado pela sua contribuição");
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setTimeout(onPago, 2500);
            return;
          }
          if (data?.status === "recusado") {
            setStatus("recusado");
            setMensagem("Pagamento recusado");
            setSubmensagem(data?.message || "Tente outro cartão ou método de pagamento");
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            return;
          }
        }
      } catch (err) {
        console.error("Erro no polling TEF:", err);
      }
    };

    pollingRef.current = window.setInterval(poll, 3000);

    const timeoutMs = (tefConfig.timeout_segundos || 120) * 1000;
    timeoutRef.current = window.setTimeout(async () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setStatus("timeout");
      setMensagem("Tempo esgotado");
      setSubmensagem("O pagamento não foi concluído a tempo. Tente novamente.");
      if (tefConfig.modo === "localhost") {
        await logTef("warning", `⏰ TEF Local — Timeout`, `TxID: ${tefTxId || '-'}`);
      }
    }, timeoutMs);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [status, pagamentoId, tefTxId, onPago, tefConfig, updatePagamentoDB, logTef]);

  const cfg = STATUS_CONFIG[status];
  const IconComponent = cfg.icon;
  const TipoIcon = tipo === "credito" ? CreditCard : Wallet;
  const isWaiting = status === "enviando" || status === "aguardando";
  const isFailed = status === "recusado" || status === "erro" || status === "timeout";

  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes icon-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

      {/* Icon */}
      <div
        className="rounded-3xl flex items-center justify-center"
        style={{
          width: 160,
          height: 160,
          background: cfg.bg,
          animation: cfg.pulse ? "icon-float 2s ease-in-out infinite" : "none",
        }}
      >
        <IconComponent
          style={{ width: 90, height: 90, color: cfg.color }}
          className={cfg.spin ? "animate-spin" : ""}
          strokeWidth={1.2}
        />
      </div>

      {/* Value */}
      <p className="text-primary font-bold" style={{ fontSize: 36 }}>
        {formatarReais(valor)}
      </p>

      {/* Type badge */}
      <div
        className="flex items-center gap-2 rounded-full px-5 py-2"
        style={{ background: "hsl(var(--secondary-foreground) / 0.08)" }}
      >
        <TipoIcon style={{ width: 20, height: 20, color: "hsl(var(--secondary-foreground) / 0.6)" }} strokeWidth={1.5} />
        <span className="text-secondary-foreground/60 font-medium" style={{ fontSize: 16 }}>
          {tipo === "credito" ? "Crédito" : "Débito"} na maquininha
        </span>
      </div>

      {/* Main message */}
      <h2
        className="font-bold text-secondary-foreground"
        style={{ fontSize: 28, maxWidth: 500 }}
      >
        {mensagem}
      </h2>

      {/* Sub message */}
      <p
        className="text-secondary-foreground/50"
        style={{ fontSize: 18, maxWidth: 420 }}
      >
        {submensagem}
      </p>

      {/* Progress bar */}
      {isWaiting && (
        <div className="w-full max-w-md mt-2">
          <PulseProgressBar timeoutSeconds={timeoutSec} active={isWaiting} />
        </div>
      )}

      {/* Approved animation */}
      {status === "aprovado" && (
        <p className="text-secondary-foreground/40 font-medium" style={{ fontSize: 16 }}>
          Redirecionando...
        </p>
      )}

      {/* Error actions */}
      {isFailed && (
        <div className="flex flex-col items-center gap-4 mt-4 w-full max-w-md">
          <button
            onClick={onTrocarMetodo}
            className="w-full rounded-2xl px-8 py-5 font-bold transition-transform active:scale-95"
            style={{
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
              fontSize: 20,
            }}
          >
            Tentar outro método
          </button>
        </div>
      )}
    </div>
  );
};

export default TotemMaquininha;
