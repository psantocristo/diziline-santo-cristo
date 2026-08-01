import React, { useEffect, useState } from "react";
import { Megaphone, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCached, setCache } from "@/lib/cache";

interface Aviso {
  id: string;
  titulo: string;
  mensagem: string;
  cor: string | null;
  imagem_url: string | null;
  link_url: string | null;
}

interface TotemAvisosProps {
  onVerAvisos?: (avisos: Aviso[]) => void;
}

const CACHE_KEY = "totem_avisos";

const TotemAvisos: React.FC<TotemAvisosProps> = ({ onVerAvisos }) => {
  const [avisos, setAvisos] = useState<Aviso[]>(() => getCached<Aviso[]>(CACHE_KEY) || []);

  useEffect(() => {
    // Skip fetch if cache is still valid
    const cached = getCached<Aviso[]>(CACHE_KEY);
    if (cached) { setAvisos(cached); return; }

    const fetchAvisos = async () => {
      const { data } = await (supabase as any)
        .from("avisos_totem")
        .select("id, titulo, mensagem, cor, imagem_url, link_url")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      const result = data || [];
      setAvisos(result);
      setCache(CACHE_KEY, result);
    };
    fetchAvisos();
  }, []);

  if (avisos.length === 0) return null;

  const duration = Math.max(avisos.length * 6, 12);

  return (
    <div className="space-y-4">
      {/* Marquee */}
      <div
        className="w-full overflow-hidden rounded-3xl border-2"
        style={{
          borderColor: "hsl(var(--primary) / 0.25)",
          background: "hsl(var(--primary) / 0.07)",
        }}
      >
        <div
          className="flex animate-marquee whitespace-nowrap"
          style={{ animationDuration: `${duration}s` }}
        >
          {[...avisos, ...avisos].map((aviso, i) => (
            <div
              key={`${aviso.id}-${i}`}
              className="inline-flex items-center gap-5 px-10 py-6 shrink-0"
            >
              {aviso.imagem_url ? (
                <img
                  src={aviso.imagem_url}
                  alt=""
                  className="shrink-0 rounded-2xl object-cover"
                  style={{ width: 56, height: 56 }}
                />
              ) : (
                <div
                  className="shrink-0 rounded-2xl flex items-center justify-center"
                  style={{
                    width: 56,
                    height: 56,
                    background: (aviso.cor || "hsl(var(--primary))") + "22",
                  }}
                >
                  <Megaphone
                    style={{
                      width: 32,
                      height: 32,
                      color: aviso.cor || "hsl(var(--primary))",
                    }}
                    strokeWidth={2}
                  />
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                <span
                  className="font-extrabold tracking-tight"
                  style={{
                    fontSize: 26,
                    color: aviso.cor || "hsl(var(--primary))",
                  }}
                >
                  {aviso.titulo}
                </span>
                <span
                  className="text-secondary-foreground/70 font-medium"
                  style={{ fontSize: 22 }}
                >
                  {aviso.mensagem}
                </span>
              </div>
              <span
                className="mx-8"
                style={{
                  fontSize: 36,
                  color: "hsl(var(--primary) / 0.2)",
                }}
              >
                ✦
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Botão Ver Avisos */}
      {onVerAvisos && (
        <button
          onClick={() => onVerAvisos(avisos)}
          className="w-full flex items-center justify-center gap-3 rounded-2xl py-4 transition-transform active:scale-95"
          style={{
            background: "hsl(var(--primary) / 0.08)",
            border: "1.5px solid hsl(var(--primary) / 0.2)",
          }}
        >
          <Megaphone style={{ width: 22, height: 22, color: "hsl(var(--primary))" }} />
          <span className="font-semibold" style={{ fontSize: 20, color: "hsl(var(--primary))" }}>
            Ver Avisos Paroquiais
          </span>
          <ChevronRight style={{ width: 20, height: 20, color: "hsl(var(--primary))" }} />
        </button>
      )}
    </div>
  );
};

export default TotemAvisos;
