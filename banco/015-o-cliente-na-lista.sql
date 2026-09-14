-- ============================================================
-- Fourtime OS - 015 o cliente na lista
-- ============================================================
-- A tela de clientes mostra, por cliente: quantos pedidos ja fez, quanto ja
-- comprou e quando foi a ultima vez. Nenhum dos tres e coluna de cliente, e
-- nenhum dos tres pode virar uma conta que cada tela refaz do seu jeito.
--
-- E eles vem de DOIS lugares somados, que e o detalhe que decide o desenho:
--
--   o que a Fourtime vendeu ANTES deste sistema existir, que veio do Bling e
--   nao tem pedido nenhum aqui dentro para contar
--
--   o que este sistema fechou, que esta na tabela pedido
--
-- Sem o primeiro, no dia seguinte a importacao todo cliente de dez anos de casa
-- apareceria com zero pedidos e zero comprado. Seria o sistema novo dizendo que
-- a historia da empresa nao aconteceu.

alter table public.cliente
  add column pedidos_antigos int not null default 0,
  add column total_antigo numeric(12,2) not null default 0,
  add column ultimo_pedido_antigo date;

comment on column public.cliente.pedidos_antigos is
  'Quantos pedidos o cliente fez ANTES do Fourtime OS. Vem do Bling na '
  'importacao e nao se mexe depois: pedido novo entra na tabela pedido.';


-- A lista da tela, com as tres contas ja feitas.
--
-- As colunas vao escritas uma a uma em vez de c.*, de proposito: uma view com
-- estrela congela a lista de colunas no dia em que foi criada, e a coluna que
-- alguem acrescentar em cliente amanha simplesmente nao aparece aqui, sem
-- nenhum aviso. Escrito a mao, quem acrescentar a coluna ve esta lista e
-- lembra de decidir se ela entra.
create view public.cliente_na_lista
with (security_invoker = true) as
select c.id, c.nome, c.fantasia, c.tipo, c.documento, c.contato,
       c.telefone, c.celular, c.email,
       c.endereco, c.complemento, c.bairro, c.cidade, c.uf, c.cep,
       c.tipo_de_contato, c.segmento, c.vendedor, c.vendedor_id,
       c.teste, c.criado_em, c.atualizado_em,
       c.pedidos_antigos, c.total_antigo, c.ultimo_pedido_antigo,
       c.pedidos_antigos + coalesce(p.quantos, 0) as pedidos,
       c.total_antigo    + coalesce(p.soma, 0)    as total,
       /* o mais recente dos dois, e vazio quando nunca comprou */
       coalesce(
         to_char(greatest(
           c.ultimo_pedido_antigo,
           (p.ultimo at time zone 'America/Sao_Paulo')::date
         ), 'YYYY-MM-DD'),
         ''
       ) as ultimo_pedido
  from public.cliente c
  left join lateral (
    select count(*) as quantos, sum(x.total) as soma, max(x.aprovado_em) as ultimo
      from public.pedido x
     where x.cliente_id = c.id and x.estado <> 'cancelado'
  ) p on true;

grant select on public.cliente_na_lista to authenticated;
