import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, ShieldX, Church, IdCard, Calendar } from 'lucide-react';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/carteirinha-verificar`;

interface VerifyResponse {
  valid: boolean;
  error?: string;
  emitido_em?: number;
  expira_em?: number;
  dizimista?: {
    id: string;
    nome_completo: string;
    matricula_paroquial: string | null;
    status: string;
    data_inicio_dizimista: string | null;
    foto_url: string | null;
    comunidade: string | null;
  };
  paroquia?: { nome?: string; logo_url?: string | null; site?: string | null } | null;
}

function formatBR(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatExp(unix?: number) {
  if (!unix) return '';
  return new Date(unix * 1000).toLocaleDateString('pt-BR');
}

export default function VerificarCarteirinha() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerifyResponse | null>(null);

  useEffect(() => {
    // bloqueio de indexação
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow, noarchive';
    document.head.appendChild(meta);
    document.title = 'Verificação de carteirinha';
    return () => { document.head.removeChild(meta); };
  }, []);

  useEffect(() => {
    let cancel = false;
    const verificar = async () => {
      setLoading(true);
      try {
        const resp = await fetch(`${FN_URL}?t=${encodeURIComponent(token || '')}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const j = (await resp.json()) as VerifyResponse;
        if (!cancel) setData(j);
      } catch {
        if (!cancel) setData({ valid: false, error: 'network' });
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    if (token) verificar();
    return () => { cancel = true; };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || !data.valid) {
    const motivo =
      data?.error === 'expired' ? 'Esta carteirinha expirou. Solicite uma nova emissão.'
      : data?.error === 'bad_signature' ? 'Assinatura inválida — carteirinha possivelmente falsificada.'
      : data?.error === 'revoked' ? 'Carteirinha revogada ou substituída por uma nova emissão.'
      : data?.error === 'not_found' ? 'Dizimista não encontrado.'
      : 'Não foi possível validar este QR Code.';
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full border-red-200">
          <CardContent className="pt-8 pb-6 text-center space-y-3">
            <div className="inline-flex h-14 w-14 rounded-full bg-red-100 items-center justify-center">
              <ShieldX className="h-7 w-7 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Carteirinha inválida</h1>
            <p className="text-sm text-muted-foreground">{motivo}</p>
            <Link to="/" className="inline-block text-sm text-primary underline">Voltar ao início</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const d = data.dizimista!;
  const isAtivo = d.status === 'ativo';
  const paroquiaNome = data.paroquia?.nome || 'Paróquia';

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-muted/30 py-8 px-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Topo: assinatura verificada */}
        <Card className="border-green-200 bg-green-50/60">
          <CardContent className="pt-5 pb-5 flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-green-600/10 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-green-700" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800">QR autenticado</p>
              <p className="text-xs text-green-700/80">
                Assinatura HMAC validada · válida até {formatExp(data.expira_em)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Cabeçalho da paróquia */}
        <Card>
          <CardContent className="pt-6 pb-6 text-center space-y-2">
            {data.paroquia?.logo_url ? (
              <img
                src={data.paroquia.logo_url}
                alt={paroquiaNome}
                className="h-16 mx-auto object-contain"
              />
            ) : (
              <Church className="h-12 w-12 mx-auto text-primary" />
            )}
            <h2 className="text-lg font-bold text-foreground">{paroquiaNome}</h2>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Ficha do Dizimista — Somente leitura
            </p>
          </CardContent>
        </Card>

        {/* Dados */}
        <Card>
          <CardContent className="pt-6 pb-6 space-y-5">
            <div className="flex items-center gap-4">
              {d.foto_url ? (
                <img
                  src={d.foto_url}
                  alt={d.nome_completo}
                  className="h-20 w-20 rounded-full object-cover border-2 border-primary/30"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
                  <IdCard className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Dizimista</p>
                <h1 className="text-lg font-bold text-foreground leading-tight">{d.nome_completo}</h1>
                <Badge
                  variant={isAtivo ? 'default' : 'secondary'}
                  className={isAtivo ? 'bg-green-600 hover:bg-green-600 mt-1' : 'mt-1'}
                >
                  {isAtivo ? 'Ativo' : (d.status?.[0].toUpperCase() + d.status?.slice(1))}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Matrícula</p>
                <p className="font-mono font-semibold text-foreground">
                  {d.matricula_paroquial || '—'}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Comunidade</p>
                <p className="font-semibold text-foreground truncate">{d.comunidade || '—'}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 col-span-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Dizimista desde
                </p>
                <p className="font-semibold text-foreground">
                  {formatBR(d.data_inicio_dizimista)}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground text-center pt-2 border-t">
              Esta página exibe apenas dados públicos da ficha pastoral.
              Nenhum dado financeiro ou pessoal sensível é divulgado.
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-[10px] text-muted-foreground">
          Emitido em {formatExp(data.emitido_em)} · {paroquiaNome}
        </p>
      </div>
    </div>
  );
}
