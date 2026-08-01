import React, { useState } from "react";
import { ArrowRight, SkipForward, User, Phone } from "lucide-react";
import TotemTeclado from "../TotemTeclado";

interface TotemNomeOpcionalProps {
  onContinuar: (nome: string, telefone: string) => void;
  titulo?: string;
}

const TotemNomeOpcional: React.FC<TotemNomeOpcionalProps> = ({
  onContinuar,
  titulo = "Identificação (opcional)",
}) => {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [foco, setFoco] = useState<"nome" | "telefone">("nome");

  const maskTel = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    return d
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  };

  const fieldStyle = (ativo: boolean): React.CSSProperties => ({
    fontSize: 22,
    borderColor: ativo ? "hsl(var(--primary))" : "hsl(var(--secondary-foreground) / 0.2)",
    boxShadow: ativo ? "0 0 0 3px hsl(var(--primary) / 0.18)" : "none",
  });

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="font-bold text-secondary-foreground" style={{ fontSize: 30 }}>
          {titulo}
        </h2>
        <p className="text-secondary-foreground/55" style={{ fontSize: 18 }}>
          Toque no campo e use o teclado virtual abaixo.
        </p>
      </div>

      <div className="space-y-4">
        {/* Nome */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-secondary-foreground/70 font-medium" style={{ fontSize: 16 }}>
            <User size={18} /> Nome
          </label>
          <button
            type="button"
            onClick={() => setFoco("nome")}
            className="w-full text-left rounded-2xl px-6 py-4 border bg-white/5 text-secondary-foreground transition-all"
            style={fieldStyle(foco === "nome")}
          >
            {nome || <span className="text-secondary-foreground/30">Seu nome completo</span>}
          </button>
        </div>

        {/* Telefone */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-secondary-foreground/70 font-medium" style={{ fontSize: 16 }}>
            <Phone size={18} /> WhatsApp (para receber comprovante)
          </label>
          <button
            type="button"
            onClick={() => setFoco("telefone")}
            className="w-full text-left rounded-2xl px-6 py-4 border bg-white/5 text-secondary-foreground font-mono transition-all"
            style={fieldStyle(foco === "telefone")}
          >
            {telefone || <span className="text-secondary-foreground/30">(00) 00000-0000</span>}
          </button>
        </div>
      </div>

      {/* Teclado virtual */}
      {foco === "nome" ? (
        <TotemTeclado
          value={nome}
          onChange={setNome}
          maxLength={80}
          layout="abnt2"
          label="Teclado ABNT2"
          onEnter={() => setFoco("telefone")}
        />
      ) : (
        <TotemTeclado
          value={telefone}
          onChange={setTelefone}
          maxLength={15}
          layout="numerico"
          mask={maskTel}
          label="Teclado numérico"
          onEnter={() => onContinuar(nome, telefone)}
        />
      )}

      <div className="flex flex-col gap-3">
        <button
          onClick={() => onContinuar(nome, telefone)}
          className="w-full rounded-2xl py-5 font-bold flex items-center justify-center gap-3 transition-transform active:scale-95"
          style={{
            background: nome ? "hsl(var(--primary))" : "hsl(var(--secondary-foreground) / 0.2)",
            color: nome ? "hsl(var(--primary-foreground))" : "hsl(var(--secondary-foreground))",
            fontSize: 22,
          }}
        >
          Continuar <ArrowRight size={26} />
        </button>

        <button
          onClick={() => onContinuar("", "")}
          className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl border font-medium transition-colors"
          style={{
            borderColor: "hsl(var(--secondary-foreground) / 0.2)",
            color: "hsl(var(--secondary-foreground) / 0.5)",
            fontSize: 16,
          }}
        >
          <SkipForward size={20} />
          Pular — contribuir anonimamente
        </button>
      </div>
    </div>
  );
};

export default TotemNomeOpcional;
