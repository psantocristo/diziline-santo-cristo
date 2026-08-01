import React, { useState } from 'react';
import ParoquianoLayout from '@/components/layouts/ParoquianoLayout';
import { useLoja } from '@/hooks/useLoja';
import ProdutoCard from '@/components/loja/ProdutoCard';
import LojaCarrinho from '@/components/loja/LojaCarrinho';
import CodigoRetirada from '@/components/loja/CodigoRetirada';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ShoppingBag, Package } from 'lucide-react';

const ParoquianoLoja: React.FC = () => {
  const { produtos, loading, lojaAtiva, carrinho, totalCarrinho, adicionarAoCarrinho, alterarQuantidade, removerDoCarrinho, finalizarPedido } = useLoja();
  const { user } = useAuth();
  const { toast } = useToast();
  const [finalizando, setFinalizando] = useState(false);
  const [resultado, setResultado] = useState<{ codigoRetirada: string; total: number } | null>(null);

  const handleFinalizar = async () => {
    setFinalizando(true);
    try {
      const res = await finalizarPedido({
        origem: 'web',
        userId: user?.id,
        nomeCliente: user?.email || undefined,
      });
      setResultado(res);
      toast({ title: '✅ Pedido confirmado!', description: `Código: ${res.codigoRetirada}` });
    } catch (err: any) {
      toast({ title: 'Erro ao finalizar', description: err.message, variant: 'destructive' });
    }
    setFinalizando(false);
  };

  if (!lojaAtiva) {
    return (
      <ParoquianoLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h2 className="text-xl font-bold text-foreground">Loja indisponível</h2>
          <p className="text-muted-foreground mt-2">A loja está temporariamente desabilitada.</p>
        </div>
      </ParoquianoLayout>
    );
  }

  if (resultado) {
    return (
      <ParoquianoLayout>
        <CodigoRetirada
          codigo={resultado.codigoRetirada}
          total={resultado.total}
          onNova={() => setResultado(null)}
        />
      </ParoquianoLayout>
    );
  }

  return (
    <ParoquianoLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" /> Loja
          </h1>
          <p className="text-muted-foreground text-sm">Escolha seus produtos e retire no caixa</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Produtos */}
          <div className="lg:col-span-2">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando produtos...</p>
            ) : produtos.length === 0 ? (
              <div className="text-center py-16">
                <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">Nenhum produto disponível no momento</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {produtos.map(p => (
                  <ProdutoCard
                    key={p.id}
                    {...p}
                    onAdicionar={adicionarAoCarrinho}
                    quantidadeNoCarrinho={carrinho.find(i => i.produtoId === p.id)?.quantidade || 0}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Carrinho */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 rounded-2xl border border-border bg-card p-4">
              <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-primary" />
                Carrinho
                {carrinho.length > 0 && (
                  <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                    {carrinho.reduce((a, i) => a + i.quantidade, 0)}
                  </span>
                )}
              </h2>
              <LojaCarrinho
                itens={carrinho}
                onAlterar={alterarQuantidade}
                onRemover={removerDoCarrinho}
                onFinalizar={handleFinalizar}
              />
            </div>
          </div>
        </div>
      </div>
    </ParoquianoLayout>
  );
};

export default ParoquianoLoja;
