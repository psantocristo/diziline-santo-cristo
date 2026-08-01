import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ItemCarrinho } from '@/components/loja/LojaCarrinho';

export interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  estoque: number;
  slug: string;
  imagem_url: string | null;
}

export function useLoja() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [lojaAtiva, setLojaAtiva] = useState(false);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);

  const fetchProdutos = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('produtos')
      .select('id, nome, descricao, preco, estoque, slug, imagem_url')
      .eq('ativo', true)
      .gt('estoque', 0)
      .order('nome');
    setProdutos(data || []);
    setLoading(false);
  }, []);

  const checkLojaAtiva = useCallback(async () => {
    const { data } = await supabase.rpc('get_loja_config');
    if (data && typeof data === 'object' && 'loja_ativa' in (data as any)) {
      setLojaAtiva((data as any).loja_ativa);
    }
  }, []);

  useEffect(() => {
    checkLojaAtiva();
    fetchProdutos();
  }, []);

  const adicionarAoCarrinho = (produtoId: string) => {
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) return;

    setCarrinho(prev => {
      const existente = prev.find(i => i.produtoId === produtoId);
      if (existente) {
        if (existente.quantidade >= produto.estoque) return prev;
        return prev.map(i => i.produtoId === produtoId ? { ...i, quantidade: i.quantidade + 1 } : i);
      }
      return [...prev, {
        produtoId: produto.id,
        nome: produto.nome,
        preco: produto.preco,
        quantidade: 1,
        imagem_url: produto.imagem_url,
        estoqueDisponivel: produto.estoque,
      }];
    });
  };

  const alterarQuantidade = (produtoId: string, quantidade: number) => {
    setCarrinho(prev => prev.map(i => i.produtoId === produtoId ? { ...i, quantidade } : i));
  };

  const removerDoCarrinho = (produtoId: string) => {
    setCarrinho(prev => prev.filter(i => i.produtoId !== produtoId));
  };

  const limparCarrinho = () => setCarrinho([]);

  const totalCarrinho = carrinho.reduce((acc, i) => acc + i.preco * i.quantidade, 0);

  const finalizarPedido = async (opts: { origem: 'web' | 'totem'; userId?: string; paroquianoId?: string; nomeCliente?: string }) => {
    if (carrinho.length === 0) throw new Error('Carrinho vazio');

    // Create pedido
    const { data: pedido, error: pedidoError } = await (supabase as any)
      .from('pedidos')
      .insert({
        user_id: opts.userId || null,
        paroquiano_id: opts.paroquianoId || null,
        nome_cliente: opts.nomeCliente || null,
        origem: opts.origem,
        total: totalCarrinho,
      })
      .select()
      .single();

    if (pedidoError) throw pedidoError;

    // Insert items
    const itens = carrinho.map(i => ({
      pedido_id: pedido.id,
      produto_id: i.produtoId,
      quantidade: i.quantidade,
      preco_unitario: i.preco,
    }));

    const { error: itensError } = await (supabase as any).from('itens_pedido').insert(itens);
    if (itensError) throw itensError;

    limparCarrinho();
    return { codigoRetirada: pedido.codigo_retirada, total: pedido.total, pedidoId: pedido.id };
  };

  return {
    produtos,
    loading,
    lojaAtiva,
    carrinho,
    totalCarrinho,
    adicionarAoCarrinho,
    alterarQuantidade,
    removerDoCarrinho,
    limparCarrinho,
    finalizarPedido,
    refetch: fetchProdutos,
  };
}
