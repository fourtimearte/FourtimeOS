#!/bin/sh
# A conferencia das contas da ficha tecnica: a grade, o codigo, a area do
# tecido e o rascunho que vira ficha. So dominio, roda em node puro.
set -e
raiz="$(dirname "$0")/.."
saida="$raiz/testes/compilado-produto"
rm -rf "$saida"
tsc -p "$raiz/testes/tsconfig-produto.json"
# node exige a extensao no import; o tsc nao a escreve
find "$saida" -name '*.js' -exec sed -i "s|from '\(\.\.\{0,1\}/[a-zA-Z0-9/._-]*\)'|from '\1.js'|g" {} +
echo '{"type":"module"}' > "$saida/package.json"
node "$raiz/testes/produto.mjs"
