#!/bin/sh
# Compila o modulo do Supabase e roda a conferencia do cracha.
# Ele nao depende de React nem do navegador, entao roda em node puro.
set -e
raiz="$(dirname "$0")/.."
saida="$raiz/testes/compilado-sessao"
rm -rf "$saida"
tsc --ignoreConfig \
  "$raiz/src/ambiente.d.ts" \
  "$raiz/src/shared/supabase/index.ts" \
  --target ES2022 --module ESNext --moduleResolution bundler \
  --lib ES2022,DOM,DOM.Iterable --strict \
  --noUnusedLocals --noUnusedParameters --erasableSyntaxOnly \
  --noFallthroughCasesInSwitch --verbatimModuleSyntax \
  --rootDir "$raiz/src" --outDir "$saida"
# node exige a extensao no import; o tsc nao a escreve
find "$saida" -name '*.js' -exec sed -i "s|from '\(\.\.\{0,1\}/[a-z/]*\)'|from '\1.js'|g" {} +
# em node nao existe import.meta.env: quem entrega as duas variaveis e o Vite
find "$saida" -name 'config.js' -exec sed -i 's|import\.meta\.env|globalThis.__env|g' {} +
echo '{"type":"module"}' > "$saida/package.json"
node "$raiz/testes/sessao.mjs"
