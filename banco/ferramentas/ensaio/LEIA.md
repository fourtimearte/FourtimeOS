# O ensaio

Roda as migracoes num Postgres de mentira, aqui dentro, antes de qualquer coisa
ser colada no SQL Editor do Supabase.

Nasceu em 14/09/2026, e nasceu ganhando: na primeira vez que rodou, ele parou o
011 na linha errada e mostrou que o arquivo inteiro estava escrito para papeis
que nao existem mais. O 011 falava em `dono` e em `pessoa.ativo`; a migracao
003 tinha trocado os dois por `admin` e `pessoa.situacao` meses antes. Colado
direto no Supabase, isso teria sido uma migracao pela metade num banco de
verdade, com tabela criada e policy faltando.

Nao substitui o Supabase: nao tem Storage, nem `auth.users` de verdade, nem o
PostgREST. Serve para o que quebra mais: **sintaxe, coluna que nao existe,
policy, grant e a conta que a funcao faz**.

## Rodar

```
bash banco/ferramentas/ensaio/rodar.sh
```

Ele derruba a base de teste, sobe da 001 ate a ultima, roda o `CONFERIR.sql` e
depois os dois ensaios. Qualquer `ERROR` na saida e o motivo de nao colar nada
no Supabase ainda.

## O que cada ensaio prova

**01-o-caminho-inteiro**: o telefone conhecido volta para a dona da carteira; o
telefone novo entra no rodizio um de cada vez; o mesmo telefone nao cria dois
leads; o lead vira cliente sem duplicar o cliente que ja existe; a cotacao tira
numero do ano; a aprovacao gera pedido, congela o percentual e fecha o lead; e
a comissao sai certa no relatorio.

**02-as-regras-de-acesso**: o mesmo banco visto por quatro pessoas diferentes.
O vendedor le o funil e cria cotacao, mas nao ve o percentual do colega, nao
transfere lead e nao apaga pedido. A producao le tudo e anda com o pedido, mas
nao cria cotacao. O admin transfere, e a transferencia fica registrada.

Essa segunda parte so vale rodando com `set role authenticated`. Como
`postgres`, o Postgres passa por cima de toda regra de acesso, e o ensaio
diria que esta tudo certo mesmo com as policies todas erradas.
