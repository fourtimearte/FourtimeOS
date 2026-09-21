-- ============================================================
-- Fourtime OS - 021 separacao e pcp no estado do pedido
-- ============================================================
-- ESTE ARQUIVO RODA SOZINHO. O 022 vem depois, noutra rodada do SQL Editor.
--
-- O motivo e uma regra do Postgres: valor novo de enum nao pode ser USADO na
-- mesma transacao em que foi criado. O SQL Editor roda o arquivo inteiro numa
-- transacao so, como o LEIA desta pasta avisa. Juntar os dois daria "unsafe
-- use of new value of enum type" e a migracao inteira voltaria atras, com a
-- tela dizendo que rodou.
--
-- O CAMINHO NOVO, decidido em 21/09:
--
--   funil -> cotacao -> PEDIDO -> separacao -> PCP -> kanban
--
-- separacao e quem descobre a verdade sobre o estoque. PCP e quem decide o que
-- fazer com o que faltou, e e o PORTAO: o pedido aparece no chao de fabrica
-- porque o PCP liberou, e nao porque alguem aprovou a venda.
--
-- A ORDEM DENTRO DO ENUM IMPORTA, e e por isso que os dois entram ANTES de
-- producao em vez de no fim da lista. Enum do Postgres compara pela ordem de
-- declaracao, entao um "estado >= 'producao'" escrito amanha leria certo. No
-- fim da lista, separacao viria depois de entregue, que e o contrario da vida.

alter type public.estado_do_pedido add value if not exists 'separacao' before 'producao';
alter type public.estado_do_pedido add value if not exists 'pcp'       before 'producao';
