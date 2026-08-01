import React, { useState } from "react";
import { ArrowRight } from "lucide-react";

interface TotemValorProps {
  valorSugerido?: number | null;
  onConfirmar: (valor: number) => void;
  tipoLabel?: string;
}

const sugestoes = [20, 50, 100, 150, 200, 300];

const TotemValor: React.FC<TotemValorProps> = ({ valorSugerido, onConfirmar, tipoLabel = "Contribuição" }) => {
  const [digitos, setDigitos] = useState("");

  // Converte digitos em reais (ex: "1234" => 12.34)
  const valorNumerico = digitos ? parseInt(digitos, 10) / 100 : 0;

  const handleTecla = (t: string) => {
    if (t === "←") {
      setDigitos((v) => v.slice(0, -1));
    } else {
      if (digitos.length >= 7) return; // max R$ 99.999,99
      setDigitos((v) => v + t);
    }
  };

  const selecionarSugestao = (v: number) => {
    // converte o valor sugerido para string de centavos
    setDigitos(String(Math.round(v * 100)));
  };

  const confirmar = () => {
    if (valorNumerico >= 1) onConfirmar(valorNumerico);
  };

  const formatarReais = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const teclado = ["1","2","3","4","5","6","7","8","9","←","0","✓"];

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="font-bold text-secondary-foreground" style={{ fontSize: 32 }}>
          Qual o valor da sua {tipoLabel}?
        </h2>
      </div>

      {/* Display do valor */}
      <div
        className="rounded-2xl text-center py-8 px-6 border"
        style={{
          background: "hsl(var(--secondary-foreground) / 0.05)",
          borderColor: "hsl(var(--primary) / 0.4)",
        }}
      >
        <p className="text-secondary-foreground/50 mb-2" style={{ fontSize: 16 }}>
          Valor a pagar
        </p>
        <p
          className="font-bold font-mono"
          style={{
            fontSize: 56,
            color: valorNumerico >= 1 ? "hsl(var(--primary))" : "hsl(var(--secondary-foreground) / 0.3)",
          }}
        >
          {valorNumerico >= 0.01 ? formatarReais(valorNumerico) : "R$ 0,00"}
        </p>
      </div>

      {/* Valores sugeridos */}
      <div>
        <p className="text-secondary-foreground/50 mb-3" style={{ fontSize: 16 }}>
          {valorSugerido ? `Sugerido: ${formatarReais(valorSugerido)} — ou escolha:` : "Valores sugeridos:"}
        </p>
        <div className="grid grid-cols-3 gap-3">
          {(valorSugerido
            ? [valorSugerido, ...sugestoes.filter((v) => v !== valorSugerido)].slice(0, 6)
            : sugestoes
          ).map((v) => (
            <button
              key={v}
              onClick={() => selecionarSugestao(v)}
              className="rounded-2xl py-4 font-bold transition-transform active:scale-95"
              style={{
                fontSize: 20,
                background:
                  valorSugerido === v
                    ? "hsl(var(--primary))"
                    : "hsl(var(--secondary-foreground) / 0.08)",
                color:
                  valorSugerido === v
                    ? "hsl(var(--primary-foreground))"
                    : "hsl(var(--secondary-foreground))",
                border: "1px solid hsl(var(--secondary-foreground) / 0.15)",
              }}
            >
              {formatarReais(v)}
            </button>
          ))}
        </div>
      </div>

      {/* Teclado numérico */}
      <div className="grid grid-cols-3 gap-3">
        {teclado.map((t) => (
          <button
            key={t}
            onClick={() => handleTecla(t)}
            className="rounded-2xl py-5 font-bold transition-transform active:scale-95 select-none"
            style={{
              fontSize: 26,
              background:
                t === "✓"
                  ? valorNumerico >= 1
                    ? "hsl(var(--primary))"
                    : "hsl(var(--secondary-foreground) / 0.1)"
                  : t === "←"
                  ? "hsl(var(--secondary-foreground) / 0.12)"
                  : "hsl(var(--secondary-foreground) / 0.08)",
              color:
                t === "✓"
                  ? valorNumerico >= 1
                    ? "hsl(var(--primary-foreground))"
                    : "hsl(var(--secondary-foreground) / 0.3)"
                  : "hsl(var(--secondary-foreground))",
              border: "1px solid hsl(var(--secondary-foreground) / 0.15)",
            }}
          >
            {t === "✓" ? <ArrowRight className="mx-auto" size={26} /> : t}
          </button>
        ))}
      </div>

      {valorNumerico >= 1 && (
        <button
          onClick={confirmar}
          className="w-full rounded-2xl py-6 font-bold flex items-center justify-center gap-3 transition-transform active:scale-95"
          style={{
            background: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
            fontSize: 24,
          }}
        >
          Confirmar {formatarReais(valorNumerico)} <ArrowRight size={28} />
        </button>
      )}
    </div>
  );
};

export default TotemValor;
