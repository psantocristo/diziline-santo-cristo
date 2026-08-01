import React, { useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import ParoquianoLayout from '@/components/layouts/ParoquianoLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Printer, Loader2 } from 'lucide-react';

interface Pagamento {
  id: string;
  tipo: string;
  valor: number;
  metodo: string;
  status: string;
  pago_em: string | null;
  created_at: string;
  codigo_autenticacao: string | null;
  mes_referencia: string | null;
}

interface ParoquiaData {
  nome: string;
  cnpj: string | null;
  site: string | null;
}

const TIPO_LABEL: Record<string, string> = { dizimo: 'Dízimo', oferta: 'Oferta', campanha: 'Campanha', eventual: 'Eventual' };
const METODO_LABEL: Record<string, string> = { pix: 'PIX', credito: 'Cartão de Crédito', debito: 'Cartão de Débito' };

const gerarHtmlComprovante = (pagamento: Pagamento, nomeCompleto: string, paroquia: ParoquiaData) => {
  const mesRefLabel = (() => {
    if (pagamento.tipo !== 'dizimo' || !pagamento.mes_referencia) return null;
    const d = new Date(pagamento.mes_referencia + 'T12:00:00');
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  })();

  return `
    <html><head><title>Comprovante</title>
    <style>
      body { font-family: 'Courier New', monospace; font-size: 12px; max-width: 80mm; margin: 0 auto; padding: 10px; }
      .divider { border-top: 1px dashed #000; margin: 8px 0; }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .row { display: flex; justify-content: space-between; margin: 3px 0; }
    </style>
    </head><body>
      <div class="center bold" style="font-size: 14px">${paroquia.nome || 'PARÓQUIA'}</div>
      <div class="divider"></div>
      <div class="center bold">COMPROVANTE DE CONTRIBUIÇÃO</div>
      <div class="divider"></div>
      <div class="row"><span>Nome:</span><span>${nomeCompleto}</span></div>
      <div class="row"><span>Tipo:</span><span>${TIPO_LABEL[pagamento.tipo] || pagamento.tipo}</span></div>
      ${mesRefLabel ? `<div class="row" style="border:1px dashed #000;padding:2px 4px;margin:4px 0;background:#f5f5f5"><span style="font-weight:bold">Mês Ref.:</span><span style="font-weight:bold">${mesRefLabel}</span></div>` : ''}
      <div class="row"><span>Valor:</span><span class="bold">R$ ${Number(pagamento.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
      <div class="row"><span>Forma:</span><span>${METODO_LABEL[pagamento.metodo] || pagamento.metodo}</span></div>
      <div class="row"><span>Status:</span><span>✓ PAGO</span></div>
      <div class="row"><span>Data:</span><span>${new Date(pagamento.pago_em || pagamento.created_at).toLocaleDateString('pt-BR')}</span></div>
      <div class="row"><span>Hora:</span><span>${new Date(pagamento.pago_em || pagamento.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div class="divider"></div>
      <div class="row"><span style="font-size:10px">ID Transação:</span><span style="font-size:9px">${pagamento.id.substring(0, 16)}</span></div>
      <div class="row"><span style="font-size:10px">Autenticação:</span><span style="font-size:9px">${pagamento.codigo_autenticacao || 'N/A'}</span></div>
      <div class="divider"></div>
      ${paroquia.cnpj ? `<div class="center" style="font-size:9px">CNPJ: ${paroquia.cnpj}</div>` : ''}
      ${paroquia.site ? `<div class="center" style="font-size:9px">${paroquia.site}</div>` : ''}
      <div class="center" style="font-size:10px;margin-top:8px">"Deus lhe pague pela sua fidelidade!"</div>
      <div class="center" style="font-size:9px;margin-top:4px">Sistema Dízimo Santo Cristo v1.0</div>
    </body></html>
  `;
};

const imprimirDireto = (pagamento: Pagamento, nomeCompleto: string, paroquia: ParoquiaData) => {
  const html = gerarHtmlComprovante(pagamento, nomeCompleto, paroquia);
  const w = window.open('', '_blank', 'width=400,height=600');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.print();
};

interface ComprovanteDialogProps {
  pagamento: Pagamento;
  nomeCompleto: string;
  paroquia: ParoquiaData;
  onClose: () => void;
}

const ComprovanteView: React.FC<ComprovanteDialogProps> = ({ pagamento, nomeCompleto, paroquia, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = () => imprimirDireto(pagamento, nomeCompleto, paroquia);

  const mesRefLabel = (() => {
    if (pagamento.tipo !== 'dizimo' || !pagamento.mes_referencia) return null;
    const d = new Date(pagamento.mes_referencia + 'T12:00:00');
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  })();

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl shadow-lg max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
        <div ref={printRef} className="print-thermal">
          <div className="center bold" style={{ fontSize: '14px' }}>{paroquia.nome || 'PARÓQUIA'}</div>
          <div className="divider" />
          <div className="center bold">COMPROVANTE DE CONTRIBUIÇÃO</div>
          <div className="divider" />
          <div className="row"><span>Nome:</span><span>{nomeCompleto}</span></div>
          <div className="row"><span>Tipo:</span><span>{TIPO_LABEL[pagamento.tipo] || pagamento.tipo}</span></div>
          {mesRefLabel && (
            <div className="row" style={{ border: '1px dashed #000', padding: '2px 4px', margin: '4px 0', background: '#f5f5f5' }}>
              <span style={{ fontWeight: 'bold' }}>Mês Ref.:</span>
              <span style={{ fontWeight: 'bold' }}>{mesRefLabel}</span>
            </div>
          )}
          <div className="row"><span>Valor:</span><span className="bold">R$ {Number(pagamento.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
          <div className="row"><span>Forma:</span><span>{METODO_LABEL[pagamento.metodo] || pagamento.metodo}</span></div>
          <div className="row"><span>Status:</span><span>✓ PAGO</span></div>
          <div className="row"><span>Data:</span><span>{new Date(pagamento.pago_em || pagamento.created_at).toLocaleDateString('pt-BR')}</span></div>
          <div className="row"><span>Hora:</span><span>{new Date(pagamento.pago_em || pagamento.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div>
          <div className="divider" />
          <div className="row"><span style={{ fontSize: '10px' }}>ID Transação:</span><span style={{ fontSize: '9px' }}>{pagamento.id.substring(0, 16)}</span></div>
          <div className="row"><span style={{ fontSize: '10px' }}>Autenticação:</span><span style={{ fontSize: '9px' }}>{pagamento.codigo_autenticacao || 'N/A'}</span></div>
          <div className="divider" />
          {paroquia.cnpj && <div className="center" style={{ fontSize: '9px' }}>CNPJ: {paroquia.cnpj}</div>}
          {paroquia.site && <div className="center" style={{ fontSize: '9px' }}>{paroquia.site}</div>}
          <div className="center" style={{ fontSize: '10px', marginTop: '8px' }}>
            "Deus lhe pague pela sua fidelidade!"
          </div>
          <div className="center" style={{ fontSize: '9px', marginTop: '4px' }}>
            Sistema Dízimo Santo Cristo v1.0
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <Button onClick={handlePrint} className="flex-1 bg-secondary hover:bg-secondary/90 text-secondary-foreground">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">Fechar</Button>
        </div>
      </div>
    </div>
  );
};

const fetchComprovantes = async (userId: string) => {
  const [pagRes, profileRes, paroquiaRes] = await Promise.all([
    supabase.from('pagamentos')
      .select('id, tipo, valor, metodo, status, pago_em, created_at, codigo_autenticacao, mes_referencia')
      .eq('user_id', userId)
      .eq('status', 'pago')
      .order('pago_em', { ascending: false }),
    supabase.from('profiles').select('nome_completo').eq('id', userId).single(),
    supabase.rpc('get_tema_paroquia'),
  ]);

  const paroquiaData = paroquiaRes.data as any;

  return {
    pagamentos: (pagRes.data || []) as Pagamento[],
    nomeCompleto: profileRes.data?.nome_completo || '',
    paroquia: {
      nome: paroquiaData?.nome || 'PARÓQUIA',
      cnpj: paroquiaData?.cnpj || null,
      site: paroquiaData?.site || null,
    } as ParoquiaData,
  };
};

const Comprovantes = () => {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Pagamento | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['paroquiano-comprovantes', user?.id],
    queryFn: () => fetchComprovantes(user!.id),
    enabled: !!user,
  });

  const pagamentos = data?.pagamentos || [];
  const nomeCompleto = data?.nomeCompleto || '';
  const paroquia = data?.paroquia || { nome: 'PARÓQUIA', cnpj: null, site: null };

  if (isLoading) {
    return (
      <ParoquianoLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ParoquianoLayout>
    );
  }

  return (
    <ParoquianoLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Comprovantes</h2>
          <p className="text-muted-foreground text-sm">Baixe ou imprima seus comprovantes de pagamento</p>
        </div>

        {pagamentos.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum comprovante disponível.</p>
            </CardContent>
          </Card>
        ) : (
          pagamentos.map(p => (
            <Card key={p.id} className="border-border/60 hover:shadow-card transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="bg-accent border border-border rounded-xl p-2.5 shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{TIPO_LABEL[p.tipo] || p.tipo}</p>
                    {p.tipo === 'dizimo' && p.mes_referencia && (() => {
                      const d = new Date(p.mes_referencia + 'T12:00:00');
                      const mesLabel = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                      return (
                        <p className="text-xs font-medium text-primary mt-0.5">
                          📅 {mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)}
                        </p>
                      );
                    })()}
                    <p className="text-sm text-muted-foreground">
                      R$ {Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · {' '}
                      {new Date(p.pago_em || p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      Cód: {p.codigo_autenticacao || 'N/A'}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => imprimirDireto(p, nomeCompleto, paroquia)} title="Imprimir 2ª Via">
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSelected(p)}>
                      Ver
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {selected && (
        <ComprovanteView
          pagamento={selected}
          nomeCompleto={nomeCompleto}
          paroquia={paroquia}
          onClose={() => setSelected(null)}
        />
      )}
    </ParoquianoLayout>
  );
};

export default Comprovantes;
