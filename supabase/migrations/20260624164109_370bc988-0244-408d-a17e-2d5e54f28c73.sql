
ALTER TABLE public.configuracoes_paroquia
  ADD COLUMN IF NOT EXISTS impressora_preset TEXT DEFAULT 'epson_tm_t20',
  ADD COLUMN IF NOT EXISTS comprovante_config JSONB DEFAULT jsonb_build_object(
    'mostrarLogo', true,
    'mostrarCnpj', true,
    'mostrarSite', true,
    'mostrarTelefone', false,
    'mostrarId', true,
    'mostrarStatus', true,
    'mostrarMesReferencia', true,
    'mostrarContribuinte', true,
    'mostrarBencao', true,
    'mostrarCitacao', false,
    'mostrarRodapeGuarde', true,
    'textoBencao', 'Deus lhe pague!',
    'textoRodape', 'Guarde este comprovante.',
    'tituloDocumento', 'Comprovante de Contribuição',
    'corteTipo', 'partial',
    'linhasAvancoFinal', 3,
    'larguraPapelMm', 80,
    'codePage', 'CP860'
  );
