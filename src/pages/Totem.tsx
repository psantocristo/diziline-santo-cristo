import React, { useState, useCallback, useEffect } from "react";
import { AlertTriangle, RotateCcw, Loader2, Monitor, Wifi, Database, ShieldCheck } from "lucide-react";
import TotemLayout from "@/components/totem/TotemLayout";
import { useTotemIdleTimer } from "@/components/totem/useTotemIdleTimer";
import TotemProgressBar from "@/components/totem/TotemProgressBar";
import TotemInicio from "@/components/totem/steps/TotemInicio";
import TotemIdentificacao from "@/components/totem/steps/TotemIdentificacao";
import TotemNomeOpcional from "@/components/totem/steps/TotemNomeOpcional";
import TotemMes from "@/components/totem/steps/TotemMes";
import TotemValor from "@/components/totem/steps/TotemValor";
import TotemMetodo from "@/components/totem/steps/TotemMetodo";
import TotemPix from "@/components/totem/steps/TotemPix";
import TotemCartao from "@/components/totem/steps/TotemCartao";
import TotemMaquininha from "@/components/totem/steps/TotemMaquininha";
import TotemConfirmacao from "@/components/totem/steps/TotemConfirmacao";
import TotemLoja from "@/components/totem/steps/TotemLoja";
import TotemPinGuard from "@/components/totem/TotemPinGuard";
import TotemScreensaver from "@/components/totem/TotemScreensaver";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

type TipoContribuicao = "dizimo" | "oferta" | "campanha" | "eventual";
type MetodoPagamento = "pix" | "credito" | "debito";

type Etapa =
  | "inicio"
  | "identificacao"
  | "mes"
  | "nome_opcional"
  | "valor"
  | "metodo"
  | "pix"
  | "cartao"
  | "maquininha"
  | "confirmacao"
  | "loja"
  | "encerrado";

interface Paroquiano {
  id: string;
  nome_completo: string;
  valor_sugerido: number | null;
  matricula_paroquial: string | null;
}

interface SessaoTotem {
  tipo: TipoContribuicao | null;
  paroquiano: Paroquiano | null;
  nome: string;
  telefone: string;
  valor: number;
  metodo: MetodoPagamento | null;
  pagamentoId: string | null;
  mesReferencia: Date | null;
  maquininhaTipo: "credito" | "debito" | null;
}

const SESSAO_INICIAL: SessaoTotem = {
  tipo: null,
  paroquiano: null,
  nome: "",
  telefone: "",
  valor: 0,
  metodo: null,
  pagamentoId: null,
  mesReferencia: null,
  maquininhaTipo: null,
};

const ETAPAS_LABEL: Partial<Record<Etapa, string>> = {
  identificacao: "Identificação",
  mes: "Mês de referência",
  nome_opcional: "Seus dados",
  valor: "Valor",
  metodo: "Forma de pagamento",
  pix: "Pagamento PIX",
  cartao: "Dados do cartão",
  maquininha: "Maquininha",
  confirmacao: "Confirmação",
};

function getProgressInfo(etapa: Etapa, tipo: TipoContribuicao | null) {
  if (etapa === "inicio") return null;

  const ordem: Etapa[] =
    tipo === "dizimo"
      ? ["identificacao", "mes", "valor", "metodo", "pix", "confirmacao"]
      : ["nome_opcional", "valor", "metodo", "pix", "confirmacao"];

  const idx = ordem.indexOf(etapa);
  if (idx < 0) return null;

  return {
    current: idx + 1,
    total: ordem.length,
    label: ETAPAS_LABEL[etapa] || "",
  };
}

const TotemContent: React.FC = () => {
  const [etapa, setEtapa] = useState<Etapa>("inicio");
  const [sessao, setSessao] = useState<SessaoTotem>(SESSAO_INICIAL);
  const [encerradoPorInatividade, setEncerradoPorInatividade] = useState(false);
  const [processandoMetodo, setProcessandoMetodo] = useState(false);
  const [lojaAtiva, setLojaAtiva] = useState(false);
  const [screensaverAtivo, setScreensaverAtivo] = useState(false);

  React.useEffect(() => {
    supabase.rpc('get_loja_config').then(({ data }) => {
      if (data && typeof data === 'object' && 'loja_ativa' in (data as any)) {
        setLojaAtiva((data as any).loja_ativa);
      }
    });
  }, []);

  const resetar = useCallback(() => {
    setEtapa("inicio");
    setSessao(SESSAO_INICIAL);
    setEncerradoPorInatividade(false);
  }, []);

  const handleInatividade = useCallback(() => {
    if (etapa !== "inicio") {
      setEncerradoPorInatividade(true);
      setEtapa("encerrado");
      setTimeout(resetar, 5000);
    }
  }, [etapa, resetar]);

  const { secondsLeft } = useTotemIdleTimer({
    timeoutSeconds: 120,
    onTimeout: handleInatividade,
  });

  // Screensaver / modo descanso na tela inicial (45s sem interação)
  useEffect(() => {
    if (etapa !== "inicio" || screensaverAtivo) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reset = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setScreensaverAtivo(true), 45_000);
    };
    const events = ["mousemove", "mousedown", "touchstart", "keydown", "wheel"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [etapa, screensaverAtivo]);



  const gerarDescricao = (tipo: TipoContribuicao, metodo: MetodoPagamento | string): string => {
    const tipoAbrev: Record<TipoContribuicao, string> = {
      dizimo: "DIZ",
      oferta: "OFE",
      campanha: "CAM",
      eventual: "DOA",
    };
    const metodoAbrev: Record<string, string> = {
      pix: "PIX",
      credito: "CRD",
      debito: "DEB",
      maquininha: "MAQ",
    };
    const agora = new Date();
    const aaaamm = `${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, "0")}`;
    return `${tipoAbrev[tipo]}-${aaaamm}-${metodoAbrev[metodo] || metodo}`;
  };

  const gravarPagamento = async (
    s: SessaoTotem,
    metodo: MetodoPagamento,
    isMaquininha = false
  ): Promise<{ id: string; pixQrcode?: string; pixCopiaCola?: string } | null> => {
    try {
      const nomeContribuinte = s.paroquiano?.nome_completo || s.nome || null;
      const descricao = gerarDescricao(s.tipo!, isMaquininha ? "maquininha" : metodo);

      const pagamentoId = crypto.randomUUID();

      const { error } = await supabase
        .from("pagamentos")
        .insert({
          id: pagamentoId,
          tipo: s.tipo!,
          valor: s.valor,
          metodo,
          status: "aguardando_pagamento",
          paroquiano_id: s.paroquiano?.id || null,
          user_id: null,
          origem: "totem",
          gateway_status: "pendente",
          nome_contribuinte: nomeContribuinte,
          descricao,
          ...(s.tipo === "dizimo" && s.mesReferencia
            ? { mes_referencia: format(s.mesReferencia, 'yyyy-MM-dd') }
            : {}),
        } as any);

      if (error) throw error;


      if (metodo === "pix" && !isMaquininha) {
        try {
          const { data: pixData } = await supabase.functions.invoke("rede-gateway-totem", {
            body: {
              action: "create-pix",
              pagamento_id: pagamentoId,
              valor: s.valor,
              descricao,
            },
          });

          if (pixData?.success) {
            return {
              id: pagamentoId,
              pixQrcode: pixData.pix_qrcode,
              pixCopiaCola: pixData.pix_copia_cola,
            };
          }
        } catch (pixErr) {
          console.error("Erro ao gerar PIX:", pixErr);
        }

        return { id: pagamentoId };
      }

      return { id: pagamentoId };
    } catch (err) {
      console.error("Erro ao gravar pagamento:", err);
      return null;
    }
  };

  const handleSelecionarTipo = (tipo: TipoContribuicao) => {
    setSessao((s) => ({ ...s, tipo }));
    setEtapa(tipo === "dizimo" ? "identificacao" : "nome_opcional");
  };

  const handleIdentificacao = (paroquiano: Paroquiano | null) => {
    setSessao((s) => ({ ...s, paroquiano }));
    setEtapa("mes");
  };

  const handleMes = (mesRef: Date) => {
    setSessao((s) => ({ ...s, mesReferencia: mesRef }));
    setEtapa("valor");
  };

  const handleNomeOpcional = (nome: string, telefone: string) => {
    setSessao((s) => ({ ...s, nome, telefone }));
    setEtapa("valor");
  };

  const handleValor = (valor: number) => {
    setSessao((s) => ({ ...s, valor }));
    setEtapa("metodo");
  };

  const handleMetodo = async (metodo: MetodoPagamento) => {
    const sessaoAtual = { ...sessao, metodo };
    setSessao((s) => ({ ...s, metodo }));
    setProcessandoMetodo(true);
    try {
      const resultado = await gravarPagamento(sessaoAtual, metodo);
      if (resultado) {
        setSessao((s) => ({
          ...s,
          metodo,
          pagamentoId: resultado.id,
        }));
        setProcessandoMetodo(false);
        setEtapa(metodo === "pix" ? "pix" : "cartao");
      } else {
        console.error("Falha ao gravar pagamento");
        setProcessandoMetodo(false);
        setEtapa("metodo");
      }
    } catch (err) {
      console.error("Erro ao processar pagamento:", err);
      setProcessandoMetodo(false);
      setEtapa("metodo");
    }
  };

  const handleMaquininha = async (tipo: "credito" | "debito") => {
    const metodo: MetodoPagamento = tipo;
    const sessaoAtual = { ...sessao, metodo, maquininhaTipo: tipo };
    setSessao((s) => ({ ...s, metodo, maquininhaTipo: tipo }));
    try {
      const resultado = await gravarPagamento(sessaoAtual, metodo, true);
      if (resultado) {
        setSessao((s) => ({
          ...s,
          metodo,
          maquininhaTipo: tipo,
          pagamentoId: resultado.id,
        }));
        setEtapa("maquininha");
      } else {
        console.error("Falha ao gravar pagamento para maquininha");
        setEtapa("metodo");
      }
    } catch (err) {
      console.error("Erro ao processar maquininha:", err);
      setEtapa("metodo");
    }
  };

  const handlePago = async () => {
    setEtapa("confirmacao");
  };

  const handleTrocarMetodo = () => {
    setSessao((s) => ({ ...s, metodo: null, pagamentoId: null, maquininhaTipo: null }));
    setEtapa("metodo");
  };

  const progress = getProgressInfo(etapa, sessao.tipo);
  const showTimer = etapa !== "inicio" && etapa !== "confirmacao" && etapa !== "encerrado";

  return (
    <>
    <TotemLayout
      idleSeconds={showTimer ? secondsLeft : undefined}
      onIdleWarning={showTimer}
    >
      {progress && (
        <TotemProgressBar
          current={progress.current}
          total={progress.total}
          label={progress.label}
        />
      )}

      {etapa !== "inicio" && etapa !== "confirmacao" && etapa !== "encerrado" && (
        <button
          onClick={resetar}
          className="flex items-center gap-2 mb-6 font-medium transition-opacity hover:opacity-70"
          style={{ color: "hsl(var(--secondary-foreground) / 0.55)", fontSize: 18 }}
        >
          <RotateCcw size={18} /> Cancelar e voltar ao início
        </button>
      )}

      {etapa === "inicio" && (
        <TotemInicio onSelect={handleSelecionarTipo} onLoja={() => setEtapa("loja")} lojaAtiva={lojaAtiva} />
      )}

      {etapa === "loja" && (
        <TotemLoja onVoltar={resetar} nomeCliente={sessao.paroquiano?.nome_completo || sessao.nome || undefined} paroquianoId={sessao.paroquiano?.id} />
      )}

      {etapa === "identificacao" && (
        <TotemIdentificacao onIdentificado={handleIdentificacao} obrigatorio={sessao.tipo === "dizimo"} />
      )}

      {etapa === "mes" && (
        <TotemMes
          paroquianoId={sessao.paroquiano?.id}
          onConfirmar={handleMes}
        />
      )}

      {etapa === "nome_opcional" && (
        <TotemNomeOpcional
          onContinuar={handleNomeOpcional}
          titulo={sessao.tipo === "eventual" ? "Identificação para Doação (opcional)" : "Identificação (opcional)"}
        />
      )}

      {etapa === "valor" && (
        <TotemValor
          valorSugerido={sessao.paroquiano?.valor_sugerido}
          onConfirmar={handleValor}
          tipoLabel={
            sessao.tipo === "dizimo" ? "Dízimo" :
            sessao.tipo === "oferta" ? "Oferta" :
            sessao.tipo === "eventual" ? "Doação" : "Campanha"
          }
        />
      )}

      {etapa === "metodo" && sessao.valor > 0 && !processandoMetodo && (
        <TotemMetodo
          valor={sessao.valor}
          onSelecionar={handleMetodo}
          onSelecionarMaquininha={handleMaquininha}
        />
      )}

      {processandoMetodo && (
        <div className="flex flex-col items-center justify-center gap-6 py-20 animate-fade-in">
          <div className="relative">
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: 100,
                height: 100,
                background: "hsl(var(--primary) / 0.12)",
              }}
            >
              <Loader2
                className="animate-spin"
                style={{ width: 52, height: 52, color: "hsl(var(--primary))" }}
                strokeWidth={2}
              />
            </div>
            <div
              className="absolute inset-0 rounded-full animate-ping"
              style={{
                background: "hsl(var(--primary) / 0.08)",
                animationDuration: "2s",
              }}
            />
          </div>
          <h2 className="font-bold text-secondary-foreground" style={{ fontSize: 28 }}>
            Aguarde um instante...
          </h2>
          <p className="text-secondary-foreground/50" style={{ fontSize: 18 }}>
            Preparando seu pagamento
          </p>
        </div>
      )}

      {etapa === "pix" && sessao.valor > 0 && sessao.pagamentoId && (
        <TotemPix
          valor={sessao.valor}
          pagamentoId={sessao.pagamentoId}
          onPago={handlePago}
          onTrocarMetodo={handleTrocarMetodo}
          onExpirar={() => {
            setEncerradoPorInatividade(false);
            setEtapa("encerrado");
            setTimeout(resetar, 5000);
          }}
        />
      )}

      {etapa === "cartao" && sessao.valor > 0 && sessao.metodo && sessao.metodo !== "pix" && (
        <TotemCartao
          valor={sessao.valor}
          tipo={sessao.metodo}
          pagamentoId={sessao.pagamentoId}
          paroquianoId={sessao.paroquiano?.id || null}
          onPago={handlePago}
          onTrocarMetodo={handleTrocarMetodo}
        />
      )}

      {etapa === "maquininha" && sessao.valor > 0 && sessao.pagamentoId && sessao.maquininhaTipo && (
        <TotemMaquininha
          valor={sessao.valor}
          pagamentoId={sessao.pagamentoId}
          tipo={sessao.maquininhaTipo}
          onPago={handlePago}
          onTrocarMetodo={handleTrocarMetodo}
        />
      )}

      {etapa === "confirmacao" && (
        <TotemConfirmacao
          pagamentoId={sessao.pagamentoId || undefined}
          valor={sessao.valor}
          tipo={sessao.tipo!}
          metodo={sessao.metodo || undefined}
          nomeContribuinte={sessao.paroquiano?.nome_completo || sessao.nome || undefined}
          paroquianoId={sessao.paroquiano?.id}
          mesReferencia={sessao.mesReferencia}
          onNova={resetar}
        />
      )}

      {etapa === "encerrado" && (
        <div className="flex flex-col items-center gap-6 py-16 text-center">
          <AlertTriangle
            style={{ width: 80, height: 80, color: "hsl(var(--primary))" }}
            strokeWidth={1.5}
          />
          <h2 className="font-bold text-secondary-foreground" style={{ fontSize: 34 }}>
            {encerradoPorInatividade
              ? "Sessão encerrada por inatividade"
              : "Tempo de pagamento expirado"}
          </h2>
          <p className="text-secondary-foreground/55" style={{ fontSize: 20 }}>
            Voltando para o início automaticamente...
          </p>
          <button
            onClick={resetar}
            className="mt-4 rounded-2xl px-10 py-5 font-bold transition-transform active:scale-95"
            style={{
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
              fontSize: 22,
            }}
          >
            Voltar agora
          </button>
        </div>
      )}
    </TotemLayout>
    {screensaverAtivo && (
      <TotemScreensaver onDismiss={() => setScreensaverAtivo(false)} />
    )}
    </>
  );
};

const BOOT_STEPS = [
  { icon: Monitor, label: "Inicializando interface do totem…", duration: 600 },
  { icon: Wifi, label: "Conectando aos serviços…", duration: 800 },
  { icon: Database, label: "Carregando configurações…", duration: 700 },
  { icon: ShieldCheck, label: "Verificando segurança…", duration: 500 },
];

const TotemBootScreen: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (step >= BOOT_STEPS.length) {
      const t = setTimeout(onDone, 400);
      return () => clearTimeout(t);
    }
    const dur = BOOT_STEPS[step].duration;
    const interval = 30;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += interval;
      const baseProgress = (step / BOOT_STEPS.length) * 100;
      const stepProgress = (Math.min(elapsed / dur, 1) / BOOT_STEPS.length) * 100;
      setProgress(baseProgress + stepProgress);
      if (elapsed >= dur) {
        clearInterval(timer);
        setStep((s) => s + 1);
      }
    }, interval);
    return () => clearInterval(timer);
  }, [step, onDone]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8 select-none"
      style={{ background: "linear-gradient(160deg, hsl(350 60% 22%), hsl(350 60% 28%) 50%, hsl(350 50% 18%))" }}
    >
      {/* Pulsing icon */}
      <div className="relative mb-12">
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{ animationDuration: "2.5s", background: "hsl(40 55% 54% / 0.15)" }}
        />
        <div
          className="absolute -inset-4 rounded-full opacity-30 blur-xl"
          style={{ background: "radial-gradient(circle, hsl(40 75% 50% / 0.4), transparent 70%)" }}
        />
        <div
          className="relative w-28 h-28 rounded-full flex items-center justify-center border-2"
          style={{ background: "hsl(40 55% 54% / 0.12)", borderColor: "hsl(40 55% 54% / 0.3)" }}
        >
          <Monitor className="h-14 w-14" style={{ color: "hsl(40 75% 55%)" }} />
        </div>
      </div>

      <h1
        className="text-3xl font-bold mb-2 text-center"
        style={{ color: "hsl(40 60% 92%)" }}
      >
        Totem de Auto-atendimento
      </h1>
      <p
        className="text-lg mb-10 text-center"
        style={{ color: "hsl(40 30% 70% / 0.7)" }}
      >
        Inicializando recursos, por favor aguarde…
      </p>

      {/* Progress bar */}
      <div className="w-full max-w-md mb-10">
        <div
          className="h-2.5 rounded-full overflow-hidden"
          style={{ background: "hsl(350 40% 20%)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-100 ease-linear"
            style={{
              width: `${Math.min(progress, 100)}%`,
              background: "linear-gradient(90deg, hsl(40 55% 54%), hsl(40 75% 55%))",
              boxShadow: "0 0 12px hsl(40 75% 50% / 0.5)",
            }}
          />
        </div>
        <p className="text-xs text-right mt-1.5" style={{ color: "hsl(40 30% 65% / 0.6)" }}>
          {Math.round(Math.min(progress, 100))}%
        </p>
      </div>

      {/* Steps */}
      <div className="w-full max-w-md space-y-3">
        {BOOT_STEPS.map((s, i) => {
          const StepIcon = s.icon;
          const done = i < step;
          const active = i === step;
          return (
            <div
              key={i}
              className={`flex items-center gap-3.5 rounded-xl px-5 py-3.5 transition-all duration-300 border ${
                done
                  ? "animate-fade-in"
                  : active
                  ? "animate-fade-in"
                  : ""
              }`}
              style={{
                background: done
                  ? "hsl(40 55% 54% / 0.1)"
                  : active
                  ? "hsl(40 55% 54% / 0.06)"
                  : "transparent",
                borderColor: done
                  ? "hsl(40 55% 54% / 0.25)"
                  : active
                  ? "hsl(40 55% 54% / 0.15)"
                  : "hsl(350 30% 30% / 0.3)",
              }}
            >
              {done ? (
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "hsl(40 55% 54% / 0.2)" }}>
                  <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: "hsl(40 75% 55%)" }} />
                </div>
              ) : active ? (
                <Loader2 className="h-5 w-5 animate-spin shrink-0" style={{ color: "hsl(40 75% 55%)" }} />
              ) : (
                <StepIcon className="h-5 w-5 shrink-0" style={{ color: "hsl(350 30% 50% / 0.4)" }} />
              )}
              <span
                className={`text-sm font-medium ${done ? "line-through opacity-60" : ""}`}
                style={{
                  color: done
                    ? "hsl(40 60% 70%)"
                    : active
                    ? "hsl(40 60% 85%)"
                    : "hsl(350 20% 50% / 0.4)",
                }}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Totem: React.FC = () => {
  const [booted, setBooted] = useState(false);

  if (!booted) {
    return <TotemBootScreen onDone={() => setBooted(true)} />;
  }

  return (
    <TotemPinGuard>
      <TotemContent />
    </TotemPinGuard>
  );
};

export default Totem;
