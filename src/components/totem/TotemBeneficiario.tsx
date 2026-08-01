import React, { useEffect, useState } from "react";
import { Building2, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ConfigParoquia {
  nome: string | null;
  cnpj: string | null;
}

const TotemBeneficiario: React.FC = () => {
  const [config, setConfig] = useState<ConfigParoquia | null>(null);

  useEffect(() => {
    supabase
      .rpc("get_tema_paroquia")
      .then(({ data }) => {
        if (data) setConfig(data as unknown as ConfigParoquia);
      });
  }, []);

  const nome = config?.nome || "Paróquia Senhor Santo Cristo dos Milagres";
  const cnpj = config?.cnpj || "—";

  return (
    <div
      className="rounded-2xl px-5 py-4 mt-4"
      style={{
        background: "hsl(var(--secondary-foreground) / 0.08)",
        border: "1px solid hsl(var(--secondary-foreground) / 0.15)",
      }}
    >
      <div className="flex items-start gap-3">
        <Building2
          size={22}
          style={{ color: "hsl(var(--primary))", marginTop: 2, flexShrink: 0 }}
        />
        <div className="space-y-1">
          <p className="font-semibold text-secondary-foreground" style={{ fontSize: 15 }}>
            {nome}
          </p>
          {cnpj !== "—" && (
            <p className="text-secondary-foreground/55" style={{ fontSize: 13 }}>
              CNPJ: {cnpj}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TotemBeneficiario;
