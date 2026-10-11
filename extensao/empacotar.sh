#!/bin/sh
# O pacote da extensao, pronto para "Carregar sem compactacao" no Chrome ou
# para subir na Chrome Web Store.
#
# O config.js nasce aqui, do ambiente: VITE_SUPABASE_URL e
# VITE_SUPABASE_ANON_KEY (a chave PUBLICAVEL, a mesma que o sistema entrega a
# qualquer navegador). Ele nao vai para o repositorio.
#
# Uso:  VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... sh extensao/empacotar.sh
set -eu
cd "$(dirname "$0")/.."

: "${VITE_SUPABASE_URL:?falta VITE_SUPABASE_URL}"
: "${VITE_SUPABASE_ANON_KEY:?falta VITE_SUPABASE_ANON_KEY}"
case "$VITE_SUPABASE_ANON_KEY" in
  *service_role*|sb_secret_*) echo "isso nao e a chave publicavel" >&2; exit 1 ;;
esac

VERSAO=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' extensao/manifest.json)
PASTA="dist-extensao/fourtime-os-$VERSAO"
rm -rf "$PASTA" "$PASTA.zip"
mkdir -p "$PASTA"
cp extensao/manifest.json extensao/regras.json extensao/*.js extensao/*.css extensao/*.html extensao/icone.png "$PASTA"/
rm -f "$PASTA/config.exemplo.js" "$PASTA/config.js"
cat > "$PASTA/config.js" <<EOF
self.FOURTIME = {
  supabase: '$VITE_SUPABASE_URL',
  chave: '$VITE_SUPABASE_ANON_KEY',
  sistema: 'https://fourtimeos.arte-adc.workers.dev',
}
EOF
(cd dist-extensao && zip -qr "fourtime-os-$VERSAO.zip" "fourtime-os-$VERSAO")
echo "$PASTA.zip"
