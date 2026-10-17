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

## banco/ferramentas/prova-da-tag.sql

A conferencia da regra da tag do pedido, da 024. Roda no SQL Editor quantas
vezes quiser: ela termina levantando um erro de proposito, e por isso tudo que
fez e desfeito. O relatorio sai dentro da mensagem de erro, uma linha por caso.

**O teste mora em SQL porque a regra mora em SQL.** Ela e um gatilho, e precisa
valer para o arrastar do kanban, para um PATCH direto e para o ensaio.
Reescrever a mesma regra em TypeScript so para poder testa-la seria a mesma
regra em duas linguagens, que e exatamente o que o resto deste banco evita.

Ele ja se pagou na primeira rodada, acusando duas falhas que eram MINHAS, e nao
do banco:

- eu esperava que a tag de "subli em costura e dtf em cd-costura" fosse
  `costura`, olhando o nome do posto. E `cd-costura`: faltam tres postos para o
  dtf e dois para a subli, entao o dtf e quem esta mais atrasado. "Mais
  atrasado" se conta, nao se adivinha pelo nome.
- eu apontei a data passada numa fatia so e esperei que o pedido fechasse nela.
  O pedido fecha na data da ULTIMA a terminar, que e um `max`, e a outra fatia
  ainda estava com `now()`. O teste agora aponta as duas no passado, que e o
  caso que ele existe para provar.

Fingir uma sessao e legitimo e esta no arquivo: `set_config('request.jwt.claims',
...)` faz `auth.uid()` devolver a pessoa escolhida, e sem isso as travas de
papel nao valem no SQL Editor e o teste passaria por engano.

## A auditoria e o cruzamento (17/10/2026)

Três conferências cuidam do banco, e as três rodam sem tocar na produção:

- `npm run banco` sobe o banco inteiro pelas migrações no ensaio, tira o
  retrato dele (`banco/ferramentas/catalogo.sql`) e confere segurança (RLS,
  regras, grants, views que passam por cima da RLS, funções DEFINER que quem
  não entrou chama), integridade (chave primária, chave estrangeira sem
  índice) e desempenho (índice repetido, regra que chama função por linha,
  view que abre o corpo da cotação). Grava o retrato enxuto em
  `banco/retrato.json`. **Rodar depois de toda migração nova.**
- `npm run cruzamento` (faz parte do `npm run conferir`) lê o código com o
  compilador do TypeScript, acha cada conversa com o banco (tabela, view,
  coluna, filtro, ordem, função e os NOMES dos argumentos) e confere contra o
  retrato. Coluna que o código pede e o banco não tem reprova aqui, antes de
  virar um 400 na cara de quem está usando. Reprova também quando o retrato
  está velho (migração nova sem `npm run banco`).
- `node testes/banco.mjs --comparar producao.json` compara o retrato da
  produção com o das migrações. O retrato da produção sai do mesmo
  `catalogo.sql`, rodado no SQL Editor (ele só lê).

As duas conferências provam a si mesmas antes de rodar: um banco e um código
de mentira com um defeito de cada tipo, que têm de acusar, e um certo, que
tem de ficar calado.

## A porta das funções (084)

Toda função do schema public vira `/rest/v1/rpc/<nome>` para quem tem a chave
pública do site. Desde a 084, função nova nasce fechada para quem não entrou
(default privileges): só `authenticated` e a chave de serviço chamam. Abrir
para fora é uma linha escrita na migração, com o motivo. Hoje só duas são de
fora: `painel_do_parceiro` (a página do parceiro) e
`erros_da_extensao_para_o_vigia` (o vigia agendado).

Função DEFINER que muda dado confere quem chamou lá dentro (`posso`,
`posso_a_acao`, `sou_admin`, `auth.uid()`), mesmo fechada: `authenticated`
inclui quem ainda espera aprovação.
