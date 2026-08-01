import React, { useState } from "react";
import { CreditCard, ArrowRight, Lock } from "lucide-react";
import TotemBeneficiario from "@/components/totem/TotemBeneficiario";
import GatewaySecurityBadge from "@/components/GatewaySecurityBadge";
import { supabase } from "@/integrations/supabase/client";

interface TotemCartaoProps {
  valor: number;
  tipo: "credito" | "debito";
  pagamentoId: string | null;
  paroquianoId: string | null;
  onPago: () => void;
  onTrocarMetodo: () => void;
}

function maskCard(v: string): string {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})/g, "$1 ").trim();
}
function maskExpiry(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d;
}
function maskCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function validarCpf(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(d[i]) * (10 - i);
  let r = (soma * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(d[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(d[i]) * (11 - i);
  r = (soma * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(d[10]);
}

const TotemCartao: React.FC<TotemCartaoProps> = ({ valor, tipo, pagamentoId, paroquianoId, onPago, onTrocarMetodo }) => {
  const [numero, setNumero] = useState("");
  const [nome, setNome] = useState("");
  const [validade, setValidade] = useState("");
  const [cvv, setCvv] = useState("");
  const [cpf, setCpf] = useState("");
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const formatarReais = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const [mesStr] = validade.split("/");
  const mesNum = parseInt(mesStr, 10);
  const mesValida = validade.length === 5 && !isNaN(mesNum) && mesNum >= 1 && mesNum <= 12;

  // CPF só é necessário quando não há dizimista identificado
  const precisaCpf = !paroquianoId;
  const cpfDigitado = cpf.replace(/\D/g, "");
  const cpfValido = !precisaCpf || validarCpf(cpf);

  const valido =
    numero.replace(/\s/g, "").length === 16 &&
    nome.length > 2 &&
    mesValida &&
    cvv.length >= 3 &&
    cpfValido;

  const processar = async () => {
    if (!valido) return;
    setProcessando(true);
    setErro(null);

    try {
      const body: Record<string, unknown> = {
        action: "create-card",
        pagamento_id: pagamentoId,
        valor,
        tipo,
        card: {
          numero: numero.replace(/\s/g, ""),
          nome,
          validade,
          cvv,
        },
      };

      // Para pagamentos anônimos, envia CPF; para dizimistas, o gateway busca server-side
      if (precisaCpf) {
        body.cpf = cpfDigitado;
      }

      const { data, error } = await supabase.functions.invoke("rede-gateway-totem", { body });

      if (error) throw new Error(error.message);

      if (data?.success) {
        onPago();
      } else {
        throw new Error(data?.message || "Pagamento recusado. Verifique os dados do cartão.");
      }
    } catch (err: any) {
      setErro(err.message || "Erro ao processar pagamento.");
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="space-y-7">
      <div className="text-center space-y-2">
        <h2 className="font-bold text-secondary-foreground" style={{ fontSize: 32 }}>
          Cartão de {tipo === "credito" ? "Crédito" : "Débito"}
        </h2>
        <p className="text-secondary-foreground/60" style={{ fontSize: 20 }}>
          Total: <span className="text-primary font-bold">{formatarReais(valor)}</span>
        </p>
        {!precisaCpf && (
          <p className="text-primary/70" style={{ fontSize: 14 }}>
            ✓ CPF identificado automaticamente pelo seu registro
          </p>
        )}
      </div>

      {/* Visual do cartão */}
      <div
        className="rounded-3xl p-7 space-y-6"
        style={{
          background: "var(--gradient-hero)",
          border: "1px solid hsl(var(--primary) / 0.3)",
        }}
      >
        <div className="flex justify-between items-start">
          <CreditCard style={{ width: 44, height: 44, color: "hsl(var(--primary))" }} />
          <span className="text-secondary-foreground/50 font-medium" style={{ fontSize: 16 }}>
            {tipo === "credito" ? "CRÉDITO" : "DÉBITO"}
          </span>
        </div>
        <p className="font-mono tracking-widest text-secondary-foreground" style={{ fontSize: 28 }}>
          {numero || "•••• •••• •••• ••••"}
        </p>
        <div className="flex justify-between">
          <p className="text-secondary-foreground/70 font-medium" style={{ fontSize: 18 }}>
            {nome.toUpperCase() || "NOME DO TITULAR"}
          </p>
          <p className="text-secondary-foreground/70 font-mono" style={{ fontSize: 18 }}>
            {validade || "MM/AA"}
          </p>
        </div>
      </div>

      {/* Campos do cartão */}
      <div className="space-y-4">
        <input
          type="text"
          inputMode="numeric"
          value={numero}
          onChange={(e) => setNumero(maskCard(e.target.value))}
          placeholder="Número do cartão"
          className="w-full rounded-2xl px-6 py-5 border bg-white/5 text-secondary-foreground placeholder:text-secondary-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary font-mono"
          style={{ fontSize: 22 }}
          autoComplete="off"
        />
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value.toUpperCase().slice(0, 26))}
          placeholder="Nome impresso no cartão"
          className="w-full rounded-2xl px-6 py-5 border bg-white/5 text-secondary-foreground placeholder:text-secondary-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary"
          style={{ fontSize: 22 }}
          autoComplete="off"
        />
        <div className="flex gap-4">
          <div className="flex-1 space-y-1">
            <input
              type="text"
              inputMode="numeric"
              value={validade}
              onChange={(e) => setValidade(maskExpiry(e.target.value))}
              placeholder="MM/AA (ex: 01/35)"
              className="w-full rounded-2xl px-6 py-5 border bg-white/5 text-secondary-foreground placeholder:text-secondary-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              style={{ fontSize: 22 }}
              autoComplete="off"
            />
            {validade.length === 5 && !mesValida && (
              <p className="text-xs px-2" style={{ color: "hsl(var(--destructive))", fontSize: 14 }}>
                Mês inválido. Use 01 a 12 (ex: 01/35)
              </p>
            )}
          </div>
          <input
            type="password"
            inputMode="numeric"
            value={cvv}
            onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="CVV"
            className="w-32 rounded-2xl px-6 py-5 border bg-white/5 text-secondary-foreground placeholder:text-secondary-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary font-mono"
            style={{ fontSize: 22 }}
            autoComplete="off"
          />
        </div>

        {/* Campo CPF — apenas para pagamentos anônimos (oferta, eventual, etc.) */}
        {precisaCpf && (
          <div className="space-y-1">
            <input
              type="text"
              inputMode="numeric"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              placeholder="CPF do titular (ex: 123.456.789-09)"
              className="w-full rounded-2xl px-6 py-5 border bg-white/5 text-secondary-foreground placeholder:text-secondary-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              style={{ fontSize: 22 }}
              autoComplete="off"
            />
            {cpfDigitado.length === 11 && !cpfValido && (
              <p className="text-xs px-2" style={{ color: "hsl(var(--destructive))", fontSize: 14 }}>
                CPF inválido. Verifique os números digitados.
              </p>
            )}
            {cpfDigitado.length > 0 && cpfDigitado.length < 11 && (
              <p className="px-2" style={{ color: "hsl(var(--secondary-foreground) / 0.45)", fontSize: 14 }}>
                CPF obrigatório para pagamento com cartão
              </p>
            )}
          </div>
        )}
      </div>

      {/* Erro */}
      {erro && (
        <div
          className="rounded-2xl p-4 text-center"
          style={{
            background: "hsl(var(--destructive) / 0.15)",
            border: "1px solid hsl(var(--destructive) / 0.3)",
            color: "hsl(var(--destructive))",
            fontSize: 18,
          }}
        >
          {erro}
        </div>
      )}

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

      <button
        onClick={processar}
        disabled={!valido || processando}
        className="w-full rounded-2xl py-6 font-bold flex items-center justify-center gap-3 transition-transform active:scale-95"
        style={{
          background: valido && !processando ? "hsl(var(--primary))" : "hsl(var(--secondary-foreground) / 0.2)",
          color: valido && !processando ? "hsl(var(--primary-foreground))" : "hsl(var(--secondary-foreground) / 0.4)",
          fontSize: 24,
        }}
      >
        {processando ? (
          <>
            <div className="w-7 h-7 border-4 border-current border-t-transparent rounded-full animate-spin" />
            Processando...
          </>
        ) : (
          <>
            <Lock size={26} /> Pagar {formatarReais(valor)} <ArrowRight size={26} />
          </>
        )}
      </button>

      <div className="flex flex-col items-center gap-2 pt-2">
        <p className="text-secondary-foreground/40 flex items-center gap-2" style={{ fontSize: 13 }}>
          <Lock size={13} /> Conexão segura
        </p>
        <GatewaySecurityBadge variant="full" className="opacity-80" />
      </div>


      <TotemBeneficiario />
    </div>
  );
};

export default TotemCartao;
