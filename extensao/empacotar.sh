#!/bin/sh
# O pacote da extensao, pronto para "Carregar sem compactacao" no Chrome ou
# para subir na Chrome Web Store.
#
# O config.js nasce aqui, do ambiente: VITE_SUPABASE_URL e
# VITE_SUPABASE_ANON_KEY (a chave PUBLICAVEL, a mesma que o sistema entrega a
# qualquer navegador). Ele nao vai para o repositorio.
#
# Uso:  VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... sh extensao/empacotar.sh
#
# Com LOJA=1, o pacote da Chrome Web Store (extensao/loja/LEIA.md): o
# manifest.json na raiz do zip (a loja pede assim) e sem os enderecos de teste
# (127.0.0.1 e localhost), que so servem no computador de quem desenvolve.
set -eu
cd "$(dirname "$0")/.."

: "${VITE_SUPABASE_URL:?falta VITE_SUPABASE_URL}"
: "${VITE_SUPABASE_ANON_KEY:?falta VITE_SUPABASE_ANON_KEY}"
case "$VITE_SUPABASE_ANON_KEY" in
  *service_role*|sb_secret_*) echo "isso nao e a chave publicavel" >&2; exit 1 ;;
esac

VERSAO=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' extensao/manifest.json)
PASTA="dist-extensao/fourtime-os-$VERSAO"
[ "${LOJA:-}" = 1 ] && PASTA="dist-extensao/loja-$VERSAO"
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
if [ "${LOJA:-}" = 1 ]; then
  node -e '
    const fs = require("fs"); const f = process.argv[1]
    const m = JSON.parse(fs.readFileSync(f, "utf8"))
    const deTeste = (u) => /127\.0\.0\.1|localhost/.test(u)
    m.host_permissions = m.host_permissions.filter((u) => !deTeste(u))
    for (const c of m.content_scripts) c.matches = c.matches.filter((u) => !deTeste(u))
    fs.writeFileSync(f, JSON.stringify(m, null, 2) + "\n")
  ' "$PASTA/manifest.json"
  rm -f "dist-extensao/fourtime-os-$VERSAO-loja.zip"
  (cd "$PASTA" && zip -qr "../fourtime-os-$VERSAO-loja.zip" .)
  rm -rf "$PASTA"
  echo "dist-extensao/fourtime-os-$VERSAO-loja.zip"
  exit 0
fi
# A CONFERENCIA (0.6.0): versao.json com a impressao SHA-256 de cada arquivo
# de codigo do pacote (.js, .css, .html, .json; a imagem fica de fora). Quem grava numa pasta (a D:\ ou a do Google Drive) grava este
# arquivo POR ULTIMO; a extensao so recarrega quando todos os da lista ja
# chegaram com a impressao certa (fundo.js, procurarVersaoNova).
node -e '
  const fs = require("fs"), path = require("path"), crypto = require("crypto")
  const pasta = process.argv[1], versao = process.argv[2]
  const arquivos = {}
  for (const nome of fs.readdirSync(pasta).sort()) {
    if (nome === "versao.json" || fs.statSync(path.join(pasta, nome)).isDirectory()) continue
    /* so o que e codigo e regra: a imagem nao muda o que a extensao faz, e a
       copia para a pasta pode regravar o PNG (visto em 13/10/2026: 710 bytes
       viraram 6480), o que travaria a conferencia para sempre */
    if (!/\.(js|css|html|json)$/.test(nome)) continue
    arquivos[nome] = crypto.createHash("sha256").update(fs.readFileSync(path.join(pasta, nome))).digest("hex")
  }
  fs.writeFileSync(path.join(pasta, "versao.json"), JSON.stringify({ versao, arquivos }, null, 2) + "\n")
' "$PASTA" "$VERSAO"
(cd dist-extensao && zip -qr "fourtime-os-$VERSAO.zip" "fourtime-os-$VERSAO")
echo "$PASTA.zip"
