#!/bin/sh
# A conferencia do desenho do deposito que nao precisa de navegador: o texto
# que cabe na forma (quebra de linha e tamanho de letra) e os dois campos do
# palete, a referencia e o nome. So dominio, roda em node puro.
set -e
raiz="$(dirname "$0")/.."
saida="$raiz/testes/compilado-planta"
rm -rf "$saida"
tsc -p "$raiz/testes/tsconfig-planta.json"
# node exige a extensao no import; o tsc nao a escreve
find "$saida" -name '*.js' -exec sed -i "s|from '\(\.\.\{0,1\}/[a-zA-Z0-9/._-]*\)'|from '\1.js'|g" {} +
echo '{"type":"module"}' > "$saida/package.json"
node "$raiz/testes/planta.mjs"
