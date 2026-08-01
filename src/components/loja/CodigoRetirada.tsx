import React from 'react';
import { CheckCircle, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface CodigoRetiradaProps {
  codigo: string;
  total: number;
  compacto?: boolean;
  onNova?: () => void;
}

const CodigoRetirada: React.FC<CodigoRetiradaProps> = ({ codigo, total, compacto, onNova }) => {
  const { toast } = useToast();

  const copiar = () => {
    navigator.clipboard.writeText(codigo);
    toast({ title: 'Código copiado!' });
  };

  return (
    <div className="flex flex-col items-center gap-6 text-center py-8">
      <div
        className="rounded-full flex items-center justify-center"
        style={{ width: compacto ? 120 : 80, height: compacto ? 120 : 80, background: 'hsl(142 71% 45% / 0.15)' }}
      >
        <CheckCircle style={{ width: compacto ? 64 : 44, height: compacto ? 64 : 44, color: 'hsl(142 71% 45%)' }} />
      </div>

      <div>
        <h2 className={`font-bold ${compacto ? 'text-3xl' : 'text-xl'}`} style={{ color: 'hsl(var(--foreground))' }}>
          Pedido Confirmado!
        </h2>
        <p className={`text-muted-foreground mt-1 ${compacto ? 'text-xl' : 'text-sm'}`}>
          Apresente o código abaixo no caixa para retirar
        </p>
      </div>

      <div
        className="rounded-2xl px-8 py-6 border-2 border-dashed"
        style={{ borderColor: 'hsl(var(--primary))', background: 'hsl(var(--primary) / 0.08)' }}
      >
        <p className={`font-mono font-black tracking-wider ${compacto ? 'text-5xl' : 'text-3xl'}`} style={{ color: 'hsl(var(--primary))' }}>
          {codigo}
        </p>
      </div>

      <p className={`font-bold ${compacto ? 'text-2xl' : 'text-lg'}`}>
        Total: {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </p>

      {!compacto && (
        <Button variant="outline" size="sm" onClick={copiar} className="gap-2">
          <Copy className="h-4 w-4" /> Copiar Código
        </Button>
      )}

      {onNova && (
        <Button onClick={onNova} className={compacto ? 'mt-4 py-6 px-10 text-xl' : 'mt-2'} size={compacto ? 'lg' : 'default'}>
          {compacto ? 'Voltar ao Início' : 'Fazer Nova Compra'}
        </Button>
      )}
    </div>
  );
};

export default CodigoRetirada;
