/**
 * Configuração do comprovante térmico — cache lazy do Supabase.
 * Tudo em um único lugar para HTML (browser) e ESC/POS (client-local).
 */
import { supabase } from '@/integrations/supabase/client';

export interface ComprovanteConfig {
  mostrarLogo: boolean;
  mostrarCnpj: boolean;
  mostrarSite: boolean;
  mostrarTelefone: boolean;
  mostrarId: boolean;
  mostrarStatus: boolean;
  mostrarMesReferencia: boolean;
  mostrarContribuinte: boolean;
  mostrarBencao: boolean;
  mostrarCitacao: boolean;
  mostrarRodapeGuarde: boolean;
  textoBencao: string;
  textoRodape: string;
  tituloDocumento: string;
  /** 'partial' = corte parcial (deixa fiapo), 'full' = corte total da guilhotina, 'none' = sem corte (manual). */
  corteTipo: 'partial' | 'full' | 'none';
  /** Linhas em branco antes do corte (avanço para limpar a guilhotina). */
  linhasAvancoFinal: number;
  larguraPapelMm: 58 | 80;
  codePage: string;
}

export const DEFAULT_COMPROVANTE_CONFIG: ComprovanteConfig = {
  mostrarLogo: true,
  mostrarCnpj: true,
  mostrarSite: true,
  mostrarTelefone: false,
  mostrarId: true,
  mostrarStatus: true,
  mostrarMesReferencia: true,
  mostrarContribuinte: true,
  mostrarBencao: true,
  mostrarCitacao: false,
  mostrarRodapeGuarde: true,
  textoBencao: 'Deus lhe pague!',
  textoRodape: 'Guarde este comprovante.',
  tituloDocumento: 'Comprovante de Contribuição',
  corteTipo: 'partial',
  linhasAvancoFinal: 3,
  larguraPapelMm: 80,
  codePage: 'CP860',
};

/** Presets de impressoras térmicas com configurações testadas. */
export const PRESETS_IMPRESSORA = {
  epson_tm_t20: {
    label: 'Epson TM-T20 / T20II / T20III',
    config: <Partial<ComprovanteConfig>>{
      corteTipo: 'partial',
      linhasAvancoFinal: 3,
      larguraPapelMm: 80,
      codePage: 'CP860',
    },
  },
  epson_tm_t88: {
    label: 'Epson TM-T88 (V/VI/VII)',
    config: <Partial<ComprovanteConfig>>{
      corteTipo: 'partial',
      linhasAvancoFinal: 4,
      larguraPapelMm: 80,
      codePage: 'CP860',
    },
  },
  bematech_mp4200: {
    label: 'Bematech MP-4200 TH',
    config: <Partial<ComprovanteConfig>>{
      corteTipo: 'full',
      linhasAvancoFinal: 4,
      larguraPapelMm: 80,
      codePage: 'CP850',
    },
  },
  elgin_i9: {
    label: 'Elgin i9 / i7',
    config: <Partial<ComprovanteConfig>>{
      corteTipo: 'partial',
      linhasAvancoFinal: 3,
      larguraPapelMm: 80,
      codePage: 'CP860',
    },
  },
  generico_80mm: {
    label: 'Genérica 80mm',
    config: <Partial<ComprovanteConfig>>{
      corteTipo: 'partial',
      linhasAvancoFinal: 3,
      larguraPapelMm: 80,
      codePage: 'CP850',
    },
  },
  generico_58mm: {
    label: 'Genérica 58mm',
    config: <Partial<ComprovanteConfig>>{
      corteTipo: 'none',
      linhasAvancoFinal: 5,
      larguraPapelMm: 58,
      codePage: 'CP850',
    },
  },
} as const;

export type PresetImpressora = keyof typeof PRESETS_IMPRESSORA;

let _cache: ComprovanteConfig | null = null;
let _inflight: Promise<ComprovanteConfig> | null = null;

/** Mescla configuração parcial vinda do banco com defaults — tolera campos faltantes. */
export function mergeConfig(partial: Partial<ComprovanteConfig> | null | undefined): ComprovanteConfig {
  return { ...DEFAULT_COMPROVANTE_CONFIG, ...(partial || {}) };
}

/** Busca a configuração (cache lazy). Retorna defaults em caso de erro. */
export async function getComprovanteConfig(): Promise<ComprovanteConfig> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;

  _inflight = (async () => {
    try {
      const { data } = await supabase
        .from('configuracoes_paroquia')
        .select('comprovante_config')
        .limit(1)
        .maybeSingle();
      const cfg = mergeConfig((data as any)?.comprovante_config);
      _cache = cfg;
      return cfg;
    } catch {
      _cache = DEFAULT_COMPROVANTE_CONFIG;
      return DEFAULT_COMPROVANTE_CONFIG;
    } finally {
      _inflight = null;
    }
  })();

  return _inflight;
}

/** Invalida o cache — chamar após salvar nova configuração. */
export function clearComprovanteConfigCache() {
  _cache = null;
}
