import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface ParoquiaInfo {
  nome: string | null;
  cnpj: string | null;
}

const formatarCNPJ = (cnpj: string) => {
  const nums = cnpj.replace(/\D/g, "");
  if (nums.length !== 14) return cnpj;
  return nums.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

const AppFooter: React.FC = () => {
  const [info, setInfo] = useState<ParoquiaInfo>({ nome: null, cnpj: null });

  useEffect(() => {
    // get_tema_paroquia é SECURITY DEFINER — acessível sem autenticação
    supabase.rpc("get_tema_paroquia").then(({ data }) => {
      if (data) {
        setInfo({
          nome: (data as any).nome || null,
          cnpj: (data as any).cnpj || null,
        });
      }
    });
  }, []);

  return (
    <footer className="w-full border-t border-border bg-background/80 backdrop-blur-sm py-5 px-4">
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-2 text-center">
        {/* Nome e CNPJ */}
        {(info.nome || info.cnpj) && (
          <div className="text-sm text-foreground/70">
            {info.nome && (
              <span className="font-semibold text-foreground">{info.nome}</span>
            )}
            {info.nome && info.cnpj && (
              <span className="mx-2 opacity-40">·</span>
            )}
            {info.cnpj && (
              <span>
                CNPJ:{" "}
                <span className="font-mono">{formatarCNPJ(info.cnpj)}</span>
              </span>
            )}
          </div>
        )}

        {/* Links legais */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <Link
            to="/politica-de-privacidade"
            className="hover:text-primary underline-offset-4 hover:underline transition-colors"
          >
            Política de Privacidade
          </Link>
          <span className="opacity-30">·</span>
          <Link
            to="/termos-de-uso"
            className="hover:text-primary underline-offset-4 hover:underline transition-colors"
          >
            Termos de Uso
          </Link>
        </div>

        {/* Versão e créditos */}
        <p className="text-xs text-muted-foreground/60">
          v1.2.1 · Desenvolvido por:{" "}
          <span className="text-muted-foreground font-medium">Sem. Guthierres</span>
        </p>
      </div>
    </footer>
  );
};

export default AppFooter;
