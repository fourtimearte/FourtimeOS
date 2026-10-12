#!/bin/sh
# A conferencia da virada de semana do painel de atividades.
# So dominio: nao depende de React nem de navegador, roda em node puro.
set -e
raiz="$(dirname "$0")/.."
saida="$raiz/testes/compilado-semana"
rm -rf "$saida"
# o 5.9 do node_modules recusa ignoreDeprecations "6.0" (ver testes/tipos.sh)
config="$raiz/testes/tsconfig-semana.json"
case "$(tsc -v)" in
  *" 5."*) sed '/ignoreDeprecations/d' "$config" > "$raiz/testes/tsconfig-semana-5.json"; config="$raiz/testes/tsconfig-semana-5.json" ;;
esac
tsc -p "$config"
rm -f "$raiz/testes/tsconfig-semana-5.json"
# node exige a extensao no import; o tsc nao a escreve
find "$saida" -name '*.js' -exec sed -i "s|from '\(\.\.\{0,1\}/[a-zA-Z0-9/._-]*\)'|from '\1.js'|g" {} +
echo '{"type":"module"}' > "$saida/package.json"
node "$raiz/testes/semana.mjs"
