import React, { useState } from "react";
import { Search, ArrowRight, SkipForward, UserCheck, AlertCircle, Heart, CreditCard, Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { validarCPF, formatarCPF } from "@/lib/cpf";

interface Paroquiano {
  id: string;
  nome_completo: string;
  valor_sugerido: number | null;
  matricula_paroquial: string | null;
}

interface TotemIdentificacaoProps {
  onIdentificado: (paroquiano: Paroquiano | null) => void;
  obrigatorio?: boolean;
}

const PREFIXO = "DIZSC-";

const TotemIdentificacao: React.FC<TotemIdentificacaoProps> = ({ onIdentificado, obrigatorio = false }) => {
  const [digits, setDigits] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [encontrado, setEncontrado] = useState<Paroquiano | null>(null);

  const isCpf = digits.length === 11;
  const isMatricula = digits.length > 0 && digits.length !== 11;

  const handleChange = (raw: string) => {
    setErro("");
    setEncontrado(null);
    const onlyDigits = raw.replace(/\D/g, "").slice(0, 11);
    setDigits(onlyDigits);
  };

  const formatDisplay = () => {
    if (!digits) return null;
    if (isCpf) return formatarCPF(digits);
    return `${PREFIXO}${digits}`;
  };

  const podeBuscar = digits.length >= 1;

  const buscar = async () => {
    if (!podeBuscar) return;

    // Validar CPF antes de buscar
    if (isCpf && !validarCPF(digits)) {
      setErro("CPF inválido. Verifique os números digitados.");
      return;
    }

    setCarregando(true);
    setErro("");
    try {
      const { data, error } = await supabase.functions.invoke("totem-buscar-paroquiano", {
        body: { valor: digits },
      });

      if (error) throw error;

      if (data?.encontrado && data?.paroquiano) {
        setEncontrado(data.paroquiano);
      } else {
        setErro(
          isCpf
            ? "Nenhum dizimista encontrado com esse CPF."
            : "Nenhum dizimista encontrado com essa matrícula."
        );
      }
    } catch {
      setErro("Erro ao buscar. Tente novamente ou pule a identificação.");
    } finally {
      setCarregando(false);
    }
  };

  const confirmar = () => {
    if (encontrado) onIdentificado(encontrado);
  };

  const displayValue = formatDisplay();

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="font-bold text-secondary-foreground" style={{ fontSize: 32 }}>
          Identificação do Dizimista
        </h2>
        <p className="text-secondary-foreground/60" style={{ fontSize: 20 }}>
          Digite seu código de matrícula ou CPF
        </p>
      </div>

      {/* Display inteligente */}
      <div
        className="rounded-2xl px-8 py-5 text-center font-mono font-bold border"
        style={{
          fontSize: 36,
          background: "hsl(var(--secondary-foreground) / 0.05)",
          borderColor: "hsl(var(--primary) / 0.4)",
          color: "hsl(var(--secondary-foreground))",
          letterSpacing: isCpf ? 2 : 4,
          minHeight: 90,
        }}
      >
        {displayValue ? (
          <span style={{ color: "hsl(var(--primary))" }}>{displayValue}</span>
        ) : (
          <span style={{ opacity: 0.3 }}>Digite os números…</span>
        )}
      </div>

      {/* Label de detecção */}
      {digits.length > 0 && !encontrado && (
        <div className="flex items-center justify-center gap-2" style={{ color: "hsl(var(--secondary-foreground) / 0.5)", fontSize: 16 }}>
          {isCpf ? (
            <>
              <CreditCard size={18} />
              <span>Detectado como <strong>CPF</strong></span>
            </>
          ) : (
            <>
              <Hash size={18} />
              <span>Detectado como <strong>Matrícula</strong> ({PREFIXO}{digits})</span>
            </>
          )}
        </div>
      )}

      {/* Campo de entrada + botão buscar */}
      {!encontrado && (
        <div className="flex gap-4">
          <input
            type="text"
            inputMode="numeric"
            value={digits}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Ex: 00123 ou 12345678900"
            className="flex-1 rounded-2xl px-6 py-5 font-mono font-bold border bg-white/5 text-secondary-foreground placeholder:text-secondary-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary"
            style={{ fontSize: 24 }}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && buscar()}
          />
          <button
            onClick={buscar}
            disabled={carregando || !podeBuscar}
            className="rounded-2xl px-8 flex items-center gap-2 font-bold transition-transform active:scale-95"
            style={{
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
              fontSize: 20,
              opacity: !podeBuscar || carregando ? 0.5 : 1,
            }}
          >
            {carregando ? (
              <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Search size={24} /> Buscar
              </>
            )}
          </button>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div
          className="flex items-center gap-3 rounded-2xl p-5"
          style={{ background: "hsl(var(--destructive) / 0.15)", border: "1px solid hsl(var(--destructive) / 0.3)" }}
        >
          <AlertCircle className="text-destructive shrink-0" size={28} />
          <p className="text-destructive font-medium" style={{ fontSize: 18 }}>{erro}</p>
        </div>
      )}

      {/* Banner de boas-vindas + card de confirmação */}
      {encontrado && (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500">
          <div
            className="rounded-3xl p-7 text-center space-y-2"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.75))",
              boxShadow: "0 8px 32px hsl(var(--primary) / 0.35)",
            }}
          >
            <Heart
              className="mx-auto mb-2"
              size={44}
              style={{ color: "hsl(var(--primary-foreground))", fill: "hsl(var(--primary-foreground) / 0.3)" }}
            />
            <p className="font-bold" style={{ fontSize: 30, color: "hsl(var(--primary-foreground))", lineHeight: 1.2 }}>
              Que bom que você está aqui!
            </p>
            <p className="font-semibold opacity-90" style={{ fontSize: 26, color: "hsl(var(--primary-foreground))", letterSpacing: 0.5 }}>
              {encontrado.nome_completo}
            </p>
            {encontrado.valor_sugerido && (
              <p className="opacity-70" style={{ fontSize: 17, color: "hsl(var(--primary-foreground))" }}>
                Dízimo sugerido: R$ {encontrado.valor_sugerido.toFixed(2)}
              </p>
            )}
          </div>

          <div
            className="rounded-2xl p-6 space-y-4"
            style={{ background: "hsl(var(--secondary-foreground) / 0.06)", border: "1px solid hsl(var(--primary) / 0.25)" }}
          >
            <div className="flex items-center gap-4">
              <UserCheck className="text-primary shrink-0" size={28} />
              <p className="text-secondary-foreground/70 font-medium" style={{ fontSize: 18 }}>
                Confirme que é você para continuar
              </p>
            </div>
            <button
              onClick={confirmar}
              className="w-full rounded-2xl py-5 font-bold flex items-center justify-center gap-3 transition-transform active:scale-95"
              style={{
                background: "hsl(var(--primary))",
                color: "hsl(var(--primary-foreground))",
                fontSize: 22,
              }}
            >
              Sou eu! Continuar <ArrowRight size={26} />
            </button>
          </div>
        </div>
      )}

      {/* Pular identificação (só quando não obrigatório) */}
      {!encontrado && !obrigatorio && (
        <button
          onClick={() => onIdentificado(null)}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border font-medium transition-colors"
          style={{
            borderColor: "hsl(var(--secondary-foreground) / 0.2)",
            color: "hsl(var(--secondary-foreground) / 0.5)",
            fontSize: 18,
          }}
        >
          <SkipForward size={22} />
          Pular — contribuir sem identificação
        </button>
      )}
    </div>
  );
};

export default TotemIdentificacao;
