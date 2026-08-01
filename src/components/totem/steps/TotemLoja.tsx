import React, { useState } from 'react';
import { ShoppingBag, ArrowLeft, Package } from 'lucide-react';
import { useLoja } from '@/hooks/useLoja';
import ProdutoCard from '@/components/loja/ProdutoCard';
import LojaCarrinho from '@/components/loja/LojaCarrinho';
import CodigoRetirada from '@/components/loja/CodigoRetirada';
import { useToast } from '@/hooks/use-toast';
import { imprimirPedido } from '@/components/totem/PedidoThermal';
import { isLocalClientRunning, printPedido as printPedidoLocal } from '@/lib/local-client';

interface TotemLojaProps {
  onVoltar: () => void;
  paroquianoId?: string;
  nomeCliente?: string;
}

const TotemLoja: React.FC<TotemLojaProps> = ({ onVoltar, paroquianoId, nomeCliente }) => {
  const { produtos, loading, carrinho, totalCarrinho, adicionarAoCarrinho, alterarQuantidade, removerDoCarrinho, finalizarPedido } = useLoja();
  const { toast } = useToast();
  const [finalizando, setFinalizando] = useState(false);
  const [resultado, setResultado] = useState<{ codigoRetirada: string; total: number } | null>(null);
  const [mostrarCarrinho, setMostrarCarrinho] = useState(false);

  const handleFinalizar = async () => {
    setFinalizando(true);
    try {
      const itensParaImprimir = carrinho.map(i => ({
        nome: i.nome,
        quantidade: i.quantidade,
        preco: i.preco,
      }));

      const res = await finalizarPedido({
        origem: 'totem',
        paroquianoId,
        nomeCliente,
      });
      setResultado(res);

      // Impressão térmica automática
      const dadosPedido = {
        codigoRetirada: res.codigoRetirada,
        total: res.total,
        itens: itensParaImprimir,
        nomeCliente,
        dataHora: new Date(),
      };

      try {
        const localOk = await isLocalClientRunning();
        if (localOk) {
          await printPedidoLocal(dadosPedido);
        } else {
          imprimirPedido(dadosPedido);
        }
      } catch {
        // Falha na impressão não bloqueia o fluxo
        imprimirPedido(dadosPedido);
      }
    } catch (err: any) {
      toast({ title: 'Erro ao finalizar', description: err.message, variant: 'destructive' });
    }
    setFinalizando(false);
  };

  if (resultado) {
    return (
      <CodigoRetirada
        codigo={resultado.codigoRetirada}
        total={resultado.total}
        compacto
        onNova={onVoltar}
      />
    );
  }

  const qtdTotal = carrinho.reduce((a, i) => a + i.quantidade, 0);

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onVoltar}
          className="flex items-center gap-2 font-medium"
          style={{ color: 'hsl(var(--secondary-foreground) / 0.55)', fontSize: 18 }}
        >
          <ArrowLeft size={20} /> Voltar
        </button>
        <button
          onClick={() => setMostrarCarrinho(!mostrarCarrinho)}
          className="relative flex items-center gap-2 rounded-2xl px-6 py-3 font-bold"
          style={{
            background: qtdTotal > 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
            color: qtdTotal > 0 ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
            fontSize: 20,
          }}
        >
          <ShoppingBag size={24} />
          Carrinho
          {qtdTotal > 0 && (
            <span
              className="absolute -top-2 -right-2 rounded-full flex items-center justify-center font-bold"
              style={{
                width: 32, height: 32, fontSize: 16,
                background: 'hsl(var(--destructive))',
                color: 'hsl(var(--destructive-foreground))',
              }}
            >
              {qtdTotal}
            </span>
          )}
        </button>
      </div>

      {mostrarCarrinho ? (
        <div className="rounded-3xl border-2 border-border bg-card p-6">
          <h2 className="font-bold text-2xl mb-4 flex items-center gap-2">
            <ShoppingBag className="h-7 w-7 text-primary" /> Seu Carrinho
          </h2>
          <LojaCarrinho
            itens={carrinho}
            onAlterar={alterarQuantidade}
            onRemover={removerDoCarrinho}
            onFinalizar={handleFinalizar}
            compacto
          />
          {carrinho.length > 0 && (
            <button
              onClick={() => setMostrarCarrinho(false)}
              className="w-full mt-3 py-3 font-medium rounded-xl"
              style={{ color: 'hsl(var(--muted-foreground))', fontSize: 18 }}
            >
              Continuar comprando
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="text-center">
            <h2 className="font-bold text-secondary-foreground" style={{ fontSize: 32 }}>
              Loja
            </h2>
            <p className="text-secondary-foreground/55" style={{ fontSize: 20 }}>
              Toque no produto para adicionar ao carrinho
            </p>
          </div>

          {loading ? (
            <p className="text-center py-12" style={{ color: 'hsl(var(--muted-foreground))', fontSize: 20 }}>
              Carregando produtos...
            </p>
          ) : produtos.length === 0 ? (
            <div className="text-center py-16">
              <Package className="h-20 w-20 mx-auto mb-4" style={{ color: 'hsl(var(--muted-foreground) / 0.3)' }} />
              <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: 22 }}>Nenhum produto disponível</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-5">
              {produtos.map(p => (
                <ProdutoCard
                  key={p.id}
                  {...p}
                  onAdicionar={adicionarAoCarrinho}
                  compacto
                  quantidadeNoCarrinho={carrinho.find(i => i.produtoId === p.id)?.quantidade || 0}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TotemLoja;
