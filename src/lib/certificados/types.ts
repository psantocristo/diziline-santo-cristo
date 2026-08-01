export type TipoCertificado = 
  | 'batismo' 
  | 'primeira_eucaristia' 
  | 'crisma' 
  | 'casamento' 
  | 'curso_batismo' 
  | 'curso_noivos';

export type TamanhoCertificado = 'A4' | 'A5';

export interface DadosCertificado {
  tipo: TipoCertificado;
  tamanho: TamanhoCertificado;
  nomeParoquia: string;
  logoUrl?: string;
  // Campos comuns
  nomeCompleto: string;
  dataCerimonia: string;
  localCerimonia?: string;
  celebrante?: string;
  parocoNome?: string;
  // Batismo
  nomePai?: string;
  nomeMae?: string;
  padrinhoNome?: string;
  madrinhaNome?: string;
  dataNascimento?: string;
  // Casamento
  nomeConjuge?: string;
  testemunha1?: string;
  testemunha2?: string;
  // Crisma
  nomeSanto?: string;
  // Curso
  cargaHoraria?: string;
  dataInicio?: string;
  dataFim?: string;
  observacoes?: string;
  textoPersonalizado?: string;
}

export const TIPOS_CERTIFICADO: Record<TipoCertificado, { label: string; icon: string }> = {
  batismo: { label: 'Batismo', icon: '💧' },
  primeira_eucaristia: { label: 'Primeira Eucaristia', icon: '🍞' },
  crisma: { label: 'Crisma', icon: '🕊️' },
  casamento: { label: 'Casamento', icon: '💍' },
  curso_batismo: { label: 'Curso de Batismo', icon: '📖' },
  curso_noivos: { label: 'Curso de Noivos', icon: '❤️' },
};
