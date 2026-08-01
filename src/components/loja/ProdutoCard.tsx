import React from 'react';
import { Plus, Package } from 'lucide-react';

interface ProdutoCardProps {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  estoque: number;
  imagem_url: string | null;
  onAdicionar: (id: string) => void;
  compacto?: boolean; // totem mode
  quantidadeNoCarrinho?: number;
}

const ProdutoCard: React.FC<ProdutoCardProps> = ({ id, nome, descricao, preco, estoque, imagem_url, onAdicionar, compacto, quantidadeNoCarrinho = 0 }) => {
  const semEstoque = estoque <= 0;
  const estoqueRestante = estoque - quantidadeNoCarrinho;

  return (
    <div
      className={`rounded-2xl border border-border overflow-hidden flex flex-col transition-transform ${!semEstoque ? 'active:scale-[0.98] cursor-pointer' : 'opacity-60'} bg-card`}
      onClick={() => !semEstoque && estoqueRestante > 0 && onAdicionar(id)}
      style={{ minHeight: compacto ? 280 : 200 }}
    >
      {imagem_url ? (
        <img src={imagem_url} alt={nome} className={`w-full object-cover ${compacto ? 'h-40' : 'h-32'}`} />
      ) : (
        <div className={`w-full bg-muted flex items-center justify-center ${compacto ? 'h-40' : 'h-32'}`}>
          <Package className={`${compacto ? 'h-16 w-16' : 'h-10 w-10'} text-muted-foreground/40`} />
        </div>
      )}
      <div className="p-3 flex-1 flex flex-col justify-between gap-2">
        <div>
          <h3 className={`font-bold leading-tight ${compacto ? 'text-xl' : 'text-sm'}`}>{nome}</h3>
          {descricao && <p className={`text-muted-foreground mt-1 line-clamp-2 ${compacto ? 'text-base' : 'text-xs'}`}>{descricao}</p>}
        </div>
        <div className="flex items-center justify-between">
          <span className={`font-bold text-primary ${compacto ? 'text-xl' : 'text-base'}`}>
            {preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
          {semEstoque ? (
            <span className={`text-destructive font-medium ${compacto ? 'text-base' : 'text-xs'}`}>Esgotado</span>
          ) : estoqueRestante <= 0 ? (
            <span className={`text-muted-foreground font-medium ${compacto ? 'text-base' : 'text-xs'}`}>Máx. atingido</span>
          ) : (
            <div
              className={`rounded-full flex items-center justify-center ${compacto ? 'h-12 w-12' : 'h-8 w-8'}`}
              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
            >
              <Plus className={compacto ? 'h-6 w-6' : 'h-4 w-4'} />
            </div>
          )}
        </div>
        {quantidadeNoCarrinho > 0 && (
          <div className={`text-center font-medium ${compacto ? 'text-base' : 'text-xs'}`} style={{ color: 'hsl(var(--primary))' }}>
            {quantidadeNoCarrinho} no carrinho
          </div>
        )}
      </div>
    </div>
  );
};

export default ProdutoCard;
