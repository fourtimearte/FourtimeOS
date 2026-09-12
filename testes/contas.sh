#!/bin/sh
# Compila so as pecas de dominio que o teste usa e roda a conferencia.
# Elas nao dependem de React nem do navegador, entao rodam em node puro.
set -e
raiz="$(dirname "$0")/.."
saida="$raiz/testes/compilado"
rm -rf "$saida"
tsc --ignoreConfig \
  "$raiz/src/dominio/layout/grade.ts" \
  "$raiz/src/dominio/layout/bloco.ts" \
  "$raiz/src/dominio/cotacao/tipos.ts" \
  "$raiz/src/dominio/cotacao/arquivo.ts" \
  --target ES2022 --module ESNext --moduleResolution bundler \
  --lib ES2022,DOM --skipLibCheck --outDir "$saida"
# node exige a extensao no import; o tsc nao a escreve
find "$saida" -name '*.js' -exec sed -i "s|from '\(\.\.\{0,1\}/[a-z/]*\)'|from '\1.js'|g" {} +
echo '{"type":"module"}' > "$saida/package.json"
node "$raiz/testes/contas.mjs"
