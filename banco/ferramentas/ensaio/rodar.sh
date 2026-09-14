#!/usr/bin/env bash
# Sobe um Postgres de mentira e roda as migracoes nele. Ver LEIA.md ao lado.
set -e
cd "$(dirname "$0")/../../.."
BIN=${PGBIN:-/usr/lib/postgresql/16/bin}
DIR=${PGDATA_ENSAIO:-/tmp/pgtest}
PORTA=${PGPORTA:-5439}
AQUI=banco/ferramentas/ensaio

if ! pg_isready -h /tmp -p "$PORTA" >/dev/null 2>&1; then
  rm -rf "$DIR"; mkdir -p "$DIR"; chown -R postgres "$DIR"; chmod 700 "$DIR"
  su postgres -c "$BIN/initdb -D $DIR -U postgres --auth=trust" >/dev/null
  su postgres -c "$BIN/pg_ctl -D $DIR -o '-p $PORTA -k /tmp' -l /tmp/pg.log start" >/dev/null
  sleep 2
fi

P="psql -h /tmp -p $PORTA -U postgres"
$P -q -c "drop database if exists ft;" -c "create database ft;"
$P -d ft -q -v ON_ERROR_STOP=1 -f "$AQUI/00-o-que-o-supabase-poe.sql"

for f in banco/[0-9][0-9][0-9]-*.sql; do
  printf '%-38s ' "$f"
  if $P -d ft -q -v ON_ERROR_STOP=1 -f "$f" 2>/tmp/erro.txt; then echo ok
  else echo "FALHOU"; cat /tmp/erro.txt; exit 1; fi
done

echo; echo "== CONFERIR (o esperado e 0 rows) =="
$P -d ft -f banco/CONFERIR.sql | tail -3
echo; echo "== 01 o caminho inteiro =="
$P -d ft -f "$AQUI/01-o-caminho-inteiro.sql"
echo; echo "== 02 as regras de acesso =="
$P -d ft -f "$AQUI/02-as-regras-de-acesso.sql"
