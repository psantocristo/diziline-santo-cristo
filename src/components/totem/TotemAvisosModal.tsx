import React from "react";
import { X, Megaphone, ExternalLink } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface Aviso {
  id: string;
  titulo: string;
  mensagem: string;
  cor: string | null;
  imagem_url: string | null;
  link_url: string | null;
}

interface TotemAvisosModalProps {
  avisos: Aviso[];
  onClose: () => void;
}

const TotemAvisosModal: React.FC<TotemAvisosModalProps> = ({ avisos, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "hsl(var(--background))" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-8 py-6 shrink-0"
        style={{ borderBottom: "2px solid hsl(var(--border))" }}
      >
        <div className="flex items-center gap-4">
          <Megaphone style={{ width: 36, height: 36, color: "hsl(var(--primary))" }} />
          <h1 className="font-bold text-foreground" style={{ fontSize: 32 }}>
            Avisos Paroquiais
          </h1>
        </div>
        <button
          onClick={onClose}
          className="rounded-2xl flex items-center justify-center transition-colors"
          style={{
            width: 64,
            height: 64,
            background: "hsl(var(--muted))",
          }}
        >
          <X style={{ width: 32, height: 32, color: "hsl(var(--muted-foreground))" }} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {avisos.map((aviso) => (
          <div
            key={aviso.id}
            className="rounded-3xl overflow-hidden"
            style={{
              border: `2px solid ${aviso.cor || "hsl(var(--primary))"  }33`,
              background: `${aviso.cor || "hsl(var(--primary))"}08`,
            }}
          >
            {aviso.imagem_url && (
              <img
                src={aviso.imagem_url}
                alt={aviso.titulo}
                className="w-full object-cover"
                style={{ maxHeight: 360 }}
              />
            )}
            <div className="p-8 space-y-4">
              <div className="flex items-start gap-4">
                <div
                  className="shrink-0 rounded-2xl flex items-center justify-center mt-1"
                  style={{
                    width: 56,
                    height: 56,
                    background: (aviso.cor || "hsl(var(--primary))") + "22",
                  }}
                >
                  <Megaphone
                    style={{ width: 28, height: 28, color: aviso.cor || "hsl(var(--primary))" }}
                    strokeWidth={2}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h2
                    className="font-extrabold tracking-tight"
                    style={{ fontSize: 28, color: aviso.cor || "hsl(var(--primary))" }}
                  >
                    {aviso.titulo}
                  </h2>
                  <p
                    className="text-foreground/75 mt-2 leading-relaxed"
                    style={{ fontSize: 22 }}
                  >
                    {aviso.mensagem}
                  </p>
                </div>
              </div>

              {aviso.link_url && (
                <div
                  className="flex items-center gap-6 rounded-2xl p-6 mt-4"
                  style={{
                    background: "hsl(var(--muted) / 0.5)",
                    border: "1px solid hsl(var(--border))",
                  }}
                >
                  <div className="bg-white rounded-xl p-3">
                    <QRCodeSVG value={aviso.link_url} size={140} level="M" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground flex items-center gap-2" style={{ fontSize: 20 }}>
                      <ExternalLink style={{ width: 20, height: 20 }} />
                      Escaneie o QR Code
                    </p>
                    <p className="text-foreground/60 mt-1" style={{ fontSize: 16 }}>
                      Aponte a câmera do seu celular para acessar o link de inscrição ou mais informações.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer with back button */}
      <div className="shrink-0 p-6 flex justify-center" style={{ borderTop: "2px solid hsl(var(--border))" }}>
        <button
          onClick={onClose}
          className="rounded-2xl px-16 py-5 font-bold transition-transform active:scale-95"
          style={{
            fontSize: 24,
            background: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
          }}
        >
          Voltar
        </button>
      </div>
    </div>
  );
};

export default TotemAvisosModal;
