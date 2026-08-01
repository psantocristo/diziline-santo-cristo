import React, { useState } from "react";
import { Delete, CornerDownLeft, ArrowBigUp, Space } from "lucide-react";

export type TecladoLayout = "abnt2" | "numerico";

interface TotemTecladoProps {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  layout?: TecladoLayout;
  maxLength?: number;
  /** Para campos numéricos com máscara: aplica antes de chamar onChange */
  mask?: (raw: string) => string;
  /** Mostra dica de campo ativo */
  label?: string;
}

// Layout ABNT2 simplificado, otimizado para portrait (touch)
const ROWS_LETRAS_LOWER = [
  ["1","2","3","4","5","6","7","8","9","0"],
  ["q","w","e","r","t","y","u","i","o","p"],
  ["a","s","d","f","g","h","j","k","l","ç"],
  ["z","x","c","v","b","n","m",",",".","-"],
];
const ROWS_LETRAS_UPPER = ROWS_LETRAS_LOWER.map((r) =>
  r.map((k) => (/[a-zç]/.test(k) ? k.toUpperCase() : k))
);
const ROWS_SIMBOLOS = [
  ["1","2","3","4","5","6","7","8","9","0"],
  ["@",".","_","-","+","=","/","\\",":",";"],
  ["(",")","[","]","{","}","<",">","'","\""],
  ["!","?","#","$","%","&","*","|","~","^"],
];
const ROWS_NUMERICO = [
  ["1","2","3"],
  ["4","5","6"],
  ["7","8","9"],
  [".","0","-"],
];

const TotemTeclado: React.FC<TotemTecladoProps> = ({
  value,
  onChange,
  onEnter,
  layout = "abnt2",
  maxLength = 200,
  mask,
  label,
}) => {
  const [shift, setShift] = useState(false);
  const [simbolos, setSimbolos] = useState(false);

  const apply = (next: string) => {
    const trimmed = next.slice(0, maxLength);
    onChange(mask ? mask(trimmed) : trimmed);
  };

  const press = (k: string) => apply(value + k);
  const backspace = () => apply(value.slice(0, -1));
  const space = () => apply(value + " ");

  const rows =
    layout === "numerico"
      ? ROWS_NUMERICO
      : simbolos
        ? ROWS_SIMBOLOS
        : shift
          ? ROWS_LETRAS_UPPER
          : ROWS_LETRAS_LOWER;

  const keyBase: React.CSSProperties = {
    background: "hsl(var(--secondary-foreground) / 0.08)",
    color: "hsl(var(--secondary-foreground))",
    border: "1px solid hsl(var(--secondary-foreground) / 0.15)",
    borderRadius: 14,
    fontWeight: 600,
    fontSize: layout === "numerico" ? 28 : 22,
    padding: layout === "numerico" ? "18px 0" : "14px 0",
    transition: "transform 0.05s",
    userSelect: "none",
    touchAction: "manipulation",
  };

  const accentKey: React.CSSProperties = {
    ...keyBase,
    background: "hsl(var(--primary) / 0.18)",
    color: "hsl(var(--primary))",
  };

  return (
    <div
      className="rounded-2xl p-3 space-y-2 select-none"
      style={{
        background: "hsl(var(--secondary-foreground) / 0.04)",
        border: "1px solid hsl(var(--secondary-foreground) / 0.1)",
      }}
    >
      {label && (
        <div
          className="text-center font-medium pb-1"
          style={{ fontSize: 14, color: "hsl(var(--secondary-foreground) / 0.55)" }}
        >
          {label}
        </div>
      )}

      {rows.map((row, ri) => (
        <div
          key={ri}
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
        >
          {row.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              className="active:scale-95"
              style={keyBase}
            >
              {k}
            </button>
          ))}
        </div>
      ))}

      {/* Linha de controles */}
      {layout === "abnt2" ? (
        <div className="grid gap-2" style={{ gridTemplateColumns: "1.4fr 1.4fr 3fr 1.4fr 1.6fr" }}>
          <button
            type="button"
            onClick={() => setShift((s) => !s)}
            className="active:scale-95 flex items-center justify-center gap-1"
            style={{ ...keyBase, ...(shift ? accentKey : {}) }}
          >
            <ArrowBigUp size={22} /> Aa
          </button>
          <button
            type="button"
            onClick={() => setSimbolos((s) => !s)}
            className="active:scale-95"
            style={{ ...keyBase, ...(simbolos ? accentKey : {}) }}
          >
            {simbolos ? "ABC" : "?123"}
          </button>
          <button
            type="button"
            onClick={space}
            className="active:scale-95 flex items-center justify-center gap-2"
            style={keyBase}
          >
            <Space size={22} /> Espaço
          </button>
          <button
            type="button"
            onClick={backspace}
            className="active:scale-95 flex items-center justify-center"
            style={{ ...keyBase, background: "hsl(var(--destructive) / 0.15)", color: "hsl(var(--destructive))" }}
          >
            <Delete size={22} />
          </button>
          <button
            type="button"
            onClick={() => onEnter?.()}
            className="active:scale-95 flex items-center justify-center gap-1"
            style={{ ...keyBase, background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
          >
            <CornerDownLeft size={22} /> OK
          </button>
        </div>
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <button
            type="button"
            onClick={backspace}
            className="active:scale-95 flex items-center justify-center gap-2"
            style={{ ...keyBase, background: "hsl(var(--destructive) / 0.15)", color: "hsl(var(--destructive))" }}
          >
            <Delete size={22} /> Apagar
          </button>
          <button
            type="button"
            onClick={() => onEnter?.()}
            className="active:scale-95 flex items-center justify-center gap-2"
            style={{ ...keyBase, background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
          >
            <CornerDownLeft size={22} /> OK
          </button>
        </div>
      )}
    </div>
  );
};

export default TotemTeclado;
