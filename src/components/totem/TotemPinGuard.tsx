import React, { useState, useEffect } from "react";
import { Shield, Delete } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoParoquia from "@/assets/logo-paroquia.png";

interface TotemPinGuardProps {
  children: React.ReactNode;
}

const TotemPinGuard: React.FC<TotemPinGuardProps> = ({ children }) => {
  const [liberado, setLiberado] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [temPin, setTemPin] = useState(false);
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState(false);
  const [validando, setValidando] = useState(false);

  // Verificar se existe PIN configurado
  useEffect(() => {
    checkPinConfig();
  }, []);

  const checkPinConfig = async () => {
    try {
      // Usar o PIN "0000" como probe — a edge function retorna sem_pin se não há PIN configurado
      const { data } = await supabase.functions.invoke("totem-pin", {
        body: { pin: "0000" },
      });
      // Se sem_pin = true, não há PIN configurado — liberar acesso
      if (data?.sem_pin) {
        setLiberado(true);
      } else {
        // Há PIN configurado — mostrar tela de PIN
        setTemPin(true);
      }
    } catch {
      // Em caso de erro na edge function, liberar (fail open para não bloquear o totem)
      setLiberado(true);
    } finally {
      setVerificando(false);
    }
  };

  const handleTecla = (t: string) => {
    if (t === "DEL") {
      setPin((p) => p.slice(0, -1));
      setErro(false);
    } else if (t !== "" && pin.length < 8) {
      const novoPin = pin + t;
      setPin(novoPin);
      setErro(false);
      // Auto-submit quando atingir 4 dígitos (PIN padrão)
      if (novoPin.length >= 4) {
        validarPin(novoPin);
      }
    }
  };

  const validarPin = async (pinAtual: string) => {
    setValidando(true);
    try {
      const { data, error } = await supabase.functions.invoke("totem-pin", {
        body: { pin: pinAtual },
      });

      if (error) throw error;

      if (data?.valid || data?.sem_pin) {
        setLiberado(true);
      } else {
        setErro(true);
        setPin("");
        setTimeout(() => setErro(false), 2000);
      }
    } catch {
      setErro(true);
      setPin("");
      setTimeout(() => setErro(false), 2000);
    } finally {
      setValidando(false);
    }
  };

  if (verificando) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "hsl(var(--background))" }}
      >
        <div
          className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"
        />
      </div>
    );
  }

  if (liberado) return <>{children}</>;

  // Tela de PIN
  const teclado = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "DEL"];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-8 px-8"
      style={{ background: "hsl(var(--background))" }}
    >
      {/* Logo */}
      <img src={logoParoquia} alt="Paróquia" style={{ height: 80, objectFit: "contain" }} />

      <div className="text-center space-y-2">
        <Shield size={40} style={{ color: "hsl(var(--primary))", margin: "0 auto 8px" }} />
        <h2 className="font-bold text-secondary-foreground" style={{ fontSize: 28 }}>
          Acesso ao Totem
        </h2>
        <p className="text-secondary-foreground/55" style={{ fontSize: 18 }}>
          Digite o PIN de operador para liberar o terminal
        </p>
      </div>

      {/* Display do PIN */}
      <div className="flex gap-4 items-center justify-center">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl flex items-center justify-center border-2 transition-all"
            style={{
              width: 64,
              height: 64,
              borderColor: erro
                ? "hsl(var(--destructive))"
                : pin.length > i
                ? "hsl(var(--primary))"
                : "hsl(var(--secondary-foreground) / 0.2)",
              background: erro
                ? "hsl(var(--destructive) / 0.1)"
                : pin.length > i
                ? "hsl(var(--primary) / 0.12)"
                : "hsl(var(--secondary-foreground) / 0.05)",
            }}
          >
            {pin.length > i && (
              <div
                className="rounded-full"
                style={{
                  width: 20,
                  height: 20,
                  background: erro
                    ? "hsl(var(--destructive))"
                    : "hsl(var(--primary))",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {erro && (
        <p className="text-destructive font-semibold" style={{ fontSize: 18 }}>
          PIN incorreto. Tente novamente.
        </p>
      )}

      {validando && (
        <p className="text-secondary-foreground/50" style={{ fontSize: 16 }}>
          Verificando...
        </p>
      )}

      {/* Teclado numérico */}
      <div className="grid grid-cols-3 gap-3 w-72">
        {teclado.map((t, idx) => (
          <button
            key={idx}
            onClick={() => t !== "" && handleTecla(t)}
            disabled={validando || t === ""}
            className="rounded-2xl py-5 font-bold transition-transform active:scale-95 select-none"
            style={{
              fontSize: 24,
              background:
                t === "DEL"
                  ? "hsl(var(--secondary-foreground) / 0.12)"
                  : t === ""
                  ? "transparent"
                  : "hsl(var(--secondary-foreground) / 0.08)",
              color:
                t === "DEL"
                  ? "hsl(var(--secondary-foreground))"
                  : t === ""
                  ? "transparent"
                  : "hsl(var(--secondary-foreground))",
              border: t === "" ? "none" : "1px solid hsl(var(--secondary-foreground) / 0.15)",
              cursor: t === "" ? "default" : "pointer",
            }}
          >
            {t === "DEL" ? <Delete size={22} style={{ margin: "0 auto" }} /> : t}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TotemPinGuard;
