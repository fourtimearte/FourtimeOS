# banco/

Os arquivos .sql desta pasta sao a historia do banco no Supabase, na ordem em
que foram rodados. Cada um roda uma vez so, no SQL Editor do projeto.

Nunca edite um arquivo que ja rodou. Mudanca vira arquivo novo, com o numero
seguinte. O banco nao desfaz o que ja aconteceu, e um arquivo editado depois de
rodado mente sobre o que esta la dentro.

Projeto: fourtime-os, regiao South America (Sao Paulo).

## Antes de dar uma migracao por pronta

Rode `CONFERIR.sql` no SQL Editor. Ele acha objeto que existe mas que ninguem
consegue ler.

Isso nao e zelo exagerado: em 13/09/2026 um `drop view` levou junto o grant da
`meu_perfil`, o login passou a derrubar a pessoa meio segundo depois de
aceitar a senha, e a mensagem na tela falava de cadastro. Foram vinte minutos
com o dono trancado para fora do proprio sistema, procurando a senha que estava
certa. A conferencia leva tres segundos.

**Grant mora no objeto, nao na view.** Todo drop leva os grants junto, entao o
grant vai no mesmo arquivo do create, logo embaixo dele.

## Uma carga que falha desfaz a carga inteira

O SQL Editor roda tudo numa transacao so. Se o ultimo insert de um arquivo
esbarrar numa chave estrangeira, os primeiros somem junto, e a tela nao grita:
ela diz que rodou. Foi assim que a carga do banco do editor pareceu ter
funcionado com as tabelas vazias.

Depois de carregar dados, conte as linhas. Nunca confie no "Success".

## A regra do corpo da cotacao (011)

A cotacao inteira mora numa coluna `jsonb` chamada `corpo`, e nao espalhada em
cinco tabelas. O motivo esta escrito dentro do proprio 011: o documento ja tem
uma escada de migracao, a do `.cft`, e espalhar ele no banco criaria uma
segunda escada que teria que andar junto com a primeira para sempre.

Do lado do aplicativo isso vira UMA regra, e ela nao pode ser esquecida:

**A lista de cotacoes NUNCA pede a coluna `corpo`.** Dentro dela vao as imagens
dos layouts. Uma lista de sessenta cotacoes pedindo o corpo baixa dezenas de
megabytes para mostrar sessenta linhas de texto.

Para isso existe a view `cotacao_na_lista`, que nao tem a coluna. Use ela.

## A view `equipe`

`public.equipe` e a unica view do banco sem `security_invoker`, ou seja, a
unica que passa por cima da regra de acesso da tabela por baixo. E de
proposito, e esta explicado no 011: o funil precisa escrever o nome do vendedor
no cartao, e a tabela `pessoa` so deixa cada um ler o proprio cadastro porque e
ali que mora email e foto.

Ela expoe quatro colunas: id, nome, papel, ativo. Se um dia alguem for
acrescentar coluna nela, pense duas vezes.
