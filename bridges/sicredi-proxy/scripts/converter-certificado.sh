#!/usr/bin/env bash
# Converte o certificado .pfx/.p12 entregue pelo Sicredi em dois arquivos PEM
# (certificado + chave privada SEM senha), no formato aceito pelo Cloudflare.
#
# Uso:  ./scripts/converter-certificado.sh caminho/para/sicredi.pfx
set -euo pipefail

PFX="${1:-}"
if [[ -z "$PFX" || ! -f "$PFX" ]]; then
  echo "Uso: $0 <arquivo.pfx>" >&2
  exit 1
fi

OUT_DIR="$(dirname "$PFX")"
CERT="$OUT_DIR/sicredi-cert.pem"
KEY="$OUT_DIR/sicredi-key.pem"

echo "→ Extraindo certificado público..."
openssl pkcs12 -in "$PFX" -clcerts -nokeys -out "$CERT" -legacy 2>/dev/null \
  || openssl pkcs12 -in "$PFX" -clcerts -nokeys -out "$CERT"

echo "→ Extraindo chave privada (sem senha)..."
openssl pkcs12 -in "$PFX" -nocerts -nodes -out "$KEY" -legacy 2>/dev/null \
  || openssl pkcs12 -in "$PFX" -nocerts -nodes -out "$KEY"

chmod 600 "$CERT" "$KEY"

echo
echo "✅ Gerados:"
echo "   $CERT"
echo "   $KEY"
echo
echo "⚠️  NUNCA comite esses arquivos. Cole o conteúdo deles no Cloudflare:"
echo "   Dashboard → SSL/TLS → Client Certificates → mTLS Certificates → Upload"
