#!/bin/sh
# A MESMA conferencia de tipo que o build do Cloudflare faz, com as mesmas
# travas: strict, noUnusedLocals, noUnusedParameters, verbatimModuleSyntax.
#
# Ela existe porque `npm install` nao roda neste ambiente. Sem ela, o unico
# lugar onde um erro de tipo aparece e a publicacao, quinze minutos depois,
# sem ninguem olhando. Foi o que aconteceu em 21/09: duas publicacoes
# quebradas seguidas por um nome repetido que a conferencia antiga escondia.
#
# O QUE E DESCARTADO, E POR QUE SO ISTO. Sem os tipos do React instalados, o
# parametro de um `onClick={(e) => ...}` num elemento do navegador fica sem
# tipo de contexto e vira TS7006. E ruido de ambiente, e nao do codigo.
#
# Mas ele e descartado SO EM .tsx. Um .ts de dominio ou de shared nao tem JSX
# nem React dentro: parametro sem tipo ali e erro de verdade, e derruba.
set -e
raiz="$(dirname "$0")/.."
relato="$raiz/testes/tipos-erros.txt"
tsc -p "$raiz/testes/tsconfig-tipos.json" > "$relato" 2>&1 || true

# tudo que nao for TS7006 dentro de um .tsx
restantes=$(grep -E 'error TS' "$relato" | grep -v -E '\.tsx\([0-9]+,[0-9]+\): error TS7006' || true)
descartados=$(grep -cE '\.tsx\([0-9]+,[0-9]+\): error TS7006' "$relato" || true)

if [ -n "$restantes" ]; then
  echo "$restantes"
  echo ''
  echo "erro de tipo: conserte antes de empurrar, senao a publicacao quebra"
  exit 1
fi
rm -f "$relato"
echo "tipos ok ($descartados TS7006 de contexto de JSX descartados, ver testes/tipos.sh)"
