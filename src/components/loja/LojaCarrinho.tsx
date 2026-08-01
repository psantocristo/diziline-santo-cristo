import React from 'react';
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ItemCarrinho {
  produtoId: string;
  nome: string;
  preco: number;
  quantidade: number;
  imagem_url: string | null;
  estoqueDisponivel: number;
}

interface LojaCarrinhoProps {
  itens: ItemCarrinho[];
  onAlterar: (produtoId: string, quantidade: number) => void;
  onRemover: (produtoId: string) => void;
  onFinalizar: () => void;
  compacto?: boolean; // para totem
}

const LojaCarrinho: React.FC<LojaCarrinhoProps> = ({ itens, onAlterar, onRemover, onFinalizar, compacto }) => {
  const total = itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0);

  if (itens.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'hsl(var(--muted-foreground))' }}>
        <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p className={compacto ? 'text-lg' : 'text-sm'}>Carrinho vazio</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {itens.map(item => (
        <div key={item.produtoId} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
          {item.imagem_url ? (
            <img src={item.imagem_url} alt={item.nome} className={`${compacto ? 'h-14 w-14' : 'h-10 w-10'} object-cover rounded-lg`} />
          ) : (
            <div className={`${compacto ? 'h-14 w-14' : 'h-10 w-10'} rounded-lg bg-muted flex items-center justify-center`}>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className={`font-medium truncate ${compacto ? 'text-lg' : 'text-sm'}`}>{item.nome}</p>
            <p className={`text-muted-foreground ${compacto ? 'text-base' : 'text-xs'}`}>
              {item.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => item.quantidade > 1 ? onAlterar(item.produtoId, item.quantidade - 1) : onRemover(item.produtoId)}
              className={`rounded-full flex items-center justify-center bg-muted hover:bg-muted/80 ${compacto ? 'h-10 w-10' : 'h-7 w-7'}`}
            >
              {item.quantidade === 1 ? <Trash2 className={compacto ? 'h-4 w-4' : 'h-3 w-3'} style={{ color: 'hsl(var(--destructive))' }} /> : <Minus className={compacto ? 'h-4 w-4' : 'h-3 w-3'} />}
            </button>
            <span className={`font-bold min-w-[24px] text-center ${compacto ? 'text-xl' : 'text-sm'}`}>{item.quantidade}</span>
            <button
              onClick={() => item.quantidade < item.estoqueDisponivel && onAlterar(item.produtoId, item.quantidade + 1)}
              disabled={item.quantidade >= item.estoqueDisponivel}
              className={`rounded-full flex items-center justify-center bg-muted hover:bg-muted/80 disabled:opacity-40 ${compacto ? 'h-10 w-10' : 'h-7 w-7'}`}
            >
              <Plus className={compacto ? 'h-4 w-4' : 'h-3 w-3'} />
            </button>
          </div>
        </div>
      ))}

      <div className={`flex items-center justify-between pt-2 border-t border-border ${compacto ? 'text-xl' : 'text-base'}`}>
        <span className="font-medium">Total:</span>
        <span className="font-bold text-primary">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
      </div>

      <Button
        onClick={onFinalizar}
        className={`w-full gap-2 ${compacto ? 'py-6 text-lg' : ''}`}
        size={compacto ? 'lg' : 'default'}
      >
        <ShoppingCart className="h-5 w-5" /> Finalizar Compra
      </Button>
    </div>
  );
};

export default LojaCarrinho;
