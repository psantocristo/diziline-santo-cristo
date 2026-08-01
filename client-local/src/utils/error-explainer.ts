/**
 * Traduz erros técnicos (errno, mensagens de libs nativas, status HTTP)
 * em diagnósticos acionáveis para o Setup Wizard.
 *
 * Retorna sempre { message, cause, fix } — o wizard renderiza os 3 campos.
 */

export interface ExplainedError {
  message: string;   // resumo curto, exibido em destaque
  cause?: string;    // o que provavelmente está acontecendo
  fix?: string;      // o que o usuário deve fazer agora
  raw?: string;      // mensagem original (debug)
}

type Ctx = 'printer-usb' | 'printer-serial' | 'printer-network' | 'pinpad' | 'cors' | 'token' | 'generic';

export function explainError(err: any, ctx: Ctx = 'generic'): ExplainedError {
  const raw = String(err?.message ?? err ?? 'Erro desconhecido');
  const code = String(err?.code ?? err?.errno ?? '').toUpperCase();
  const low = raw.toLowerCase();

  // ─── USB / libusb ─────────────────────────────────────────────
  if (ctx === 'printer-usb') {
    if (low.includes('libusb_error_access') || code === 'EACCES' || low.includes('access denied')) {
      return {
        message: 'Permissão negada para acessar a impressora USB',
        cause: 'Outro processo (ex.: driver Windows/Spooler, app da impressora ou outra instância do client-local) está com a USB aberta, ou o usuário atual não tem permissão de leitura/escrita no device.',
        fix: 'Windows: feche o "Gerenciador de Impressoras" e desinstale o driver Windows da térmica (Zadig → WinUSB) para que ela responda como ESC/POS bruta. Linux: adicione regra udev permitindo acesso ao VID/PID e reconecte o cabo.',
        raw,
      };
    }
    if (low.includes('libusb_error_not_found') || low.includes('device not found') || low.includes('no such device')) {
      return {
        message: 'Impressora USB não encontrada nesse VID/PID',
        cause: 'O Vendor ID / Product ID informado não corresponde a nenhum dispositivo conectado.',
        fix: 'Clique em "🔍 Detectar impressoras conectadas" e selecione o dispositivo correto na lista. Confira o cabo USB e se a impressora está ligada.',
        raw,
      };
    }
    if (low.includes('libusb_error_busy') || code === 'EBUSY') {
      return {
        message: 'Impressora USB está ocupada por outro processo',
        cause: 'O driver oficial da Epson/Bematech ou outra instância do client-local já reservou a USB.',
        fix: 'Encerre o serviço de impressão (Windows: pare o Print Spooler ou feche o app Epson APD) e tente novamente. Se for Linux, mate processos CUPS/escposd que estejam segurando o device.',
        raw,
      };
    }
    if (low.includes('cannot find module') || low.includes('was compiled against') || low.includes('napi')) {
      return {
        message: 'Módulo nativo USB ausente ou incompatível com o Node atual',
        cause: 'A lib "usb" ou "escpos-usb" não foi compilada para esta versão do Node/Electron.',
        fix: 'No diretório client-local, rode "npm rebuild" (ou "npm install --build-from-source"). Use Node LTS 20.x.',
        raw,
      };
    }
    if (low.includes('timeout')) {
      return {
        message: 'Tempo esgotado ao falar com a impressora',
        cause: 'A USB foi enumerada mas a impressora não devolveu ACK em 5s — pode estar sem papel, com tampa aberta ou em estado de erro.',
        fix: 'Verifique papel, tampa fechada, LED de erro apagado e reinicie a impressora.',
        raw,
      };
    }
  }

  // ─── Serial / COM ─────────────────────────────────────────────
  if (ctx === 'printer-serial') {
    if (code === 'EBUSY' || low.includes('access denied') || low.includes('resource busy') || low.includes('cannot lock port')) {
      return {
        message: 'Porta COM está ocupada por outro programa',
        cause: 'Outro app (PDV, Hyperterminal, driver virtual, outra instância do serviço) está com a porta aberta.',
        fix: 'Feche qualquer software que use a COM informada. No Windows: Gerenciador de Dispositivos → portas (COM e LPT) → confira o número correto. Reinicie o cabo USB-Serial se necessário.',
        raw,
      };
    }
    if (low.includes('file not found') || low.includes('no such file') || code === 'ENOENT') {
      return {
        message: 'Porta COM informada não existe',
        cause: 'O caminho da porta serial está incorreto ou o adaptador USB-Serial não foi reconhecido.',
        fix: 'Use "🔍 Detectar" para listar portas disponíveis. No Windows o nome é "COM3", "COM4"…; no Linux normalmente "/dev/ttyUSB0".',
        raw,
      };
    }
  }

  // ─── Rede / TCP ───────────────────────────────────────────────
  if (ctx === 'printer-network' || ctx === 'pinpad' || ctx === 'cors') {
    if (code === 'ECONNREFUSED' || low.includes('connection refused')) {
      return {
        message: 'Conexão recusada pelo destino',
        cause: 'O IP/porta está correto mas nada está escutando — o serviço do middleware/impressora não subiu ou está em outra porta.',
        fix: 'Confirme que o daemon do provedor está rodando (bridges/<provedor>-bridge) e que a porta confere com a configuração. Em impressoras de rede, padrão é 9100.',
        raw,
      };
    }
    if (code === 'ETIMEDOUT' || low.includes('etimedout') || low.includes('timeout')) {
      return {
        message: 'Tempo esgotado ao conectar',
        cause: 'Firewall do Windows, antivírus, ou rede sem rota até o host estão bloqueando.',
        fix: 'Libere a porta no firewall, confirme que cliente e impressora/middleware estão na mesma sub-rede e tente "ping <ip>".',
        raw,
      };
    }
    if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH') {
      return {
        message: 'Host inalcançável',
        cause: 'Roteamento de rede impede chegar até o destino.',
        fix: 'Verifique o IP da impressora/middleware e se está na mesma rede do PC.',
        raw,
      };
    }
    if (code === 'ENOTFOUND' || low.includes('getaddrinfo')) {
      return {
        message: 'DNS não resolveu o endereço',
        cause: 'O domínio informado não existe ou está sem internet.',
        fix: 'Confira a URL (sem espaços e com https://) e o acesso à internet.',
        raw,
      };
    }
    if (low.includes('certificate') || low.includes('ssl') || low.includes('self-signed')) {
      return {
        message: 'Erro de certificado SSL',
        cause: 'O servidor está usando um certificado inválido, expirado ou auto-assinado.',
        fix: 'Use HTTP em ambiente local de testes, ou instale a CA do certificado.',
        raw,
      };
    }
  }

  // ─── Token ────────────────────────────────────────────────────
  if (ctx === 'token') {
    return {
      message: raw,
      cause: 'O token deve ser copiado integralmente do painel admin (Diagnóstico → Tokens).',
      fix: 'Acesse /admin/diagnostico#tokens, gere um novo token e cole inteiro aqui. Formatos aceitos: UUID, hex (32+ chars) ou base64.',
      raw,
    };
  }

  // ─── Genérico ────────────────────────────────────────────────
  return {
    message: raw,
    cause: code ? `Código de erro: ${code}` : undefined,
    fix: 'Verifique os logs detalhados na aba "Logs" para mais contexto.',
    raw,
  };
}
