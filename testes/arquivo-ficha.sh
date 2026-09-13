#!/bin/sh
# A conferencia do arquivo da ficha: salvar, abrir de volta, e ler um .ft da
# v3.375. So dominio, sem React nem navegador, entao roda em node puro.
#
# O tsc daqui compila a arvore inteira que o arquivo toca, e nessa arvore
# entra o kit do Design System, que e TSX. Sem node_modules neste ambiente os
# tipos do React nao existem e o TSX reclama - ruido que nao diz nada sobre o
# que esta sendo conferido. Por isso o erro do tsc nao derruba o teste
# sozinho: derruba quando o erro esta num arquivo de DOMINIO, que e o que
# importa aqui. O tsc -b do build continua conferindo o resto.
set -e
raiz="$(dirname "$0")/.."
saida="$raiz/testes/compilado-ficha"
rm -rf "$saida"
relato="$saida-erros.txt"
tsc -p "$raiz/testes/tsconfig-ficha.json" > "$relato" 2>&1 || true
# so o que nao e TSX: um .ts de dominio nao tem React dentro, entao erro ali
# e erro de verdade
if grep -E 'src/(dominio|ds/kit)/[a-zA-Z0-9/._-]+\.ts\(' "$relato"; then
  echo 'erro de tipo fora do TSX: conserte antes de seguir'
  exit 1
fi
rm -f "$relato"
# node exige a extensao no import, e o apelido do ds nao existe fora do bundler
# a extensao entra primeiro, e so depois o apelido vira caminho: na ordem
# inversa o sed escreveria a extensao duas vezes no que ele mesmo acabou de
# reescrever
find "$saida" -name '*.js' -exec sed -i \
  -e "s|from '\(\.\.\{0,1\}/[a-zA-Z0-9/._-]*\)'|from '\1.js'|g" \
  -e "s|from '@ds/kit/banco-de-exemplo'|from '../../ds/kit/banco-de-exemplo.js'|g" {} +
echo '{"type":"module"}' > "$saida/package.json"
node "$raiz/testes/arquivo-ficha.mjs"
