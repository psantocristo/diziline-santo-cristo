import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import sicrediLogo from '@/assets/sicredi-logo.png';
import stoneLogo from '@/assets/stone-logo.png';
import redeLogo from '@/assets/rede-itau-logo.png';

type Provedor = 'rede' | 'sicredi' | 'pagarme';

const META: Record<Provedor, { nome: string; logo: string; alt: string }> = {
  rede:    { nome: 'Rede (Itaú)',     logo: redeLogo,    alt: 'Rede Itaú' },
  sicredi: { nome: 'Sicredi (Sipag)', logo: sicrediLogo, alt: 'Sicredi' },
  pagarme: { nome: 'Pagar.me (Stone)', logo: stoneLogo,  alt: 'Stone / Pagar.me' },
};

interface Props {
  variant?: 'compact' | 'full';
  className?: string;
}

/**
 * Selo de segurança que mostra o gateway de pagamento ativo.
 * Lê `provedor` em `configuracoes_gateway` e atualiza ao trocar de provedor.
 */
export const GatewaySecurityBadge = ({ variant = 'full', className = '' }: Props) => {
  const [provedor, setProvedor] = useState<Provedor | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('configuracoes_gateway')
        .select('provedor')
        .limit(1)
        .maybeSingle();
      if (!active) return;
      const p = ((data as any)?.provedor || 'rede') as Provedor;
      setProvedor(META[p] ? p : 'rede');
    })();
    return () => { active = false; };
  }, []);

  if (!provedor) return null;
  const info = META[provedor];

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground ${className}`}
      role="contentinfo"
      aria-label={`Pagamento processado por ${info.nome}`}
    >
      {variant === 'full' && <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />}
      <span className="whitespace-nowrap">Pagamento seguro processado por</span>
      <span
        className="inline-flex items-center rounded-lg bg-white px-3 py-1.5 shadow-sm ring-1 ring-black/5"
        style={{ minHeight: 36 }}
      >
        <img
          src={info.logo}
          alt={info.alt}
          className="h-6 sm:h-7 md:h-8 w-auto object-contain"
          loading="lazy"
        />
      </span>
    </div>
  );
};

export default GatewaySecurityBadge;
