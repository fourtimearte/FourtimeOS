#!/bin/sh
# A conferencia das contas do Verificador de Boleto: a linha digitavel, o
# CNPJ e a leitura do texto do PDF. So dominio, roda em node puro.
set -e
raiz="$(dirname "$0")/.."
saida="$raiz/testes/compilado-boleto"
rm -rf "$saida"
tsc -p "$raiz/testes/tsconfig-boleto.json"
# node exige a extensao no import; o tsc nao a escreve
find "$saida" -name '*.js' -exec sed -i "s|from '\(\.\.\{0,1\}/[a-zA-Z0-9/._-]*\)'|from '\1.js'|g" {} +
echo '{"type":"module"}' > "$saida/package.json"
node "$raiz/testes/boleto.mjs"
