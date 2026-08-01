import React, { useEffect, useState, useRef } from "react";
import { CheckCircle2, Printer, Plus, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { imprimirComprovante } from "@/components/totem/ComprovanteThermal";
import { useTheme } from "@/contexts/ThemeContext";
import logoParoquia from "@/assets/logo-paroquia-pb.png";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  isLocalClientRunning, printComprovante as printLocal,
  type LocalPrintData,
} from "@/lib/local-client";
import { getComprovanteConfig } from "@/lib/comprovante-config";


interface TotemConfirmacaoProps {
  pagamentoId?: string;
  valor: number;
  tipo: string;
  metodo?: string;
  nomeContribuinte?: string;
  paroquianoId?: string;
  mesReferencia?: Date | null;
  onNova: () => void;
}

interface MensagemConfirmacao {
  titulo: string;
  mensagem: string;
  versiculo: string | null;
}

const CITACOES_PADRAO = [
  { ref: "Ml 3,10", texto: "Trazei todos os dízimos ao depósito, para que haja alimento na minha Casa." },
  { ref: "Lc 21,4", texto: "Porque todos esses deram das sobras do que tinham; mas ela, da sua pobreza, deu tudo o que possuía." },
  { ref: "2Cor 9,7", texto: "Cada um dê conforme determinou em seu coração, sem tristeza nem por obrigação, porque Deus ama quem dá com alegria." },
  { ref: "Pv 11,24", texto: "Há quem reparta livremente e ainda enriquece; há quem retenha mais do que é justo e acaba no empobrecimento." },
];

const TotemConfirmacao: React.FC<TotemConfirmacaoProps> = ({
  pagamentoId,
  valor,
  tipo,
  metodo,
  nomeContribuinte,
  paroquianoId,
  mesReferencia,
  onNova,
}) => {
  const { tema } = useTheme();
  const [mensagem, setMensagem] = useState<MensagemConfirmacao | null>(null);
  const [citacao] = useState(() => CITACOES_PADRAO[Math.floor(Math.random() * CITACOES_PADRAO.length)]);
  const [autoReset, setAutoReset] = useState(30);

  const formatarReais = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const tipoLabel: Record<string, string> = {
    dizimo: "Dízimo",
    oferta: "Oferta",
    campanha: "Campanha",
    eventual: "Doação",
  };

  // Buscar mensagem personalizada
  useEffect(() => {
    (async () => {
      try {
        const tiposValidos = ["dizimo", "oferta", "campanha", "eventual"] as const;
        type TipoValido = typeof tiposValidos[number];
        const tipoFiltro = tiposValidos.includes(tipo as TipoValido) ? (tipo as TipoValido) : null;
        if (!tipoFiltro) return;
        const { data } = await supabase
          .from("mensagens_personalizadas")
          .select("titulo, mensagem, versiculo")
          .eq("tipo", tipoFiltro)
          .eq("ativo", true)
          .limit(1)
          .maybeSingle();
        if (data) setMensagem(data);
      } catch { /* usa padrão */ }
    })();
  }, [tipo]);

  // ── Print helpers ──
  const localClientChecked = useRef(false);
  const [localAvailable, setLocalAvailable] = useState(false);

  // Check local client on mount
  useEffect(() => {
    if (localClientChecked.current) return;
    localClientChecked.current = true;
    isLocalClientRunning().then(setLocalAvailable);
  }, []);

  const imprimirViaLocal = async (): Promise<boolean> => {
    if (!localAvailable) return false;
    try {
      let cnpjParoquia: string | undefined;
      let siteParoquia: string | undefined;
      try {
        const { data } = await supabase.rpc('get_tema_paroquia');
        if (data) {
          cnpjParoquia = (data as any).cnpj || undefined;
          siteParoquia = (data as any).site || undefined;
        }
      } catch { /* fallback */ }

      const comprovanteCfg = await getComprovanteConfig().catch(() => undefined);

      const printData: LocalPrintData = {
        pagamentoId,
        valor,
        tipo: tipo as LocalPrintData['tipo'],
        metodo: (metodo || 'pix') as LocalPrintData['metodo'],
        nomeContribuinte,
        mesReferencia: mesReferencia ? format(mesReferencia, 'yyyy-MM-dd') : undefined,
        dataHora: new Date().toISOString(),
        cnpj: cnpjParoquia,
        site: siteParoquia,
        config: comprovanteCfg,
      };


      const result = await printLocal(printData);
      return result.success;
    } catch {
      return false;
    }
  };

  const imprimirViaBrowser = async () => {
    let cnpjParoquia: string | undefined;
    let siteParoquia: string | undefined;
    try {
      const { data } = await supabase.rpc('get_tema_paroquia');
      if (data) {
        cnpjParoquia = (data as any).cnpj || undefined;
        siteParoquia = (data as any).site || undefined;
      }
    } catch { /* fallback */ }

    const logoSrc = tema.logoTermicoUrl || tema.logoUrl || logoParoquia;

    imprimirComprovante(
      {
        pagamentoId,
        valor,
        tipo,
        metodo: metodo || "pix",
        nomeContribuinte,
        mesReferencia: mesReferencia || undefined,
        dataHora: new Date(),
        cnpjParoquia,
        siteParoquia,
      },
      logoSrc
    );
  };

  const imprimir = async () => {
    const ok = await imprimirViaLocal();
    if (!ok) await imprimirViaBrowser();
  };

  // Auto-print only for dízimo; oferta/campanha/eventual are manual
  const isDizimo = tipo === 'dizimo';
  const [jaImprimiu, setJaImprimiu] = useState(false);
  useEffect(() => {
    if (isDizimo && !jaImprimiu) {
      setJaImprimiu(true);
      const t = setTimeout(() => imprimir(), 800);
      return () => clearTimeout(t);
    }
  }, [jaImprimiu, isDizimo]);

  // Send thank-you email
  useEffect(() => {
    if (!pagamentoId) return;
    const enviarEmail = async () => {
      try {
        await supabase.functions.invoke("enviar-email-agradecimento", {
          body: {
            pagamento_id: pagamentoId,
            paroquiano_id: paroquianoId || undefined,
            nome_contribuinte: nomeContribuinte,
            valor,
            tipo,
            metodo: metodo || "pix",
            mes_referencia: mesReferencia ? format(mesReferencia, "yyyy-MM-dd") : undefined,
          },
        });
      } catch (err) {
        console.error("Erro ao enviar e-mail de agradecimento:", err);
      }
    };
    enviarEmail();
  }, [pagamentoId]);

  // Auto-reset countdown
  useEffect(() => {
    const t = setInterval(() => {
      setAutoReset((s) => {
        if (s <= 1) { onNova(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [onNova]);

  return (
    <div className="space-y-8">
      {/* Ícone de sucesso */}
      <div className="flex flex-col items-center gap-4 py-4">
        <CheckCircle2
          style={{ width: 100, height: 100, color: "hsl(142 71% 45%)" }}
          strokeWidth={1.5}
        />
        <h2 className="font-bold text-secondary-foreground text-center" style={{ fontSize: 36 }}>
          Contribuição registrada!
        </h2>
      </div>

      {/* Resumo do pagamento */}
      <div
        className="rounded-3xl p-6 space-y-3"
        style={{
          background: "hsl(var(--secondary-foreground) / 0.05)",
          border: "1px solid hsl(var(--primary) / 0.2)",
        }}
      >
        <div className="flex justify-between items-center">
          <span className="text-secondary-foreground/60" style={{ fontSize: 18 }}>Tipo</span>
          <span className="font-bold text-secondary-foreground" style={{ fontSize: 20 }}>
            {tipoLabel[tipo] || tipo}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-secondary-foreground/60" style={{ fontSize: 18 }}>Valor</span>
          <span className="font-bold text-primary" style={{ fontSize: 24 }}>
            {formatarReais(valor)}
          </span>
        </div>
        {mesReferencia && tipo === "dizimo" && (
          <div className="flex justify-between items-center">
            <span className="text-secondary-foreground/60" style={{ fontSize: 18 }}>Mês de Referência</span>
            <span className="font-bold text-secondary-foreground" style={{ fontSize: 18 }}>
              {format(mesReferencia, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
            </span>
          </div>
        )}
        {nomeContribuinte && (
          <div className="flex justify-between items-center">
            <span className="text-secondary-foreground/60" style={{ fontSize: 18 }}>{tipo === 'dizimo' ? 'Dizimista' : 'Fiel'}</span>
            <span className="font-medium text-secondary-foreground" style={{ fontSize: 18 }}>
              {nomeContribuinte}
            </span>
          </div>
        )}
        {pagamentoId && (
          <div className="flex justify-between items-center">
            <span className="text-secondary-foreground/60" style={{ fontSize: 14 }}>ID</span>
            <span className="font-mono text-secondary-foreground/50" style={{ fontSize: 13 }}>
              #{pagamentoId.slice(0, 8).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Mensagem personalizada ou padrão */}
      <div
        className="rounded-3xl p-6 space-y-3 text-center"
        style={{
          background: "hsl(var(--primary) / 0.1)",
          border: "1px solid hsl(var(--primary) / 0.25)",
        }}
      >
        <p className="font-bold text-primary" style={{ fontSize: 22 }}>
          {mensagem?.titulo || "Deus lhe pague! 🙏"}
        </p>
        <p className="text-secondary-foreground/70" style={{ fontSize: 18, lineHeight: 1.6 }}>
          {mensagem?.mensagem ||
            `${nomeContribuinte ? `Obrigado, ${nomeContribuinte.split(" ")[0]}! ` : ""}Sua generosidade sustenta a missão da Paróquia Senhor Santo Cristo dos Milagres.`}
        </p>
      </div>

      {/* Citação bíblica */}
      <div
        className="rounded-2xl p-5 flex gap-4 items-start"
        style={{
          background: "hsl(var(--secondary-foreground) / 0.05)",
          border: "1px solid hsl(var(--secondary-foreground) / 0.12)",
        }}
      >
        <BookOpen size={28} className="shrink-0 mt-1" style={{ color: "hsl(var(--primary))" }} />
        <div>
          <p
            className="text-secondary-foreground/70 italic"
            style={{ fontSize: 17, lineHeight: 1.6 }}
          >
            "{mensagem?.versiculo ? mensagem.versiculo.split("|")[0] : citacao.texto}"
          </p>
          <p className="text-primary font-bold mt-2" style={{ fontSize: 16 }}>
            {mensagem?.versiculo ? mensagem.versiculo.split("|")[1] || citacao.ref : citacao.ref}
          </p>
        </div>
      </div>

      {/* Botões */}
      <div className="flex gap-4">
        <button
          onClick={() => { if (!jaImprimiu) setJaImprimiu(true); imprimir(); }}
          className="flex-1 rounded-2xl py-5 font-bold flex items-center justify-center gap-3 transition-transform active:scale-95"
          style={{
            background: "hsl(var(--secondary-foreground) / 0.1)",
            border: "2px solid hsl(var(--secondary-foreground) / 0.2)",
            color: "hsl(var(--secondary-foreground))",
            fontSize: 20,
          }}
        >
          <Printer size={24} />
          {isDizimo
            ? (jaImprimiu ? 'Imprimir 2ª Via' : 'Imprimindo...')
            : 'Imprimir Comprovante'}
        </button>

        <button
          onClick={onNova}
          className="flex-1 rounded-2xl py-5 font-bold flex items-center justify-center gap-3 transition-transform active:scale-95"
          style={{
            background: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
            fontSize: 20,
          }}
        >
          <Plus size={24} /> Nova Contribuição
        </button>
      </div>

      {/* Auto-reset */}
      <p className="text-center text-secondary-foreground/40" style={{ fontSize: 14 }}>
        Voltando para o início em {autoReset} segundos...
      </p>
    </div>
  );
};

export default TotemConfirmacao;
