-- ============================================================
-- Fourtime OS - 018 o quanto sai, o de quem fica
-- ============================================================
-- Decisao do Henrique, 14/09/2026:
--
--   "quanto de comissao, ou porcentagem, nao estara no aplicativo, isso e para
--    gerencia fora do aplicativo saber, o aplicativo so deve ter a separacao
--    correta de o que cada um fez"
--
-- Ela muda o desenho, e nao so a tela. O 011 tinha posto o percentual dentro do
-- sistema e congelado ele no pedido; isso sai inteiro.
--
-- O QUE SAI: comissao_do_vendedor, pedido.comissao_pct, e as duas views que
-- faziam conta de dinheiro de comissao.
--
-- O QUE FICA, E ERA O QUE IMPORTAVA DESDE O COMECO: a corrente que diz de quem
-- e cada venda.
--
--   lead.vendedor_id -> cotacao.vendedor_id -> pedido.vendedor_id
--
-- Ela continua inteira, e continua congelando o vendedor no pedido: o vendedor
-- pode sair da empresa e o pedido continua sabendo de quem foi. O que o pedido
-- deixa de guardar e quanto isso valia em dinheiro para ele.
--
-- POR QUE TIRAR EM VEZ DE SO NAO MOSTRAR. Uma coluna de percentual que fica no
-- banco sem tela e uma coluna que um dia alguem preenche, e a partir dali o
-- sistema tem um numero sobre o pagamento de uma pessoa que ninguem sabe se
-- esta certo, que ninguem mantem, e que aparece em qualquer consulta que peca
-- a tabela inteira. Dado que nao e para existir some; nao fica escondido.

drop view if exists public.comissao_por_mes;
drop view if exists public.comissao_por_pedido;

alter table public.pedido drop column if exists comissao_pct;

drop table if exists public.comissao_do_vendedor;

-- A aprovacao para de ler o percentual. O resto e igual ao 013: numero do
-- pedido, linha criada, cotacao aprovada, lead fechado, e o VENDEDOR copiado.
create or replace function public.aprovar_cotacao(
  p_cotacao uuid, p_versao int default 1
) returns public.pedido
language plpgsql
security definer
set search_path = public
as $$
declare
  c    public.cotacao;
  nome text;
  novo public.pedido;
begin
  if public.meu_papel() not in ('admin','gerente','vendedor') then
    raise exception 'Seu acesso não permite aprovar cotação.' using errcode = '42501';
  end if;

  select * into c from public.cotacao where id = p_cotacao for update;
  if not found then
    raise exception 'Cotação não encontrada.' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.pedido where cotacao_id = p_cotacao) then
    raise exception 'Esta cotação já virou pedido.' using errcode = '23505';
  end if;

  select coalesce(p.nome, '') into nome from public.pessoa p where p.id = c.vendedor_id;

  insert into public.pedido (
    numero, cotacao_id, cliente_id, lead_id, total, pecas,
    vendedor_id, vendedor_nome, versao_aprovada, aprovado_por, teste
  ) values (
    public.proximo_numero_de_pedido(), c.id, c.cliente_id, c.lead_id, c.total, c.pecas,
    c.vendedor_id, coalesce(nome, ''), p_versao, auth.uid(), public.pedido_em_teste()
  ) returning * into novo;

  update public.cotacao set estado = 'aprovada' where id = c.id;

  if c.lead_id is not null then
    update public.lead set estagio = 'fechado', valor = c.total where id = c.lead_id;
  end if;

  return novo;
end $$;

grant execute on function public.aprovar_cotacao(uuid, int) to authenticated;


-- ---------- a separacao do que cada um fez ---------------------------------
-- O que o aplicativo passa a ter no lugar: quem vendeu o que, mes a mes. Sem
-- percentual e sem valor de comissao. Quanto disso vira dinheiro para a pessoa
-- e conta da gerencia, fora daqui.
--
-- Cada um ve o seu; o admin ve todos. Nao e sigilo de salario, que nao existe
-- mais aqui: e que a lista de quanto cada colega vendeu, aberta para todo mundo
-- na tela, e o tipo de numero que azeda equipe comercial sem ajudar ninguem a
-- vender mais.

create view public.venda_por_pedido
with (security_invoker = true) as
select p.id,
       p.numero,
       p.aprovado_em,
       date_trunc('month', p.aprovado_em at time zone 'America/Sao_Paulo')::date as mes,
       p.vendedor_id,
       p.vendedor_nome,
       p.cliente_id,
       cl.nome as cliente_nome,
       c.numero as cotacao_numero,
       p.total,
       p.pecas,
       p.estado,
       p.teste
  from public.pedido p
  left join public.cliente cl on cl.id = p.cliente_id
  left join public.cotacao c  on c.id  = p.cotacao_id
 where p.estado <> 'cancelado'
   and (p.vendedor_id = auth.uid() or public.sou_admin());

grant select on public.venda_por_pedido to authenticated;

create view public.venda_por_mes
with (security_invoker = true) as
select mes, vendedor_id, vendedor_nome,
       count(*)   as pedidos,
       sum(pecas) as pecas,
       sum(total) as vendido
  from public.venda_por_pedido
 group by mes, vendedor_id, vendedor_nome;

grant select on public.venda_por_mes to authenticated;
