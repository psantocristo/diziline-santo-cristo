import React, { useEffect, useState } from 'react';
import ParoquianoLayout from '@/components/layouts/ParoquianoLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, QrCode, RotateCcw, IdCard } from 'lucide-react';
import CarteirinhaCard from '@/components/carteirinha/CarteirinhaCard';
import { gerarCarteirinhaPDF } from '@/lib/carteirinha/gerar-carteirinha-pdf';
import { gerarTokenCarteirinha, urlVerificacaoCarteirinha } from '@/lib/carteirinha/token';

interface ParoquianoCarteirinha {
  id: string;
  nome_completo: string;
  cpf: string | null;
  matricula_paroquial: string | null;
  data_inicio_dizimista: string | null;
  status: string;
  foto_url: string | null;
}

export default function CarteirinhaPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [lado, setLado] = useState<'frente' | 'verso'>('frente');
  const [paroquiano, setParoquiano] = useState<ParoquianoCarteirinha | null>(null);
  const [fotoSignedUrl, setFotoSignedUrl] = useState<string | null>(null);
  const [nomeParoquia, setNomeParoquia] = useState<string>('Paróquia');
  const [siteRodape, setSiteRodape] = useState<string>('');
  const [logoCarteirinha, setLogoCarteirinha] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    const carregar = async () => {
      if (!user) return;
      setLoading(true);
      const { data } = await (supabase as any)
        .from('paroquianos')
        .select('id, nome_completo, cpf, matricula_paroquial, data_inicio_dizimista, status, foto_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setParoquiano(data);
        if (data.foto_url) {
          const { data: signed } = await supabase.storage
            .from('avatares-paroquianos')
            .createSignedUrl(data.foto_url, 3600);
          if (signed?.signedUrl) setFotoSignedUrl(signed.signedUrl);
        }
        try {
          const token = await gerarTokenCarteirinha(data.id);
          setQrUrl(urlVerificacaoCarteirinha(token));
        } catch (e: any) {
          console.error('Falha ao gerar token da carteirinha', e);
          toast({ title: 'Não foi possível gerar o QR seguro', description: e.message || 'Tente novamente.', variant: 'destructive' });
        }
      }

      // Usa RPC pública (não expõe segredos) — funciona para qualquer dizimista logado
      const { data: cfg } = await (supabase as any).rpc('get_paroquia_publica');
      const row = Array.isArray(cfg) ? cfg[0] : cfg;
      if (row?.nome) setNomeParoquia(row.nome);
      if (row?.site) setSiteRodape(row.site);
      if (row?.logo_carteirinha_url) setLogoCarteirinha(row.logo_carteirinha_url);

      setLoading(false);
    };
    carregar();
  }, [user]);

  const baixarPDF = async () => {
    if (!paroquiano) return;
    setGerando(true);
    try {
      const url = qrUrl || urlVerificacaoCarteirinha(await gerarTokenCarteirinha(paroquiano.id));
      if (!qrUrl) setQrUrl(url);
      const doc = await gerarCarteirinhaPDF({
        nomeParoquia,
        nomeCompleto: paroquiano.nome_completo,
        cpf: paroquiano.cpf,
        registroId: paroquiano.matricula_paroquial,
        dataInicio: paroquiano.data_inicio_dizimista,
        status: paroquiano.status,
        fotoUrl: fotoSignedUrl,
        logoParoquiaUrl: logoCarteirinha,
        qrPayload: url,
        rodape: siteRodape || nomeParoquia,
      });
      const nome = (paroquiano.nome_completo || 'dizimista').replace(/\s+/g, '_').toLowerCase();
      doc.save(`carteirinha_${nome}.pdf`);
      toast({ title: 'PDF gerado!', description: 'Pronto para impressão em tamanho cartão de crédito.' });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar PDF', description: e.message, variant: 'destructive' });
    }
    setGerando(false);
  };

  if (loading) {
    return (
      <ParoquianoLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ParoquianoLayout>
    );
  }

  if (!paroquiano) {
    return (
      <ParoquianoLayout>
        <div className="max-w-md mx-auto text-center py-20 space-y-3">
          <IdCard className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-foreground font-medium">Carteirinha indisponível</p>
          <p className="text-sm text-muted-foreground">
            Sua ficha de dizimista ainda não foi configurada. Procure a secretaria da paróquia.
          </p>
        </div>
      </ParoquianoLayout>
    );
  }

  const qrPayload = qrUrl;

  return (
    <ParoquianoLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <IdCard className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Carteirinha do Dizimista</h2>
        </div>

        <Card className="border-border/60">
          <CardContent className="pt-6 pb-6 flex flex-col items-center gap-4">
            <div className="w-full flex justify-center" style={{ perspective: 1000 }}>
              <CarteirinhaCard
                nomeParoquia={nomeParoquia}
                nomeCompleto={paroquiano.nome_completo}
                cpf={paroquiano.cpf}
                registroId={paroquiano.matricula_paroquial}
                dataInicio={paroquiano.data_inicio_dizimista}
                status={paroquiano.status}
                fotoUrl={fotoSignedUrl}
                logoParoquiaUrl={logoCarteirinha}
                qrPayload={qrPayload}
                lado={lado}
                siteRodape={siteRodape}
                width={Math.min(typeof window !== 'undefined' ? window.innerWidth - 64 : 400, 400)}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              Tamanho real: 85,6 × 54 mm — idêntico a um cartão de crédito. Ao imprimir, use papel
              fotográfico ou PVC e selecione "Tamanho real / 100%" nas opções da impressora.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={() => setLado((l) => (l === 'frente' ? 'verso' : 'frente'))}
            className="h-12"
          >
            {lado === 'frente' ? (
              <><QrCode className="h-4 w-4 mr-2" /> Ver QR Code</>
            ) : (
              <><RotateCcw className="h-4 w-4 mr-2" /> Ver frente</>
            )}
          </Button>
          <Button onClick={baixarPDF} disabled={gerando} className="h-12">
            {gerando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Baixar PDF
          </Button>
        </div>
      </div>
    </ParoquianoLayout>
  );
}
