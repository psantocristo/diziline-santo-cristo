/**
 * CarteirinhaCard — Preview visual da carteirinha do dizimista.
 * Grade em mm (ID-1: 85.6 × 53.98). 1 unidade = 1mm * scale.
 * Tipografia em pt: pxFromPt(pt) = pt * scale * 0.353
 */
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, Church } from 'lucide-react';

interface Props {
  nomeParoquia: string;
  nomeCompleto: string;
  cpf?: string | null;
  registroId?: string | null;
  dataInicio?: string | null;
  status: string;
  fotoUrl?: string | null;
  brasaoUrl?: string;
  logoParoquiaUrl?: string | null;
  qrPayload?: string;
  siteRodape?: string;
  lado?: 'frente' | 'verso';
  width?: number;
}

const CARD_W = 85.6;
const CARD_H = 53.98;
const RATIO = CARD_W / CARD_H;

const COLORS = {
  bordo: '#5a1a1a',
  bordoDark: '#3c0e0e',
  ouro: '#c9a84c',
  ouroClaro: '#f0d78c',
  marfim: '#fcf8ee',
};

function formatMesAno(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  const s = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  const partes = s.replace(/\./g, '').replace(' de ', '/').split('/');
  if (partes.length === 2) {
    return `${partes[0][0].toUpperCase() + partes[0].slice(1)}/${partes[1]}`;
  }
  return s;
}
function formatCpf(cpf?: string | null): string {
  if (!cpf) return '—';
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function formatRegistro(reg?: string | null): string {
  if (!reg) return '—';
  const d = reg.replace(/\D/g, '');
  if (d.length >= 4 && d.length <= 9 && d === reg.replace(/\s/g, '')) {
    const body = d.slice(0, d.length - 1);
    const dv = d.slice(-1);
    return body.replace(/(\d{3})(?=\d)/g, '$1.') + '-' + dv;
  }
  return reg;
}

const CarteirinhaCard: React.FC<Props> = ({
  nomeParoquia,
  nomeCompleto,
  cpf,
  registroId,
  dataInicio,
  status,
  fotoUrl,
  brasaoUrl = '/images/certificados/brasao-diocese.png',
  logoParoquiaUrl = null,
  qrPayload = '',
  siteRodape = '',
  lado = 'frente',
  width = 420,
}) => {
  const height = width / RATIO;
  const scale = width / CARD_W; // px per mm
  const mm = (v: number) => v * scale;
  const pt = (v: number) => v * scale * 0.353; // 1pt ≈ 0.353mm

  const iniciais = (nomeCompleto || '')
    .split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'DZ';

  const isAtivo = (status || '').toLowerCase() === 'ativo';
  const statusTexto = isAtivo ? 'DIZIMISTA ATIVO' : `DIZIMISTA ${(status || 'INATIVO').toUpperCase()}`;

  // Título da paróquia: tenta 2 linhas, 7pt; se nome muito longo, encolhe.
  const tituloFontPt = (nomeParoquia || '').length > 32 ? 6 : 7;

  if (lado === 'verso') {
    return (
      <div
        role="img"
        aria-label={`Verso da carteirinha de ${nomeCompleto}`}
        style={{
          width, height,
          borderRadius: mm(2.5),
          background: COLORS.marfim,
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          border: `1px solid ${COLORS.ouro}66`,
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        {/* borda dourada */}
        <div style={{
          position: 'absolute', inset: mm(1.2),
          border: `1px solid ${COLORS.ouro}`, borderRadius: mm(2),
          pointerEvents: 'none',
        }} />

        {/* Header */}
        <div style={{
          position: 'absolute', top: mm(3.5), left: mm(4), right: mm(4),
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{
            color: COLORS.bordoDark, fontWeight: 700, fontSize: pt(6),
            letterSpacing: mm(0.05), textTransform: 'uppercase',
          }}>
            Identificação Oficial do Dizimista
          </div>
          <img src={brasaoUrl} alt="" style={{ width: mm(7), height: mm(7), objectFit: 'contain' }} />
        </div>

        {/* Linha dourada */}
        <div style={{
          position: 'absolute', top: mm(11), left: mm(4), right: mm(4),
          height: 1, background: `${COLORS.ouro}99`,
        }} />

        {/* QR à esquerda */}
        <div style={{
          position: 'absolute', top: mm(13.5), left: mm(4),
          background: '#fff', padding: mm(1), borderRadius: mm(0.8),
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <QRCodeSVG
            value={qrPayload || nomeCompleto}
            size={mm(24)}
            bgColor="#ffffff"
            fgColor={COLORS.bordo}
            level="M"
          />
        </div>

        {/* Coluna de dados à direita */}
        <div style={{
          position: 'absolute', top: mm(13.5), left: mm(34), right: mm(4),
          fontFamily: 'Georgia, "Times New Roman", serif',
          color: COLORS.bordoDark,
          display: 'flex', flexDirection: 'column', gap: mm(1.4),
        }}>
          {[
            ['Nome', nomeCompleto || '—'],
            ['Registro', formatRegistro(registroId)],
            ['CPF', formatCpf(cpf)],
            ['Desde', formatMesAno(dataInicio)],
            ['Status', isAtivo ? 'Ativo' : (status || 'Inativo')],
          ].map(([k, v]) => (
            <div key={k} style={{ lineHeight: 1.1 }}>
              <div style={{
                fontFamily: 'Helvetica,Arial,sans-serif', fontWeight: 700,
                fontSize: pt(4.5), color: '#8a6a1f', letterSpacing: mm(0.03),
                textTransform: 'uppercase',
              }}>{k}</div>
              <div style={{
                fontSize: pt(7), fontWeight: 600, marginTop: mm(0.3),
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Rodapé */}
        <div style={{
          position: 'absolute', left: mm(4), right: mm(4), bottom: mm(4.5),
          textAlign: 'center', color: '#6e5018', fontSize: pt(5),
        }}>
          Escaneie para validar a autenticidade do dizimista.
        </div>
        <div style={{
          position: 'absolute', left: mm(4), right: mm(4), bottom: mm(2),
          textAlign: 'center', color: COLORS.bordoDark, fontStyle: 'italic',
          fontSize: pt(5.5),
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {nomeParoquia}{siteRodape ? ` · ${siteRodape}` : ''}
        </div>
      </div>
    );
  }

  // ─── Frente ───
  return (
    <div
      role="img"
      aria-label={`Carteirinha do dizimista ${nomeCompleto}, registro ${formatRegistro(registroId)}, ${status}`}
      style={{
        width, height,
        borderRadius: mm(2.5),
        background: `radial-gradient(circle at 20% 20%, #6b2222 0%, ${COLORS.bordo} 60%, ${COLORS.bordoDark} 100%)`,
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        position: 'relative',
        overflow: 'hidden',
        color: COLORS.marfim,
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      {/* padrão decorativo */}
      <svg
        width={width} height={height}
        style={{ position: 'absolute', inset: 0, opacity: 0.16, pointerEvents: 'none' }}
        viewBox={`0 0 ${CARD_W} ${CARD_H}`}
        preserveAspectRatio="none"
      >
        {[
          { cx: 10, cy: 14, rx: 3.2, ry: 2.4 },
          { cx: 70, cy: 38, rx: 4, ry: 2.6 },
          { cx: 80, cy: 22, rx: 2.3, ry: 1.5 },
        ].map((b, i) => <ellipse key={i} {...b} fill="#7a2828" />)}
      </svg>

      {/* borda dourada interna */}
      <div style={{
        position: 'absolute', inset: mm(1.2),
        border: `1px solid ${COLORS.ouro}`,
        borderRadius: mm(2),
        pointerEvents: 'none',
      }} />

      {/* Header: brasão + título + logo paróquia */}
      <div style={{
        position: 'absolute', top: mm(3.5), left: mm(4), right: mm(4),
        display: 'flex', alignItems: 'center', gap: mm(2),
        height: mm(9),
      }}>
        <img
          src={brasaoUrl}
          alt=""
          style={{ width: mm(9), height: mm(9), objectFit: 'contain', flexShrink: 0 }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
        <div style={{
          flex: 1, minWidth: 0,
          fontWeight: 700, color: COLORS.marfim,
          fontSize: pt(tituloFontPt),
          lineHeight: 1.1, letterSpacing: mm(0.04),
          textTransform: 'uppercase',
          textAlign: 'center',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {nomeParoquia}
        </div>
        {logoParoquiaUrl ? (
          <div style={{
            width: mm(9), height: mm(9), flexShrink: 0,
            background: '#fff',
            borderRadius: mm(1.2),
            border: `1px solid ${COLORS.ouro}99`,
            padding: mm(0.6),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img
              src={logoParoquiaUrl}
              alt=""
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        ) : (
          <div style={{ width: mm(9), height: mm(9), flexShrink: 0 }} />
        )}
      </div>

      {/* Foto */}
      <div style={{
        position: 'absolute', top: mm(14.5), left: mm(4),
        width: mm(22), height: mm(28),
        background: COLORS.ouro,
        borderRadius: mm(2),
        padding: mm(0.6),
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: mm(1.6),
          background: fotoUrl ? `url(${fotoUrl}) center/cover` : '#d5d0c0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: COLORS.bordoDark, fontWeight: 700, fontSize: pt(12),
        }}>
          {!fotoUrl && iniciais}
        </div>
        <div style={{
          position: 'absolute', bottom: mm(-1.2), right: mm(-1),
          width: mm(4.5), height: mm(4.5), borderRadius: '50%',
          background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }}>
          <Church style={{ width: mm(2.6), height: mm(2.6), color: COLORS.bordo }} />
        </div>
      </div>

      {/* Bloco de dados */}
      <div style={{
        position: 'absolute', top: mm(15), left: mm(30), right: mm(4),
      }}>
        <div style={{
          color: COLORS.ouro, fontFamily: 'Helvetica,Arial,sans-serif',
          fontWeight: 800, fontSize: pt(4.5), letterSpacing: mm(0.04),
        }}>NOME COMPLETO</div>
        <div style={{
          fontWeight: 700, fontSize: pt(9), marginTop: mm(0.6), lineHeight: 1.1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {nomeCompleto || '—'}
        </div>

        <div style={{
          marginTop: mm(2),
          height: 1, background: `${COLORS.ouro}66`,
        }} />

        <div style={{ display: 'flex', gap: mm(3), marginTop: mm(2) }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: COLORS.ouro, fontFamily: 'Helvetica,Arial,sans-serif', fontWeight: 800, fontSize: pt(4.5) }}>REGISTRO</div>
            <div style={{ fontSize: pt(7), marginTop: mm(0.4), whiteSpace: 'nowrap' }}>{formatRegistro(registroId)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: COLORS.ouro, fontFamily: 'Helvetica,Arial,sans-serif', fontWeight: 800, fontSize: pt(4.5) }}>DESDE</div>
            <div style={{ fontSize: pt(7), marginTop: mm(0.4), whiteSpace: 'nowrap' }}>{formatMesAno(dataInicio)}</div>
          </div>
        </div>
      </div>

      {/* Rodapé: paróquia + status pill */}
      <div style={{
        position: 'absolute', left: mm(4), right: mm(4), bottom: mm(3),
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: mm(2),
      }}>
        <div style={{
          color: `${COLORS.marfim}cc`, fontStyle: 'italic',
          fontSize: pt(5), fontFamily: 'Georgia, serif',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          flex: 1, minWidth: 0,
        }}>
          {nomeParoquia}
        </div>
        <div style={{
          flexShrink: 0,
          padding: `${mm(1)}px ${mm(2)}px`,
          borderRadius: mm(2),
          background: `linear-gradient(180deg, ${COLORS.ouroClaro} 0%, ${COLORS.ouro} 60%, #a8862e 100%)`,
          color: COLORS.bordoDark, fontWeight: 800,
          fontSize: pt(5.5), fontFamily: 'Helvetica,Arial,sans-serif',
          display: 'flex', alignItems: 'center', gap: mm(0.8),
          letterSpacing: mm(0.02),
        }}>
          <ShieldCheck style={{ width: mm(2.6), height: mm(2.6) }} />
          {statusTexto}
        </div>
      </div>
    </div>
  );
};

export default CarteirinhaCard;
