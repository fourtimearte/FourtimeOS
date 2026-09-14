-- ============================================================
-- Fourtime OS - 016 o que a lista de cotacoes precisa ver
-- ============================================================
-- A regra do 011 continua valendo: a lista NUNCA pede a coluna corpo, porque
-- dentro dela vao as imagens dos layouts. O que a lista precisa tem que estar
-- fora do corpo, em coluna.
--
-- Faltavam duas coisas, e as duas sao coisas que a pessoa PROCURA:
--
--   a cidade do cliente, porque quem procura "Rio Verde" na lista de cotacoes
--   esta procurando pela cidade, e nao pelo nome
--
--   o nome do vendedor, que hoje so existe dentro do documento
--
-- O nome do vendedor vai como COPIA, e nao como join com a tabela pessoa. E o
-- mesmo motivo do pedido: o vendedor pode sair da empresa, e a cotacao dele
-- continua sabendo de quem foi. E tem um motivo a mais aqui: a tabela pessoa
-- so deixa cada um ler o proprio cadastro, entao um join faria o nome do
-- colega aparecer em branco para todo mundo que nao e administrador.

alter table public.cotacao
  add column cliente_cidade text not null default '',
  add column cliente_uf     text not null default '',
  add column vendedor_nome  text not null default '';

-- Preenche o que ja existe a partir do proprio documento. Hoje sao zero linhas;
-- fica escrito assim mesmo porque um arquivo de migracao que so funciona em
-- banco vazio e uma armadilha para quem rodar a serie inteira daqui a seis
-- meses num banco restaurado.
update public.cotacao
   set cliente_cidade = coalesce(corpo -> 'cliente' ->> 'cidade', ''),
       cliente_uf     = coalesce(corpo -> 'cliente' ->> 'uf', ''),
       vendedor_nome  = coalesce(corpo ->> 'vendedor', '')
 where cliente_cidade = '' and vendedor_nome = '';

create index cotacao_por_cidade on public.cotacao (cliente_cidade)
  where cliente_cidade <> '';

-- A view precisa ser refeita, e nao trocada: create or replace so aceita
-- acrescentar coluna no FIM, e estas tres pertencem ao meio.
--
-- E o drop leva o grant junto. Foi assim que em 13/09 o login passou a derrubar
-- o dono meio segundo depois de aceitar a senha. Por isso o grant vem logo
-- embaixo do create, no mesmo arquivo, sempre.
drop view if exists public.cotacao_na_lista;

create view public.cotacao_na_lista
with (security_invoker = true) as
select c.id, c.numero,
       c.cliente_id, c.cliente_nome, c.cliente_cidade, c.cliente_uf,
       c.lead_id, c.estado,
       c.vendedor_id, c.vendedor_nome,
       c.total, c.pecas, c.valida_ate, c.teste,
       c.versao_do_formato, c.criada_em, c.atualizado_em,
       p.numero as pedido_numero
  from public.cotacao c
  left join public.pedido p on p.cotacao_id = c.id;

grant select on public.cotacao_na_lista to authenticated;
