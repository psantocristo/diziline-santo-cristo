import React from "react";

interface TotemProgressBarProps {
  current: number;
  total: number;
  label?: string;
}

const TotemProgressBar: React.FC<TotemProgressBarProps> = ({ current, total, label }) => {
  const pct = Math.round((current / total) * 100);

  return (
    <div className="w-full space-y-2 mb-8">
      {label && (
        <div className="flex justify-between items-center">
          <span
            className="font-semibold text-secondary-foreground/70"
            style={{ fontSize: 16 }}
          >
            {label}
          </span>
          <span className="text-primary font-bold" style={{ fontSize: 16 }}>
            Etapa {current} de {total}
          </span>
        </div>
      )}
      <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: "hsl(var(--primary))",
          }}
        />
      </div>
      {/* Marcadores de etapa */}
      <div className="flex justify-between mt-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-full border-2 transition-colors"
            style={{
              borderColor: i < current ? "hsl(var(--primary))" : "hsl(var(--secondary-foreground) / 0.3)",
              backgroundColor: i < current ? "hsl(var(--primary))" : "transparent",
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default TotemProgressBar;
