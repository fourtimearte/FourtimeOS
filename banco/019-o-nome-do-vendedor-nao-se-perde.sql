-- ============================================================
-- Fourtime OS - 019 o nome do vendedor nao se perde
-- ============================================================
-- Achado logo depois de rodar a 018, no banco de verdade: o pedido
-- PD-TESTE-0001 ficou com vendedor_nome VAZIO, mesmo tendo saido de uma cotacao
-- que dizia "Dani".
--
-- O motivo: a aprovacao copiava o nome a partir da tabela pessoa, pelo
-- vendedor_id. Sem pessoa vinculada, nao ha nome, e o pedido nascia anonimo.
--
-- Isso contraria exatamente o que o sistema passou a existir para fazer depois
-- da 018: guardar a separacao correta do que cada um fez. Hoje os vendedores da
-- Fourtime (Lucas, Dani, Kev, Alam, Fabricio) ainda nao tem conta; se o pedido
-- so souber de quem foi quando a pessoa tiver login, o sistema fica sem a
-- resposta durante justamente o periodo em que ela esta sendo montada.
--
-- Entao o nome vem da pessoa QUANDO ELA EXISTE, e do que estava escrito na
-- cotacao quando nao existe. O vinculo continua sendo o que vale; o texto e o
-- que sobra quando o vinculo ainda nao existe, e sobrar e melhor que sumir.

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

  select p.nome into nome from public.pessoa p where p.id = c.vendedor_id;
  nome := coalesce(nullif(btrim(nome), ''), nullif(btrim(c.vendedor_nome), ''), '');

  insert into public.pedido (
    numero, cotacao_id, cliente_id, lead_id, total, pecas,
    vendedor_id, vendedor_nome, versao_aprovada, aprovado_por, teste
  ) values (
    public.proximo_numero_de_pedido(), c.id, c.cliente_id, c.lead_id, c.total, c.pecas,
    c.vendedor_id, nome, p_versao, auth.uid(), public.pedido_em_teste()
  ) returning * into novo;

  update public.cotacao set estado = 'aprovada' where id = c.id;

  if c.lead_id is not null then
    update public.lead set estagio = 'fechado', valor = c.total where id = c.lead_id;
  end if;

  return novo;
end $$;

grant execute on function public.aprovar_cotacao(uuid, int) to authenticated;

-- Os pedidos que ja nasceram anonimos recuperam o nome da cotacao de origem.
update public.pedido p
   set vendedor_nome = c.vendedor_nome
  from public.cotacao c
 where c.id = p.cotacao_id
   and btrim(p.vendedor_nome) = ''
   and btrim(c.vendedor_nome) <> '';

-- A venda de quem ainda nao tem conta precisa aparecer para o admin.
--
-- A view da 018 filtrava por `vendedor_id = auth.uid() or sou_admin()`, e um
-- pedido sem vendedor_id nao e de ninguem: ele sumia da conta de todo mundo,
-- inclusive da do admin, que e quem precisa ver o total da casa. Agora o admin
-- ve tudo, e o vendedor continua vendo so o dele.
drop view if exists public.venda_por_mes;
drop view if exists public.venda_por_pedido;

create view public.venda_por_pedido
with (security_invoker = true) as
select p.id,
       p.numero,
       p.aprovado_em,
       date_trunc('month', p.aprovado_em at time zone 'America/Sao_Paulo')::date as mes,
       p.vendedor_id,
       /* sem nome nenhum, a linha ainda conta: ela e uma venda da casa que
          ninguem assinou, e some-la em "(sem vendedor)" e mais util do que
          deixar ela de fora do total */
       coalesce(nullif(btrim(p.vendedor_nome), ''), '(sem vendedor)') as vendedor_nome,
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
   and (public.sou_admin() or p.vendedor_id = auth.uid());

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
