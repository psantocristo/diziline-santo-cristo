import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ParoquianoLayout from '@/components/layouts/ParoquianoLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { HandCoins, Heart, Star, Church, QrCode, CreditCard, Loader2, Copy, CheckCircle, CheckCircle2, Lock, CalendarDays, Clock, RefreshCw, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { registrarAuditoria } from '@/lib/audit';
import GatewaySecurityBadge from '@/components/GatewaySecurityBadge';

type TipoContribuicao = 'dizimo' | 'oferta' | 'campanha' | 'eventual';
type MetodoPagamento = 'pix' | 'credito' | 'debito';
type Step = 'tipo' | 'valor' | 'mes' | 'metodo' | 'pagamento' | 'confirmado';

interface Campanha { id: string; nome: string; meta_financeira: number | null; total_arrecadado: number; }

const TIPOS = [
  { id: 'dizimo' as TipoContribuicao, icon: HandCoins, label: 'Dízimo', desc: '10% da renda mensal para a paróquia', cor: 'text-primary' },
  { id: 'oferta' as TipoContribuicao, icon: Heart, label: 'Oferta', desc: 'Contribuição espontânea de qualquer valor', cor: 'text-red-500' },
  { id: 'campanha' as TipoContribuicao, icon: Star, label: 'Campanha', desc: 'Apoie um projeto específico', cor: 'text-yellow-500' },
  { id: 'eventual' as TipoContribuicao, icon: Church, label: 'Eventual', desc: 'Festas, eventos e obras', cor: 'text-purple-500' },
];

const VALORES_RAPIDOS = [20, 50, 100, 200, 500];
const POLLING_INTERVAL_MS = 5000;

function maskCard(v: string): string {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})/g, '$1 ').trim();
}
function maskExpiry(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
}

const Contribuir = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('tipo');
  const [tipo, setTipo] = useState<TipoContribuicao | null>(null);
  const [valor, setValor] = useState('');
  const [campanhaSelecionada, setCampanhaSelecionada] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<MetodoPagamento | null>(null);
  const [parcelas, setParcelas] = useState(1);
  const [mesReferencia, setMesReferencia] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [pagamentoId, setPagamentoId] = useState<string | null>(null);
  const [pixCode, setPixCode] = useState('');
  const [pixQrcode, setPixQrcode] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [mensagemPastoral, setMensagemPastoral] = useState('');
  const [pixSecondsLeft, setPixSecondsLeft] = useState(0);
  const [pixPollAtivo, setPixPollAtivo] = useState(false);
  const [processandoCartao, setProcessandoCartao] = useState(false);

  // Meses pagos para a grade de seleção
  const [mesesPagos, setMesesPagos] = useState<Record<string, string>>({});
  const [loadingMeses, setLoadingMeses] = useState(false);

  // Card data (nunca persistido, apenas em memória local)
  const [cardNumero, setCardNumero] = useState('');
  const [cardNome, setCardNome] = useState('');
  const [cardValidade, setCardValidade] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [mostrarCvv, setMostrarCvv] = useState(false);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Static data via useQuery (cached)
  const { data: campanhasData } = useQuery({
    queryKey: ['campanhas-ativas'],
    queryFn: async () => {
      const { data } = await supabase.from('campanhas').select('id, nome, meta_financeira, total_arrecadado').eq('ativo', true);
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: gatewayConfig } = useQuery({
    queryKey: ['gateway-parcelamento'],
    queryFn: async () => {
      const { data: gw } = await (supabase as any).from('configuracoes_gateway').select('parcelamento_max').eq('ativo', true).limit(1).single();
      return gw?.parcelamento_max || 12;
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: paroquianoData } = useQuery({
    queryKey: ['paroquiano-id', user?.id],
    queryFn: async () => {
      const { data: par } = await (supabase as any).from('paroquianos').select('id').eq('user_id', user!.id).maybeSingle();
      return par?.id || null;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  const campanhas = campanhasData || [];
  const parcelamentoMax = gatewayConfig || 12;
  const paroquianoId = paroquianoData || null;

  // Buscar meses já pagos (por paroquiano_id OU user_id) — captura pagamentos via totem também
  const fetchMesesPagos = async () => {
    if (!user) return;
    const anoAtual = new Date().getFullYear();
    setLoadingMeses(true);

    let query = (supabase as any)
      .from('pagamentos')
      .select('mes_referencia, status, paroquiano_id, user_id')
      .eq('tipo', 'dizimo')
      .gte('mes_referencia', `${anoAtual}-01-01`)
      .lte('mes_referencia', `${anoAtual}-12-31`);

    // Captura pagamentos do paroquiano (totem, admin) E do user (web)
    if (paroquianoId) {
      query = query.or(`paroquiano_id.eq.${paroquianoId},user_id.eq.${user.id}`);
    } else {
      query = query.eq('user_id', user.id);
    }

    const { data } = await query;
    const map: Record<string, string> = {};
    if (data) {
      (data as any[]).forEach((p: any) => {
        const key = p.mes_referencia?.substring(0, 7);
        if (!key) return;
        // 'pago' sempre vence; senão mantém o último visto
        if (p.status === 'pago' || !map[key]) {
          map[key] = p.status;
        }
      });
    }
    setMesesPagos(map);
    setLoadingMeses(false);
  };

  useEffect(() => {
    if (step !== 'mes') return;
    fetchMesesPagos();
  }, [step, user, paroquianoId]);

  // Realtime: revalida meses quando qualquer pagamento do paroquiano/user mudar
  useEffect(() => {
    if (!user) return;
    const channel = (supabase as any)
      .channel(`contribuir-pagamentos-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos' }, (payload: any) => {
        const row = payload.new || payload.old;
        if (!row) return;
        if (row.user_id === user.id || (paroquianoId && row.paroquiano_id === paroquianoId)) {
          fetchMesesPagos();
        }
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [user, paroquianoId]);


  // Limpar polling ao desmontar
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const valorNum = parseFloat(valor.replace(',', '.')) || 0;

  const handleTipoSelect = (t: TipoContribuicao) => {
    setTipo(t);
    setStep('valor');
  };

  const handleValorSubmit = () => {
    if (valorNum <= 0 || valorNum > 50000) {
      toast({ title: 'Valor inválido', description: 'Informe um valor entre R$ 1,00 e R$ 50.000,00.', variant: 'destructive' });
      return;
    }
    if (tipo === 'campanha' && !campanhaSelecionada) {
      toast({ title: 'Selecione uma campanha', variant: 'destructive' });
      return;
    }
    if (tipo === 'dizimo') {
      setStep('mes');
    } else {
      setStep('metodo');
    }
  };

  const handleMetodoSelect = (m: MetodoPagamento) => {
    setMetodo(m);
    setStep('pagamento');
  };

  // Iniciar polling de status do PIX (server-side via e.Rede)
  const iniciarPollingPix = (pid: string, expiracaoMs: number) => {
    setPixPollAtivo(true);

    // Countdown
    const expiraEm = Date.now() + expiracaoMs;
    const updateCountdown = () => {
      const left = Math.max(0, Math.floor((expiraEm - Date.now()) / 1000));
      setPixSecondsLeft(left);
      if (left <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
      }
    };
    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 1000);

    // Polling server-side
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('pagamentos')
          .select('status, pago_em')
          .eq('id', pid)
          .eq('user_id', user?.id)
          .single();

        if (data?.status === 'pago') {
          clearInterval(pollRef.current!);
          clearInterval(countdownRef.current!);
          setPixPollAtivo(false);

          // Enviar e-mail de agradecimento
          supabase.functions.invoke('enviar-email-agradecimento', {
            body: {
              pagamento_id: pid,
              paroquiano_id: paroquianoId || undefined,
              valor: valorNum,
              tipo: tipo!,
              metodo: 'pix',
              mes_referencia: tipo === 'dizimo' && mesReferencia ? `${mesReferencia.getFullYear()}-${String(mesReferencia.getMonth() + 1).padStart(2, '0')}-01` : undefined,
            },
          }).catch(() => {});

          const { data: msg } = await supabase.from('mensagens_personalizadas')
            .select('mensagem').eq('tipo', tipo!).eq('ativo', true).limit(1).single();
          setMensagemPastoral(msg?.mensagem || 'Deus lhe pague pela sua contribuição! 🙏');
          setStep('confirmado');
        }
      } catch {
        // Continuar tentando
      }
    }, POLLING_INTERVAL_MS);
  };

  const confirmarPagamento = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 🛡️ Pré-validação: impede pagar duas vezes o mesmo mês
      if (tipo === 'dizimo' && mesReferencia && paroquianoId) {
        const mesRef = `${mesReferencia.getFullYear()}-${String(mesReferencia.getMonth() + 1).padStart(2, '0')}-01`;
        const { data: jaPago } = await supabase
          .from('pagamentos').select('id')
          .eq('paroquiano_id', paroquianoId)
          .eq('tipo', 'dizimo')
          .eq('mes_referencia', mesRef)
          .eq('status', 'pago')
          .limit(1).maybeSingle();
        if (jaPago) {
          toast({ title: 'Mês já pago', description: 'Você já tem um dízimo confirmado para este mês.', variant: 'destructive' });
          setLoading(false);
          setStep('mes');
          return;
        }
      }

      const { data: cat } = await supabase.from('categorias_pagamento')
        .select('id').eq('tipo', tipo!).eq('ativo', true).limit(1).single();

      // Criar registro de pagamento no banco
      const pagamentoData: any = {
        user_id: user.id,
        paroquiano_id: paroquianoId || null,
        tipo: tipo!,
        valor: valorNum,
        metodo: metodo!,
        status: 'aguardando_pagamento',
        parcelas: metodo === 'credito' ? parcelas : 1,
        categoria_id: cat?.id || null,
        campanha_id: tipo === 'campanha' ? campanhaSelecionada : null,
        origem: 'web',
        mes_referencia: tipo === 'dizimo' && mesReferencia ? `${mesReferencia.getFullYear()}-${String(mesReferencia.getMonth() + 1).padStart(2, '0')}-01` : null,
      };

      const { data, error } = await supabase.from('pagamentos').insert(pagamentoData).select().single();
      if (error) throw error;


      const pid = data.id;
      await registrarAuditoria({ acao: 'criar_pagamento_web', entidade: 'pagamentos', entidade_id: pid, detalhes: { tipo: tipo!, valor: valorNum, metodo: metodo! } });

      if (metodo === 'pix') {
        setPagamentoId(pid);

        // Chamar edge function para gerar PIX real via e.Rede
        const { data: pixData, error: pixErr } = await supabase.functions.invoke('rede-gateway', {
          body: {
            action: 'create-pix',
            pagamento_id: pid,
            valor: valorNum,
            descricao: `Contribuição paroquial — ${TIPOS.find(t => t.id === tipo)?.label}`,
          },
        });

        if (pixErr || !pixData?.success) {
          await supabase.from('pagamentos').update({ status: 'cancelado', cancelado_em: new Date().toISOString() }).eq('id', pid);
          setPagamentoId(null);
          throw new Error(pixData?.message || pixErr?.message || 'Erro ao gerar PIX');
        }

        setPixCode(pixData.pix_copia_cola || '');
        setPixQrcode(pixData.pix_qrcode || '');

        await supabase.from('pagamentos').update({
          pix_copia_cola: pixData.pix_copia_cola,
          pix_qrcode: pixData.pix_qrcode,
          gateway_id: pixData.gateway_id,
          pix_expiracao: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        }).eq('id', pid).eq('user_id', user.id);

        iniciarPollingPix(pid, 30 * 60 * 1000);

      } else {
        // Cartão: mostrar tela de processamento ANTES de processar
        setProcessandoCartao(true);

        const { data: cardData, error: cardErr } = await supabase.functions.invoke('rede-gateway', {
          body: {
            action: 'create-card',
            pagamento_id: pid,
            valor: valorNum,
            tipo: metodo,
            card: {
              numero: cardNumero.replace(/\s/g, ''),
              nome: cardNome,
              validade: cardValidade,
              cvv: cardCvv,
            },
          },
        });

        setProcessandoCartao(false);

        if (cardErr || !cardData?.success) {
          await supabase.from('pagamentos').update({ status: 'cancelado', cancelado_em: new Date().toISOString() }).eq('id', pid);
          throw new Error(cardData?.message || cardErr?.message || 'Pagamento recusado. Verifique os dados do cartão.');
        }

        setPagamentoId(pid);

        // Enviar e-mail de agradecimento
        supabase.functions.invoke('enviar-email-agradecimento', {
          body: {
            pagamento_id: pid,
            paroquiano_id: paroquianoId || undefined,
            valor: valorNum,
            tipo: tipo!,
            metodo: metodo!,
            mes_referencia: tipo === 'dizimo' && mesReferencia ? `${mesReferencia.getFullYear()}-${String(mesReferencia.getMonth() + 1).padStart(2, '0')}-01` : undefined,
          },
        }).catch(() => {});

        const { data: msg } = await supabase.from('mensagens_personalizadas')
          .select('mensagem').eq('tipo', tipo!).eq('ativo', true).limit(1).single();
        setMensagemPastoral(msg?.mensagem || 'Deus lhe pague pela sua contribuição! 🙏');
        setStep('confirmado');
      }
    } catch (err: any) {
      toast({ title: 'Erro ao processar', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const copiarPix = () => {
    navigator.clipboard.writeText(pixCode);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
    toast({ title: 'Código copiado!', description: 'Cole no seu app de pagamento.' });
  };

  const minLeft = Math.floor(pixSecondsLeft / 60);
  const secLeft = pixSecondsLeft % 60;

  // Validações de cartão
  const [mesStr] = cardValidade.split('/');
  const mesNum = parseInt(mesStr, 10);
  const mesValida = cardValidade.length === 5 && !isNaN(mesNum) && mesNum >= 1 && mesNum <= 12;
  const cardValido = cardNumero.replace(/\s/g, '').length === 16 && cardNome.length > 2 && mesValida && cardCvv.length >= 3;

  return (
    <ParoquianoLayout>
      <div className="max-w-lg mx-auto">
        {/* Progress */}
        <div className="flex items-center gap-1 mb-6">
          {(tipo === 'dizimo' ? ['tipo','valor','mes','metodo','pagamento','confirmado'] as Step[] : ['tipo','valor','metodo','pagamento','confirmado'] as Step[]).map((s, i, arr) => (
            <div key={s} className={cn("h-2 flex-1 rounded-full transition-colors", arr.indexOf(step) >= i ? "bg-primary" : "bg-muted")} />
          ))}
        </div>

        {/* STEP: TIPO */}
        {step === 'tipo' && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-foreground">O que deseja contribuir?</h2>
              <p className="text-muted-foreground text-sm mt-1">Escolha o tipo de contribuição</p>
            </div>
            {TIPOS.map(({ id, icon: Icon, label, desc, cor }) => (
              <button
                key={id}
                onClick={() => handleTipoSelect(id)}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-border hover:border-primary hover:bg-accent/30 transition-all text-left group"
              >
                <div className="bg-muted rounded-xl p-3 group-hover:bg-primary/10">
                  <Icon className={cn("h-8 w-8", cor)} />
                </div>
                <div>
                  <p className="font-bold text-foreground text-lg">{label}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* STEP: VALOR */}
        {step === 'valor' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">Qual o valor?</h2>
              <p className="text-muted-foreground text-sm mt-1">
                {TIPOS.find(t => t.id === tipo)?.label}
              </p>
            </div>

            {tipo === 'campanha' && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Selecione a campanha</Label>
                <div className="space-y-2">
                  {campanhas.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setCampanhaSelecionada(c.id)}
                      className={cn("w-full p-3 rounded-xl border-2 text-left transition-colors", campanhaSelecionada === c.id ? "border-primary bg-accent/30" : "border-border hover:border-primary/50")}
                    >
                      <p className="font-semibold text-sm">{c.nome}</p>
                      {c.meta_financeira && (
                        <p className="text-xs text-muted-foreground">
                          R$ {c.total_arrecadado.toLocaleString('pt-BR')} / R$ {c.meta_financeira.toLocaleString('pt-BR')}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium mb-2 block">Valores sugeridos</Label>
              <div className="flex flex-wrap gap-2 mb-4">
                {VALORES_RAPIDOS.map(v => (
                  <button
                    key={v}
                    onClick={() => setValor(v.toString())}
                    className={cn("px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-colors", valor === v.toString() ? "border-primary bg-accent/30 text-primary" : "border-border hover:border-primary/50")}
                  >
                    R$ {v}
                  </button>
                ))}
              </div>
              <Label htmlFor="valor-input">Ou informe outro valor</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">R$</span>
                <Input
                  id="valor-input"
                  type="number"
                  min="1"
                  max="50000"
                  step="0.01"
                  placeholder="0,00"
                  value={valor}
                  onChange={e => setValor(e.target.value)}
                  className="pl-10 h-14 text-2xl font-bold"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('tipo')} className="flex-1 h-12">Voltar</Button>
              <Button onClick={handleValorSubmit} className="flex-1 h-12 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold">
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* STEP: MÊS DE REFERÊNCIA (apenas dízimo) — com status de meses pagos */}
        {step === 'mes' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">Mês de Referência</h2>
              <p className="text-muted-foreground text-sm mt-1">Selecione o mês do dízimo</p>
            </div>
            {loadingMeses ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Verificando pagamentos...</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 12 }, (_, i) => {
                  const anoAtual = new Date().getFullYear();
                  const d = new Date(anoAtual, i, 1);
                  const key = `${anoAtual}-${String(i + 1).padStart(2, '0')}`;
                  const label = format(d, 'MMM yyyy', { locale: ptBR });
                  const selectedKey = mesReferencia ? `${mesReferencia.getFullYear()}-${String(mesReferencia.getMonth() + 1).padStart(2, '0')}` : '';
                  const selected = selectedKey === key;
                  const statusMes = mesesPagos[key];
                  const isPago = statusMes === 'pago';
                  const isAguardando = statusMes === 'aguardando_pagamento';

                  return (
                    <button
                      key={key}
                      onClick={() => !isPago && setMesReferencia(d)}
                      disabled={isPago}
                      className={cn(
                        "p-4 rounded-xl border-2 text-sm font-semibold transition-all capitalize relative",
                        isPago
                          ? "border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800 text-green-700 dark:text-green-400 cursor-default opacity-80"
                          : isAguardando
                            ? "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400"
                            : selected
                              ? "border-primary bg-accent/30 text-primary"
                              : "border-border hover:border-primary/50 text-foreground"
                      )}
                    >
                      {isPago ? (
                        <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-green-500" />
                      ) : isAguardando ? (
                        <Clock className="h-4 w-4 mx-auto mb-1 text-yellow-500" />
                      ) : (
                        <CalendarDays className="h-4 w-4 mx-auto mb-1 opacity-50" />
                      )}
                      {label}
                      {isPago && <span className="block text-xs mt-0.5 font-normal">Pago ✓</span>}
                      {isAguardando && <span className="block text-xs mt-0.5 font-normal">Aguard.</span>}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('valor')} className="flex-1 h-12">Voltar</Button>
              <Button
                onClick={() => {
                  if (!mesReferencia) {
                    toast({ title: 'Selecione um mês', variant: 'destructive' });
                    return;
                  }
                  const mesKey = `${mesReferencia.getFullYear()}-${String(mesReferencia.getMonth() + 1).padStart(2, '0')}`;
                  if (mesesPagos[mesKey] === 'pago') {
                    toast({ title: 'Mês já pago', description: 'Selecione outro mês.', variant: 'destructive' });
                    return;
                  }
                  setStep('metodo');
                }}
                className="flex-1 h-12 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold"
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* STEP: MÉTODO */}
        {step === 'metodo' && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">Como vai pagar?</h2>
              <p className="text-muted-foreground text-sm">
                Valor: <strong className="text-primary">R$ {parseFloat(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
              </p>
            </div>

            {[
              { id: 'pix' as MetodoPagamento, icon: QrCode, label: 'PIX', desc: 'QR Code dinâmico — pagamento imediato', badge: 'Recomendado' },
              { id: 'credito' as MetodoPagamento, icon: CreditCard, label: 'Cartão de Crédito', desc: 'Parcelamento em até 12x', badge: null },
              { id: 'debito' as MetodoPagamento, icon: CreditCard, label: 'Cartão de Débito', desc: 'Débito à vista na conta', badge: null },
            ].map(({ id, icon: Icon, label, desc, badge }) => (
              <button
                key={id}
                onClick={() => handleMetodoSelect(id)}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-border hover:border-primary hover:bg-accent/30 transition-all text-left group"
              >
                <div className="bg-muted rounded-xl p-3 group-hover:bg-primary/10">
                  <Icon className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-foreground">{label}</p>
                    {badge && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{badge}</span>}
                  </div>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </button>
            ))}

            <Button variant="outline" onClick={() => setStep(tipo === 'dizimo' ? 'mes' : 'valor')} className="w-full h-12">Voltar</Button>
          </div>
        )}

        {/* STEP: PIX — pré-confirmação */}
        {step === 'pagamento' && metodo === 'pix' && !pagamentoId && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">Confirmar e Gerar PIX</h2>
            </div>
            <Card className="border-primary/20">
              <CardContent className="pt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span className="font-semibold">{TIPOS.find(t=>t.id===tipo)?.label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-bold text-primary text-lg">R$ {parseFloat(valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Método</span><span>PIX</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Válido por</span><span>30 minutos</span></div>
              </CardContent>
            </Card>
            <Button onClick={confirmarPagamento} className="w-full h-14 text-lg bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <QrCode className="h-5 w-5 mr-2" />}
              {loading ? 'Gerando PIX...' : 'Gerar QR Code PIX'}
            </Button>
            <Button variant="outline" onClick={() => setStep('metodo')} className="w-full" disabled={loading}>Voltar</Button>
          </div>
        )}

        {/* PIX QR Code gerado — tela elegante de aguardar pagamento */}
        {step === 'pagamento' && metodo === 'pix' && pagamentoId && (
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="relative mx-auto w-16 h-16 mb-2">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                <div className="relative w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <QrCode className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-foreground">Pague com PIX</h2>
              <p className="text-sm text-muted-foreground">Escaneie o QR Code ou copie o código abaixo</p>
            </div>

            {/* QR Code */}
            <div className="bg-white border-2 border-border rounded-2xl p-6 inline-block mx-auto w-full flex justify-center">
              {pixQrcode ? (
                <img
                  src={pixQrcode.startsWith('data:') || pixQrcode.startsWith('http') ? pixQrcode : `data:image/png;base64,${pixQrcode}`}
                  alt="QR Code PIX"
                  className="w-48 h-48 object-contain"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p className="text-sm">Gerando QR Code...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Valor destaque */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Valor</p>
              <p className="text-3xl font-bold text-primary">
                R$ {parseFloat(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            {/* Copia e Cola */}
            {pixCode && (
              <Button onClick={copiarPix} variant="outline" className="w-full h-12 border-primary/30">
                {copiado ? <CheckCircle className="h-5 w-5 mr-2 text-primary" /> : <Copy className="h-5 w-5 mr-2" />}
                {copiado ? 'Copiado!' : 'Copiar código Copia e Cola'}
              </Button>
            )}

            {pixCode && (
              <div className="bg-muted rounded-xl p-3">
                <p className="text-xs text-muted-foreground font-mono break-all">{pixCode.substring(0, 60)}...</p>
              </div>
            )}

            {/* Countdown */}
            {pixSecondsLeft > 0 && (
              <div className={cn(
                "flex items-center justify-center gap-3 rounded-xl px-4 py-3 border",
                pixSecondsLeft < 60
                  ? "bg-destructive/10 border-destructive/30 text-destructive"
                  : "bg-muted border-border text-muted-foreground"
              )}>
                <Clock className="h-5 w-5" />
                <span className="font-mono font-bold text-lg">{minLeft}:{String(secLeft).padStart(2, '0')}</span>
                <span className="text-sm">restantes</span>
              </div>
            )}

            {/* Aguardando confirmação com animação */}
            {pixPollAtivo && (
              <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-shimmer" 
                  style={{ animation: 'shimmer 2s infinite', backgroundSize: '200% 100%' }} />
                <div className="relative flex items-center gap-4">
                  <div className="relative">
                    <RefreshCw className="h-6 w-6 text-primary animate-spin" style={{ animationDuration: '3s' }} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">Aguardando confirmação...</p>
                    <p className="text-xs text-muted-foreground">O pagamento será confirmado automaticamente</p>
                  </div>
                </div>
              </div>
            )}

            <Button variant="outline" onClick={() => setStep('metodo')} className="w-full">
              Trocar forma de pagamento
            </Button>
          </div>
        )}

        {/* STEP: CARTÃO — processando */}
        {step === 'pagamento' && (metodo === 'credito' || metodo === 'debito') && (loading || processandoCartao) && (
          <div className="space-y-8 py-8">
            <div className="text-center space-y-4">
              <div className="relative mx-auto w-20 h-20">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '1.5s' }} />
                <div className="relative w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <CreditCard className="h-10 w-10 text-primary" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-foreground">Processando pagamento...</h2>
              <p className="text-sm text-muted-foreground">Aguarde enquanto validamos seu cartão</p>
            </div>

            {/* Barra de progresso animada */}
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{
                  animation: 'progressIndeterminate 1.5s ease-in-out infinite',
                  width: '40%',
                }}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <span className="text-muted-foreground">Conexão segura com o gateway</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Lock className="h-5 w-5 text-primary" />
                <span className="text-muted-foreground">Dados criptografados de ponta a ponta</span>
              </div>
            </div>

            <Card className="border-border/60">
              <CardContent className="pt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-bold text-primary">R$ {parseFloat(valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Método</span><span>{metodo === 'credito' ? 'Crédito' : 'Débito'}</span></div>
                {metodo === 'credito' && parcelas > 1 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Parcelas</span><span>{parcelas}x</span></div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* STEP: CARTÃO — formulário */}
        {step === 'pagamento' && (metodo === 'credito' || metodo === 'debito') && !loading && !processandoCartao && !pagamentoId && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground">Dados do Cartão</h2>
              <p className="text-sm text-primary font-semibold">
                R$ {parseFloat(valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <Label>Número do cartão</Label>
                <Input
                  placeholder="0000 0000 0000 0000"
                  value={cardNumero}
                  onChange={e => setCardNumero(maskCard(e.target.value))}
                  className="h-12 mt-1 font-mono"
                  inputMode="numeric"
                  autoComplete="off"
                />
              </div>
              <div>
                <Label>Nome no cartão</Label>
                <Input
                  placeholder="NOME COMO NO CARTÃO"
                  value={cardNome}
                  onChange={e => setCardNome(e.target.value.toUpperCase().slice(0, 26))}
                  className="h-12 mt-1 uppercase"
                  autoComplete="off"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Validade</Label>
                  <Input
                    placeholder="MM/AA (ex: 01/35)"
                    value={cardValidade}
                    onChange={e => setCardValidade(maskExpiry(e.target.value))}
                    className="h-12 mt-1 font-mono"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                  {cardValidade.length === 5 && !mesValida && (
                    <p className="text-xs text-destructive mt-1">Mês inválido. Use 01 a 12</p>
                  )}
                </div>
                <div>
                  <Label>CVV</Label>
                  <div className="relative">
                    <Input
                      type={mostrarCvv ? 'text' : 'password'}
                      placeholder="•••"
                      value={cardCvv}
                      onChange={e => setCardCvv(e.target.value.replace(/\D/g,'').slice(0,4))}
                      className="h-12 mt-1 font-mono"
                      inputMode="numeric"
                      autoComplete="off"
                    />
                  </div>
                </div>
              </div>
              {metodo === 'credito' && (
                <div>
                  <Label>Parcelamento</Label>
                  <select
                    className="w-full h-12 mt-1 border border-input rounded-md px-3 bg-background text-foreground"
                    value={parcelas}
                    onChange={e => setParcelas(Number(e.target.value))}
                  >
                    {Array.from({ length: parcelamentoMax }, (_, i) => i + 1).map(n => {
                      const valorParcela = (parseFloat(valor) / n);
                      return (
                        <option key={n} value={n}>
                          {n}x de R$ {valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {n === 1 ? ' sem juros' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            <Button
              onClick={confirmarPagamento}
              className="w-full h-14 text-lg bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold"
              disabled={loading || !cardValido}
            >
              <Lock className="h-5 w-5 mr-2" /> Pagar R$ {parseFloat(valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}
            </Button>
            <p className="text-center text-muted-foreground text-xs flex items-center justify-center gap-1">
              <Lock className="h-3 w-3" /> Dados processados com segurança pelo gateway de pagamento
            </p>
            <Button variant="outline" onClick={() => setStep('metodo')} className="w-full" disabled={loading}>Voltar</Button>
          </div>
        )}

        {/* STEP: CONFIRMADO */}
        {step === 'confirmado' && (
          <div className="text-center space-y-6">
            <div className="bg-accent rounded-full p-6 w-24 h-24 mx-auto flex items-center justify-center">
              <CheckCircle className="h-14 w-14 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Pagamento Confirmado!</h2>
              <div className="bg-accent/40 border border-primary/20 rounded-2xl p-5 text-left">
                <p className="text-foreground/80 text-sm italic leading-relaxed">{mensagemPastoral}</p>
              </div>
            </div>
            <Card className="border-border/60">
              <CardContent className="pt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span className="font-semibold">{TIPOS.find(t=>t.id===tipo)?.label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-bold text-primary">R$ {parseFloat(valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="text-primary font-semibold">✓ Pago</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">ID</span><span className="text-xs font-mono text-muted-foreground">{pagamentoId?.substring(0,8)}...</span></div>
              </CardContent>
            </Card>
            <div className="flex gap-3">
              <Button asChild variant="outline" className="flex-1">
                <a href="/paroquiano/comprovantes">Ver Comprovante</a>
              </Button>
              <Button
                onClick={() => {
                  setStep('tipo'); setTipo(null); setValor(''); setMetodo(null);
                  setPagamentoId(null); setPixCode(''); setPixQrcode('');
                  setCardNumero(''); setCardNome(''); setCardValidade(''); setCardCvv('');
                  setMesReferencia(null); setProcessandoCartao(false);
                }}
                className="flex-1 bg-secondary hover:bg-secondary/90 text-secondary-foreground"
              >
                Nova Contribuição
              </Button>
            </div>
          </div>
        )}

        <GatewaySecurityBadge className="mt-8 pt-4 border-t border-border/40" />
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes progressIndeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </ParoquianoLayout>
  );
};

export default Contribuir;
