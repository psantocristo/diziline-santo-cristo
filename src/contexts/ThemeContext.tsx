import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TemaParoquia {
  nome: string | null;
  logoUrl: string | null;
  logoTermicoUrl: string | null;
  corPrimaria: string;
  corSecundaria: string;
  corAcento: string;
  corFonte: string;
  tamanhoFonte: string;
  slogan: string | null;
  cadastroAberto: boolean;
}

interface ThemeContextValue {
  tema: TemaParoquia;
  recarregarTema: () => Promise<void>;
}

const DEFAULT_TEMA: TemaParoquia = {
  nome: null,
  logoUrl: null,
  logoTermicoUrl: null,
  corPrimaria: '40 55% 54%',
  corSecundaria: '350 60% 28%',
  corAcento: '40 75% 50%',
  corFonte: '350 40% 12%',
  tamanhoFonte: 'medio',
  slogan: null,
  cadastroAberto: true,
};

const ThemeContext = createContext<ThemeContextValue>({
  tema: DEFAULT_TEMA,
  recarregarTema: async () => {},
});

export const useTheme = () => useContext(ThemeContext);

const FONT_SIZE_MAP: Record<string, string> = {
  pequeno: '14px',
  medio: '16px',
  grande: '18px',
};

function parseLightness(hsl: string): number {
  // expects "H S% L%" e.g. "350 60% 28%"
  const parts = hsl.trim().split(/\s+/);
  const l = parseFloat((parts[2] || '50').replace('%', ''));
  return isNaN(l) ? 50 : l;
}

export function aplicarCores(
  corPrimaria: string,
  corSecundaria: string,
  corAcento?: string,
  corFonte?: string,
  tamanhoFonte?: string
) {
  const root = document.documentElement;

  // Primary
  root.style.setProperty('--primary', corPrimaria);
  root.style.setProperty('--ring', corPrimaria);
  root.style.setProperty('--gold', corPrimaria);
  root.style.setProperty('--sidebar-primary', corPrimaria);
  root.style.setProperty('--sidebar-ring', corPrimaria);

  // Secondary
  root.style.setProperty('--secondary', corSecundaria);
  root.style.setProperty('--wine', corSecundaria);
  root.style.setProperty('--sidebar-background', corSecundaria);

  // Solid color for hero background
  root.style.setProperty('--gradient-hero', `hsl(${corSecundaria})`);

  // Auto-detect contrast for secondary-foreground (used by totem, sidebar, etc.)
  const secLightness = parseLightness(corSecundaria);
  const autoSecFg = secLightness < 45 ? '0 0% 95%' : '0 0% 10%';
  root.style.setProperty('--secondary-foreground', autoSecFg);
  root.style.setProperty('--sidebar-foreground', autoSecFg);
  root.style.setProperty('--sidebar-primary-foreground', autoSecFg);

  // Auto-detect contrast for primary-foreground
  const priLightness = parseLightness(corPrimaria);
  root.style.setProperty('--primary-foreground', priLightness < 45 ? '0 0% 95%' : '0 0% 10%');

  // Accent (3rd color)
  if (corAcento) {
    root.style.setProperty('--accent', corAcento);
    root.style.setProperty('--gold-light', corAcento);
  }

  // Font color — only apply to global foreground if it's dark enough for light backgrounds
  if (corFonte) {
    const fontLightness = parseLightness(corFonte);
    if (fontLightness < 50) {
      // Dark font color — safe for light backgrounds
      root.style.setProperty('--foreground', corFonte);
      root.style.setProperty('--card-foreground', corFonte);
      root.style.setProperty('--popover-foreground', corFonte);
    } else {
      // Light font color — reset to dark defaults for readability on light backgrounds
      root.style.setProperty('--foreground', '350 40% 12%');
      root.style.setProperty('--card-foreground', '350 40% 12%');
      root.style.setProperty('--popover-foreground', '350 40% 12%');
      // Also ensure muted-foreground stays readable
      root.style.setProperty('--muted-foreground', '350 20% 45%');
    }
  }

  // Font size
  if (tamanhoFonte) {
    const size = FONT_SIZE_MAP[tamanhoFonte] || '16px';
    root.style.setProperty('--base-font-size', size);
    root.style.fontSize = size;
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tema, setTema] = useState<TemaParoquia>(DEFAULT_TEMA);

  const recarregarTema = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_tema_paroquia' as any);
      if (error || !data) return;

      const t = data as any;
      const corPrimaria = t.cor_primaria || DEFAULT_TEMA.corPrimaria;
      const corSecundaria = t.cor_secundaria || DEFAULT_TEMA.corSecundaria;
      const corAcento = t.cor_acento || DEFAULT_TEMA.corAcento;
      const corFonte = t.cor_fonte || DEFAULT_TEMA.corFonte;
      const tamanhoFonte = t.tamanho_fonte || DEFAULT_TEMA.tamanhoFonte;

      setTema({
        nome: t.nome || null,
        logoUrl: t.logo_url || null,
        logoTermicoUrl: t.logo_termico_url || null,
        corPrimaria,
        corSecundaria,
        corAcento,
        corFonte,
        tamanhoFonte,
        slogan: t.slogan || null,
        cadastroAberto: t.cadastro_aberto !== false,
      });

      aplicarCores(corPrimaria, corSecundaria, corAcento, corFonte, tamanhoFonte);
    } catch {
      // Falha silenciosa — usa defaults
    }
  }, []);

  useEffect(() => {
    recarregarTema();
  }, [recarregarTema]);

  return (
    <ThemeContext.Provider value={{ tema, recarregarTema }}>
      {children}
    </ThemeContext.Provider>
  );
};
