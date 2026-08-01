import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getLocalHealth, type LocalHealthResponse } from '@/lib/local-client';
import {
  Wand2, Printer, CreditCard, CheckCircle2, AlertTriangle,
  XCircle, RefreshCw, Save, Info,
} from 'lucide-react';

/**
 * Painel de auto-detecção de impressora e validação de Terminal ID.
 * Lê o /api/health do client local e compara com configuracoes_tef.
 */

const TERM_ID_REGEX = /^[A-Z0-9-]{4,16}$/i;

type MatchKind = 'match' | 'mismatch' | 'missing' | 'unknown';

interface TefRow {
  id: string;
  terminal_id: string | null;
  provedor_tef: string | null;
}

const AutoDetectPanel: React.FC = () => {
  const { toast } = useToast();
  const [health, setHealth] = useState<LocalHealthResponse | null>(null);
  const [tef, setTef] = useState<TefRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<null | 'printer' | 'pinpad'>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [h, { data }] = await Promise.all([
      getLocalHealth(),
      (supabase as any)
        .from('configuracoes_tef')
        .select('id, terminal_id, provedor_tef')
        .limit(1)
        .maybeSingle(),
    ]);
    setHealth(h);
    setTef(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Terminal ID ──
  const detectedTerminal =
    health?.devices.pinpad.serial?.trim() ||
    // alguns SDKs colocam o ID dentro do model: "Ingenico iPP320 #DIZSC001"
    health?.devices.pinpad.model?.match(/#?([A-Z0-9-]{4,16})\s*$/i)?.[1] ||
    '';

  const configuredTerminal = tef?.terminal_id?.trim() || '';

  const terminalMatch: MatchKind = !detectedTerminal
    ? 'unknown'
    : !configuredTerminal
      ? 'missing'
      : detectedTerminal.toUpperCase() === configuredTerminal.toUpperCase()
        ? 'match'
        : 'mismatch';

  const terminalValidFormat = detectedTerminal ? TERM_ID_REGEX.test(detectedTerminal) : false;

  const applyTerminal = async () => {
    if (!tef?.id || !detectedTerminal) return;
    setApplying('pinpad');
    const { error } = await (supabase as any)
      .from('configuracoes_tef')
      .update({ terminal_id: detectedTerminal.toUpperCase() })
      .eq('id', tef.id);
    setApplying(null);
    if (error) {
      toast({ title: 'Erro ao salvar Terminal ID', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Terminal ID aplicado', description: `Salvo como ${detectedTerminal.toUpperCase()}` });
      load();
    }
  };

  // ── Impressora ──
  const detectedPrinter = health?.devices.printer.model?.trim() || '';
  const printerFirmware = (health?.devices.printer as any)?.firmware as string | undefined;
  const printerKnown = !!detectedPrinter && detectedPrinter.toLowerCase() !== 'desconhecido';

  // Heurística simples de família ESC/POS conhecida
  const printerFamily = (() => {
    const m = detectedPrinter.toLowerCase();
    if (!m) return null;
    if (m.includes('epson') || m.includes('tm-')) return 'Epson ESC/POS';
    if (m.includes('bematech') || m.includes('mp-')) return 'Bematech ESC/Bema';
    if (m.includes('elgin') || m.includes('i9')) return 'Elgin ESC/POS';
    if (m.includes('daruma') || m.includes('dr800')) return 'Daruma ESC/POS';
    if (m.includes('control id')) return 'Control iD';
    return 'ESC/POS genérica';
  })();

  // ── UI helpers ──
  const StatusPill: React.FC<{ kind: MatchKind }> = ({ kind }) => {
    if (kind === 'match')
      return <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 gap-1"><CheckCircle2 className="h-3 w-3" /> Coincide</Badge>;
    if (kind === 'mismatch')
      return <Badge className="bg-rose-500/20 text-rose-600 border-rose-500/30 gap-1"><AlertTriangle className="h-3 w-3" /> Divergente</Badge>;
    if (kind === 'missing')
      return <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30 gap-1"><Info className="h-3 w-3" /> Não configurado</Badge>;
    return <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> Sem leitura</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Auto-detecção & Validação
          </CardTitle>
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Re-detectar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Lê o hardware reportado pelo Client Local e valida contra a configuração salva.
          Reduz erros típicos de digitação no Terminal ID e no modelo da impressora.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Impressora ── */}
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Impressora térmica</p>
            {printerKnown ? (
              <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Detectada
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="h-3 w-3" /> Não detectada
              </Badge>
            )}
          </div>

          {printerKnown ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Modelo</p>
                <p className="font-medium">{detectedPrinter}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Família</p>
                <p className="font-medium">{printerFamily}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Firmware</p>
                <p className="font-medium">{printerFirmware || '—'}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhum modelo retornado pelo Client Local. Verifique o cabo USB/serial e o
              <code className="bg-muted px-1 rounded mx-1">PRINTER_TYPE</code> no <code className="bg-muted px-1 rounded">.env</code>.
            </p>
          )}
        </div>

        {/* ── Pinpad / Terminal ID ── */}
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">PINPad / Terminal ID</p>
            <StatusPill kind={terminalMatch} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Detectado no pinpad</p>
              <p className="font-mono font-medium">
                {detectedTerminal || <span className="text-muted-foreground italic">— sem leitura —</span>}
              </p>
              {detectedTerminal && !terminalValidFormat && (
                <p className="text-amber-600 text-[11px] mt-0.5 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Formato fora do padrão (4-16 caracteres A-Z, 0-9, -)
                </p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground">Salvo em configuracoes_tef</p>
              <p className="font-mono font-medium">
                {configuredTerminal || <span className="text-muted-foreground italic">— não configurado —</span>}
              </p>
              {tef?.provedor_tef && (
                <p className="text-[11px] text-muted-foreground mt-0.5">Provedor: {tef.provedor_tef}</p>
              )}
            </div>
          </div>

          {terminalMatch === 'mismatch' && (
            <div className="text-xs text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded p-2">
              ⚠️ O Terminal ID configurado <code className="font-mono">{configuredTerminal}</code> não corresponde ao
              detectado <code className="font-mono">{detectedTerminal}</code>. Transações podem ser recusadas pelo adquirente.
            </div>
          )}
          {terminalMatch === 'missing' && (
            <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded p-2">
              ℹ️ Nenhum Terminal ID salvo. Aplique o detectado para liberar transações reais.
            </div>
          )}

          {detectedTerminal && terminalMatch !== 'match' && (
            <Button
              size="sm"
              onClick={applyTerminal}
              disabled={applying === 'pinpad' || !terminalValidFormat || !tef?.id}
              className="gap-2"
            >
              <Save className="h-3.5 w-3.5" />
              {applying === 'pinpad' ? 'Salvando...' : 'Aplicar Terminal ID detectado'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AutoDetectPanel;
