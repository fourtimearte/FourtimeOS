#!/bin/sh
# Compila so as pecas de dominio que o teste usa e roda a conferencia.
# Elas nao dependem de React nem do navegador, entao rodam em node puro.
set -e
# O TypeScript 6 pede --ignoreConfig quando os arquivos vem na linha de
# comando; o 5.9 do node_modules nao conhece a opcao (e nem precisa dela).
IGNORAR=""
tsc --help --all 2>/dev/null | grep -q ignoreConfig && IGNORAR="--ignoreConfig"
raiz="$(dirname "$0")/.."
saida="$raiz/testes/compilado"
rm -rf "$saida"
tsc $IGNORAR \
  "$raiz/src/dominio/layout/grade.ts" \
  "$raiz/src/dominio/layout/bloco.ts" \
  "$raiz/src/dominio/layout/destaques.ts" \
  "$raiz/src/dominio/layout/etiqueta.ts" \
  "$raiz/src/dominio/cotacao/tipos.ts" \
  "$raiz/src/dominio/cotacao/arquivo.ts" \
  "$raiz/src/dominio/cotacao/fabrica.ts" \
  "$raiz/src/dominio/cotacao/comercial.ts" \
  "$raiz/src/dominio/producao/comparacao.ts" \
  "$raiz/src/dominio/producao/caminho.ts" \
  "$raiz/src/dominio/preco/tipos.ts" \
  "$raiz/src/dominio/cotacao/tabela-de-preco.ts" \
  --target ES2022 --module ESNext --moduleResolution bundler \
  --lib ES2022,DOM --skipLibCheck --outDir "$saida"
# node exige a extensao no import; o tsc nao a escreve
find "$saida" -name '*.js' -exec sed -i "s|from '\(\.\.\{0,1\}/[a-z/]*\)'|from '\1.js'|g" {} +
echo '{"type":"module"}' > "$saida/package.json"
node "$raiz/testes/contas.mjs"
node "$raiz/testes/precos.mjs"
