import React, { useEffect, useState, useRef } from "react";
import { Hand, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoFallback from "@/assets/logo-paroquia.png";
import { useTheme } from "@/contexts/ThemeContext";

interface Aviso {
  id: string;
  titulo: string;
  mensagem: string;
  cor: string | null;
  imagem_url: string | null;
  duracao_segundos: number | null;
}

interface TotemScreensaverProps {
  onDismiss: () => void;
}

/**
 * Modo descanso / anúncios em tela cheia.
 * - Carrega avisos com `tela_cheia = true` e `ativo = true`.
 * - Transições suaves cross-fade + Ken Burns.
 * - Qualquer toque/clique encerra e devolve o totem ao usuário.
 */
const TotemScreensaver: React.FC<TotemScreensaverProps> = ({ onDismiss }) => {
  const { tema } = useTheme();
  const logoSrc = tema.logoUrl || logoFallback;
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(new Date());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Atualiza relógio
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  // Carrega avisos
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("avisos_totem")
        .select("id, titulo, mensagem, cor, imagem_url, duracao_segundos, tela_cheia, ativo, ordem")
        .eq("ativo", true)
        .eq("tela_cheia", true)
        .order("ordem", { ascending: true });
      setAvisos((data || []) as Aviso[]);
    })();
  }, []);

  // Avança slides
  useEffect(() => {
    if (avisos.length === 0) return;
    const dur = Math.max(4, avisos[index]?.duracao_segundos || 8) * 1000;
    timerRef.current = setTimeout(() => {
      setIndex((i) => (i + 1) % avisos.length);
    }, dur);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [index, avisos]);

  // Dismiss robusto: exige toque/clique deliberado.
  // - Ignora movimentos do mouse (evita acordar por mouse acidental).
  // - Para pointer/touch: exige down + up no mesmo ponto (<12px), duração 40-800ms.
  // - Debounce de 600ms após montar (evita capturar o toque que abriu).
  // - Teclas: somente Enter/Espaço/Escape encerram.
  useEffect(() => {
    const mountedAt = Date.now();
    const MIN_DELAY = 600;
    const MAX_MOVE = 12;
    const MIN_DUR = 40;
    const MAX_DUR = 800;
    let startX = 0;
    let startY = 0;
    let startT = 0;
    let tracking = false;
    let dismissed = false;

    const safeDismiss = () => {
      if (dismissed) return;
      if (Date.now() - mountedAt < MIN_DELAY) return;
      dismissed = true;
      onDismiss();
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      tracking = true;
      startX = e.clientX;
      startY = e.clientY;
      startT = Date.now();
    };
    const onUp = (e: PointerEvent) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const dist = Math.hypot(dx, dy);
      const dur = Date.now() - startT;
      if (dist <= MAX_MOVE && dur >= MIN_DUR && dur <= MAX_DUR) {
        safeDismiss();
      }
    };
    const onCancel = () => {
      tracking = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (["Enter", " ", "Spacebar", "Escape"].includes(e.key)) safeDismiss();
    };

    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onCancel, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
    };
  }, [onDismiss]);

  const current = avisos[index];
  const accent = current?.cor || "hsl(var(--primary))";
  const hora = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const data = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden cursor-pointer animate-fade-in"
      style={{ background: "hsl(var(--secondary))" }}
      role="button"
      aria-label="Toque para começar"
    >
      {/* Slides com cross-fade */}
      <div className="absolute inset-0">
        {avisos.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-8">
              <img src={logoSrc} alt="" className="h-48 w-auto mx-auto drop-shadow-2xl animate-fade-in" />
              <div
                className="font-extrabold tracking-tight"
                style={{ fontSize: "clamp(48px, 6vw, 96px)", color: "hsl(var(--secondary-foreground))" }}
              >
                Bem-vindo
              </div>
            </div>
          </div>
        ) : (
          avisos.map((a, i) => {
            const active = i === index;
            return (
              <div
                key={a.id}
                className="absolute inset-0 transition-opacity ease-in-out"
                style={{
                  opacity: active ? 1 : 0,
                  transitionDuration: "1400ms",
                  pointerEvents: active ? "auto" : "none",
                }}
              >
                {/* Imagem com Ken Burns */}
                {a.imagem_url ? (
                  <>
                    <img
                      src={a.imagem_url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{
                        animation: active ? "kenburns 20s ease-out forwards" : "none",
                        transform: "scale(1.05)",
                      }}
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.85) 100%)",
                      }}
                    />
                  </>
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `radial-gradient(ellipse at 30% 20%, ${a.cor || "hsl(var(--primary))"}40 0%, hsl(var(--secondary)) 70%)`,
                    }}
                  />
                )}

                {/* Conteúdo do aviso */}
                <div className="relative h-full flex flex-col justify-end p-10 sm:p-16 lg:p-24 pb-40">
                  <div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 w-fit backdrop-blur-md"
                    style={{
                      background: `${accent}33`,
                      border: `1px solid ${accent}66`,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ background: accent }}
                    />
                    <span
                      className="uppercase tracking-widest font-semibold"
                      style={{ fontSize: 14, color: "#fff" }}
                    >
                      Aviso Paroquial
                    </span>
                  </div>

                  <h1
                    className="font-extrabold tracking-tight text-white drop-shadow-2xl animate-fade-in"
                    style={{
                      fontSize: "clamp(40px, 5.5vw, 88px)",
                      lineHeight: 1.05,
                      maxWidth: "85%",
                    }}
                  >
                    {a.titulo}
                  </h1>
                  <p
                    className="mt-6 text-white/90 font-light max-w-4xl animate-fade-in"
                    style={{
                      fontSize: "clamp(20px, 2.2vw, 36px)",
                      lineHeight: 1.35,
                    }}
                  >
                    {a.mensagem}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Header — logo + relógio */}
      <div className="absolute top-0 left-0 right-0 p-8 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="bg-white/95 rounded-2xl p-3 shadow-lg backdrop-blur">
            <img src={logoSrc} alt="" className="h-12 w-auto" />
          </div>
        </div>
        <div className="text-right text-white drop-shadow-lg">
          <div className="font-mono font-bold" style={{ fontSize: "clamp(28px, 3vw, 44px)" }}>
            {hora}
          </div>
          <div className="capitalize opacity-80" style={{ fontSize: 14 }}>
            {data}
          </div>
        </div>
      </div>

      {/* Indicadores de slide */}
      {avisos.length > 1 && (
        <div className="absolute bottom-32 left-0 right-0 flex items-center justify-center gap-2 z-10">
          {avisos.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-500"
              style={{
                width: i === index ? 48 : 12,
                background: i === index ? "#fff" : "rgba(255,255,255,0.35)",
              }}
            />
          ))}
        </div>
      )}

      {/* Call-to-action — toque para começar */}
      <div className="absolute bottom-0 left-0 right-0 p-8 flex items-center justify-center z-10">
        <div
          className="flex items-center gap-4 px-10 py-5 rounded-full backdrop-blur-xl shadow-2xl animate-pulse"
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "1.5px solid rgba(255,255,255,0.4)",
            animationDuration: "2.5s",
          }}
        >
          <Hand className="text-white" style={{ width: 28, height: 28 }} strokeWidth={2} />
          <span
            className="text-white font-bold tracking-wide"
            style={{ fontSize: "clamp(18px, 1.6vw, 24px)" }}
          >
            Toque na tela para começar
          </span>
          <ChevronRight className="text-white" style={{ width: 24, height: 24 }} />
        </div>
      </div>

      {/* keyframes locais */}
      <style>{`
        @keyframes kenburns {
          0%   { transform: scale(1.05) translate(0, 0); }
          100% { transform: scale(1.18) translate(-2%, -1.5%); }
        }
      `}</style>
    </div>
  );
};

export default TotemScreensaver;
