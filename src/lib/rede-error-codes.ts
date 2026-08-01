/**
 * Mapeamento de returnCode da API e.Rede para mensagens amigáveis em português.
 * Fonte: Documentação oficial e.Rede + blog.vindi.com.br
 */

export interface RedeErrorInfo {
  codigo: string;
  mensagem: string;
  detalhe: string;
  acao: 'aprovado' | 'recusado' | 'erro_sistema' | 'refazer' | 'contato_banco' | 'contato_estabelecimento';
}

const REDE_RETURN_CODES: Record<string, RedeErrorInfo> = {
  '00': {
    codigo: '00',
    mensagem: 'Transação Aprovada',
    detalhe: 'A transação foi aprovada com sucesso.',
    acao: 'aprovado',
  },
  '000': {
    codigo: '000',
    mensagem: 'Transação Aprovada',
    detalhe: 'A transação foi aprovada com sucesso.',
    acao: 'aprovado',
  },
  // Transação não autorizada (bloco grande)
  ...Object.fromEntries(
    ['50', '52', '54', '55', '57', '59', '61', '62', '64',
     '66', '67', '68', '70', '71', '73', '75', '78', '79',
     '80', '82', '83', '84', '85', '87', '89', '90', '91',
     '93', '94', '95', '97', '99'].map(code => [code, {
      codigo: code,
      mensagem: 'Transação não autorizada',
      detalhe: 'O banco emissor do cartão não autorizou esta transação. Tente outro cartão ou entre em contato com o banco.',
      acao: 'recusado' as const,
    }])
  ),
  // Estabelecimento Inválido
  ...Object.fromEntries(
    ['51', '92', '98'].map(code => [code, {
      codigo: code,
      mensagem: 'Estabelecimento Inválido',
      detalhe: 'Problema com as credenciais do estabelecimento. Verifique as configurações do gateway.',
      acao: 'contato_estabelecimento' as const,
    }])
  ),
  '53': {
    codigo: '53',
    mensagem: 'Transação Inválida',
    detalhe: 'Dados da transação estão incorretos. Verifique os valores e tente novamente.',
    acao: 'contato_estabelecimento',
  },
  // Problemas com o cartão
  ...Object.fromEntries(
    ['58', '63', '65', '69', '72', '77', '96'].map(code => [code, {
      codigo: code,
      mensagem: 'Problemas com o cartão',
      detalhe: 'Verifique os dados do cartão (número, validade, CVV). Se o erro persistir, entre em contato com a central do cartão.',
      acao: 'contato_banco' as const,
    }])
  ),
  // Dado Inválido
  ...Object.fromEntries(
    ['56', '60'].map(code => [code, {
      codigo: code,
      mensagem: 'Dado Inválido',
      detalhe: 'Um ou mais dados enviados são inválidos. Verifique as informações e tente novamente.',
      acao: 'contato_estabelecimento' as const,
    }])
  ),
  // Refazer transação
  ...Object.fromEntries(
    ['76', '86'].map(code => [code, {
      codigo: code,
      mensagem: 'Refaça a transação',
      detalhe: 'A transação não pode ser concluída. Dados obrigatórios ausentes. Refaça a operação.',
      acao: 'refazer' as const,
    }])
  ),
  '74': {
    codigo: '74',
    mensagem: 'Instituição sem comunicação',
    detalhe: 'O banco emissor está temporariamente indisponível. Tente novamente em alguns minutos.',
    acao: 'erro_sistema',
  },
  '88': {
    codigo: '88',
    mensagem: 'Dados ausentes',
    detalhe: 'A transação não pode ser concluída porque dados obrigatórios não foram informados.',
    acao: 'refazer',
  },
  // Códigos de confirmação/estorno
  '1': {
    codigo: '1',
    mensagem: 'Já confirmada',
    detalhe: 'A transação já foi confirmada anteriormente.',
    acao: 'aprovado',
  },
  '2': {
    codigo: '2',
    mensagem: 'Transação negada',
    detalhe: 'A transação de confirmação foi negada pelo autorizador.',
    acao: 'recusado',
  },
  '3': {
    codigo: '3',
    mensagem: 'Transação desfeita',
    detalhe: 'O tempo de 2 minutos para confirmação foi ultrapassado.',
    acao: 'erro_sistema',
  },
  '4': {
    codigo: '4',
    mensagem: 'Transação estornada',
    detalhe: 'A transação foi estornada anteriormente.',
    acao: 'recusado',
  },
  '8': {
    codigo: '8',
    mensagem: 'Dados não coincidem',
    detalhe: 'Os dados de total, número de comprovante ou autorização não conferem.',
    acao: 'erro_sistema',
  },
  '9': {
    codigo: '9',
    mensagem: 'Transação não encontrada',
    detalhe: 'Não foi encontrada nenhuma transação para os dados informados.',
    acao: 'erro_sistema',
  },
};

/**
 * Retorna informações detalhadas sobre um returnCode da e.Rede.
 */
export function getRedeErrorInfo(returnCode: string | number | null | undefined): RedeErrorInfo {
  if (returnCode == null) {
    return {
      codigo: '?',
      mensagem: 'Código desconhecido',
      detalhe: 'Nenhum código de retorno foi informado pela API.',
      acao: 'erro_sistema',
    };
  }

  const code = String(returnCode).trim();
  return REDE_RETURN_CODES[code] || {
    codigo: code,
    mensagem: `Erro desconhecido (código ${code})`,
    detalhe: 'Código de retorno não mapeado. Consulte a documentação da e.Rede ou entre em contato com o suporte.',
    acao: 'erro_sistema',
  };
}

/**
 * Retorna uma mensagem amigável para exibir ao usuário baseada no returnCode.
 */
export function getRedeUserMessage(returnCode: string | number | null | undefined, returnMessage?: string): string {
  const info = getRedeErrorInfo(returnCode);
  if (info.acao === 'aprovado') return 'Pagamento aprovado com sucesso!';
  
  // Se há uma returnMessage da API, usar como complemento
  const apiMsg = returnMessage ? ` (${returnMessage})` : '';
  return `${info.mensagem}${apiMsg}. ${info.detalhe}`;
}
