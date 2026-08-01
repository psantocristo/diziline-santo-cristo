/**
 * Modal de personalização do comprovante térmico.
 * Permite escolher preset (Epson TM-T20 etc), alternar campos visíveis,
 * configurar guilhotina (corte parcial/total/nenhum) e ver preview ao vivo.
 */
import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Scissors, Save, RotateCcw, Printer, Settings2 } from 'lucide-react';
import {
  ComprovanteConfig,
  DEFAULT_COMPROVANTE_CONFIG,
  PRESETS_IMPRESSORA,
  PresetImpressora,
  mergeConfig,
} from '@/lib/comprovante-config';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Configuração atual vinda do banco (parcial é OK). */
  initialConfig: Partial<ComprovanteConfig> | null | undefined;
  /** Preset salvo no banco. */
  initialPreset?: string | null;
  /** Logo para exibir no preview. */
  logoUrl?: string;
  /** Nome / CNPJ da paróquia (preview). */
  nomeParoquia?: string;
  cnpjParoquia?: string;
  siteParoquia?: string;
  telefoneParoquia?: string;
  /** Callback de salvar — recebe config completa + preset. */
  onSave: (config: ComprovanteConfig, preset: PresetImpressora) => Promise<void> | void;
}

const PersonalizarComprovanteModal: React.FC<Props> = ({
  open, onOpenChange, initialConfig, initialPreset, logoUrl,
  nomeParoquia, cnpjParoquia, siteParoquia, telefoneParoquia, onSave,
}) => {
  const [preset, setPreset] = useState<PresetImpressora>(
    (initialPreset as PresetImpressora) || 'epson_tm_t20'
  );
  const [cfg, setCfg] = useState<ComprovanteConfig>(mergeConfig(initialConfig));
  const [salvando, setSalvando] = useState(false);

  const set = <K extends keyof ComprovanteConfig>(k: K, v: ComprovanteConfig[K]) =>
    setCfg(c => ({ ...c, [k]: v }));

  const aplicarPreset = (p: PresetImpressora) => {
    setPreset(p);
    setCfg(c => ({ ...c, ...PRESETS_IMPRESSORA[p].config }));
  };

  const restaurarPadrao = () => {
    setPreset('epson_tm_t20');
    setCfg({ ...DEFAULT_COMPROVANTE_CONFIG, ...PRESETS_IMPRESSORA.epson_tm_t20.config });
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await onSave(cfg, preset);
      onOpenChange(false);
    } finally {
      setSalvando(false);
    }
  };

  const corteLabel = useMemo(() => ({
    partial: { txt: 'Corte parcial (recomendado)', desc: 'Guilhotina deixa um pequeno fiapo — fácil de destacar manualmente. Padrão Epson.' },
    full:    { txt: 'Corte total',                 desc: 'Guilhotina corta totalmente o papel. Use em Bematech ou impressoras que não fazem parcial.' },
    none:    { txt: 'Sem corte',                   desc: 'Apenas avança o papel. Usuário corta manualmente. Para impressoras 58mm sem guilhotina.' },
  }), []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Personalizar Comprovante Térmico
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Escolha o modelo da impressora, os campos que aparecem no cupom e o tipo de corte da guilhotina.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* === Coluna esquerda: configuração === */}
          <div className="space-y-5">
            {/* Preset */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Printer className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-semibold">Modelo da impressora</Label>
                </div>
                <Select value={preset} onValueChange={v => aplicarPreset(v as PresetImpressora)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRESETS_IMPRESSORA).map(([k, p]) => (
                      <SelectItem key={k} value={k}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Aplicar um preset preenche corte, largura e code page com valores testados. Você pode ajustar depois.
                </p>
              </CardContent>
            </Card>

            {/* Corte/guilhotina */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-semibold">Corte da guilhotina</Label>
                </div>
                <Select value={cfg.corteTipo} onValueChange={(v: any) => set('corteTipo', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="partial">{corteLabel.partial.txt}</SelectItem>
                    <SelectItem value="full">{corteLabel.full.txt}</SelectItem>
                    <SelectItem value="none">{corteLabel.none.txt}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{corteLabel[cfg.corteTipo].desc}</p>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <Label className="text-xs">Linhas em branco antes do corte</Label>
                    <Input type="number" min={0} max={10}
                      value={cfg.linhasAvancoFinal}
                      onChange={e => set('linhasAvancoFinal', Math.max(0, Math.min(10, +e.target.value || 0)))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Largura do papel</Label>
                    <Select value={String(cfg.larguraPapelMm)} onValueChange={v => set('larguraPapelMm', +v as 58 | 80)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="80">80 mm (padrão)</SelectItem>
                        <SelectItem value="58">58 mm (compacta)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Campos do cupom */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <Label className="text-sm font-semibold">Campos exibidos no cupom</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  {([
                    ['mostrarLogo', 'Logo da paróquia'],
                    ['mostrarCnpj', 'CNPJ'],
                    ['mostrarContribuinte', 'Nome do Dizimista/Fiel'],
                    ['mostrarMesReferencia', 'Mês de referência (dízimo)'],
                    ['mostrarId', 'ID da transação'],
                    ['mostrarStatus', 'Status "PAGO ✓"'],
                    ['mostrarBencao', 'Frase de bênção'],
                    ['mostrarCitacao', 'Citação bíblica'],
                    ['mostrarSite', 'Site da paróquia'],
                    ['mostrarTelefone', 'Telefone'],
                    ['mostrarRodapeGuarde', 'Texto "Guarde este comprovante"'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/40 last:border-0">
                      <span className="text-sm">{label}</span>
                      <Switch checked={cfg[key] as boolean} onCheckedChange={v => set(key, v)} />
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Textos personalizáveis */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <Label className="text-sm font-semibold">Textos personalizados</Label>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Título do documento</Label>
                    <Input value={cfg.tituloDocumento} maxLength={50}
                      onChange={e => set('tituloDocumento', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Frase de bênção</Label>
                    <Input value={cfg.textoBencao} maxLength={60}
                      onChange={e => set('textoBencao', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Texto do rodapé</Label>
                    <Input value={cfg.textoRodape} maxLength={80}
                      onChange={e => set('textoRodape', e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* === Coluna direita: preview === */}
          <div className="lg:sticky lg:top-0 h-fit">
            <Label className="text-xs font-medium mb-2 block">Preview ({cfg.larguraPapelMm}mm)</Label>
            <div style={{ background: '#e5e7eb', padding: 16, borderRadius: 12 }}>
              <div style={{
                width: cfg.larguraPapelMm === 80 ? 280 : 220,
                margin: '0 auto',
                background: '#fff',
                fontFamily: '"Courier New", monospace',
                fontSize: 10.5,
                color: '#000',
                padding: '12px 10px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                lineHeight: 1.45,
              }}>
                {cfg.mostrarLogo && logoUrl && (
                  <div style={{ textAlign: 'center', marginBottom: 6 }}>
                    <img src={logoUrl} alt="logo" style={{ maxHeight: 44, maxWidth: 140, objectFit: 'contain', filter: 'grayscale(100%)', margin: '0 auto' }} />
                  </div>
                )}
                {cfg.mostrarCnpj && cnpjParoquia && (
                  <div style={{ textAlign: 'center', fontSize: 9 }}>CNPJ: {cnpjParoquia}</div>
                )}
                <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />
                <div style={{ textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, fontSize: 10 }}>
                  {cfg.tituloDocumento}
                </div>
                <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />
                <Row label="Data / Hora" value={new Date().toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })} />
                <Row label="Tipo" value="Dízimo" bold />
                {cfg.mostrarMesReferencia && (
                  <div style={{ border:'1px dashed #000', padding:'2px 4px', margin:'4px 0', background:'#f5f5f5', display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontWeight:'bold' }}>Mês de Referência</span><span style={{ fontWeight:'bold' }}>Janeiro 2026</span>
                  </div>
                )}
                {cfg.mostrarContribuinte && <Row label="Dizimista" value="João da Silva" bold />}
                <div style={{ border:'2px solid #000', padding:'4px 6px', margin:'6px 0', textAlign:'center' }}>
                  <div style={{ fontSize: 8, letterSpacing: 2 }}>VALOR TOTAL</div>
                  <div style={{ fontSize: 16, fontWeight: 'bold' }}>R$ 150,00</div>
                </div>
                <Row label="Método" value="PIX" bold />
                {cfg.mostrarId && <Row label="ID" value="#A1B2C3D4" mono />}
                {cfg.mostrarStatus && (
                  <div style={{ display:'flex', justifyContent:'space-between', margin:'3px 0' }}>
                    <span style={{ color:'#444' }}>Status</span>
                    <span style={{ border:'1px solid #000', padding:'0 6px', fontSize: 9, fontWeight: 'bold' }}>PAGO ✓</span>
                  </div>
                )}
                {cfg.mostrarCitacao && (
                  <div style={{ textAlign:'center', fontStyle:'italic', fontSize: 9, margin:'6px 0', padding: 4, border:'1px dashed #000' }}>
                    "Cada um dê conforme decidiu em seu coração."<br/><span style={{ fontWeight: 'bold' }}>— 2 Coríntios 9,7</span>
                  </div>
                )}
                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                <div style={{ textAlign: 'center', fontSize: 9 }}>
                  {cfg.mostrarBencao && <div style={{ fontWeight: 'bold', fontSize: 10, marginBottom: 4 }}>{cfg.textoBencao} 🙏</div>}
                  {cfg.mostrarSite && siteParoquia && <div>{siteParoquia}</div>}
                  {cfg.mostrarTelefone && telefoneParoquia && <div>Tel: {telefoneParoquia}</div>}
                  {cfg.mostrarRodapeGuarde && <div style={{ marginTop: 4, fontSize: 8 }}>{cfg.textoRodape}</div>}
                </div>
                {/* Indicador visual de corte */}
                <div style={{ marginTop: 8 + (cfg.linhasAvancoFinal * 3), borderTop: cfg.corteTipo === 'none' ? '1px dotted #aaa' : '2px dashed #444', textAlign: 'center', fontSize: 8, color: '#666', paddingTop: 2 }}>
                  {cfg.corteTipo === 'partial' && '✂ corte parcial'}
                  {cfg.corteTipo === 'full' && '✂ corte total'}
                  {cfg.corteTipo === 'none' && '— sem corte —'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator />
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={restaurarPadrao} type="button">
            <RotateCcw className="h-4 w-4 mr-2" /> Restaurar padrão
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} type="button">Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>
            <Save className="h-4 w-4 mr-2" /> {salvando ? 'Salvando...' : 'Salvar personalização'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Row: React.FC<{ label: string; value: string; bold?: boolean; mono?: boolean }> = ({ label, value, bold, mono }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '3px 0' }}>
    <span style={{ color: '#444' }}>{label}</span>
    <span style={{ fontWeight: bold ? 'bold' : 'normal', fontFamily: mono ? 'monospace' : 'inherit', fontSize: mono ? 9 : undefined }}>{value}</span>
  </div>
);

export default PersonalizarComprovanteModal;
