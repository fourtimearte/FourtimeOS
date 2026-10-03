-- ===========================================================================
-- 044: O PORTEIRO LE A COLECAO DE TODO PARCEIRO
--
-- A 043 fazia o porteiro ler so a colecao de parceiro ATIVO. Mas "ativo" e a
-- chave da PAGINA do parceiro (ligada, o link abre; desligada, nao abre), e
-- nao tem nada a ver com a venda continuar sendo dele. Com a pagina desligada,
-- produto novo da colecao deixaria de entrar na lista do parceiro, e a venda
-- desse produto ficaria sem dono ate alguem religar a pagina.
--
-- Agora a pagina desligada so fecha o link. A lista de produtos e as vendas
-- seguem sendo lidas do mesmo jeito.
--
-- As duas funcoes partem do corpo que esta no banco hoje (o da 043). A
-- assinatura nao muda, entao os grants ficam.
-- ===========================================================================

create or replace function public.colecoes_dos_parceiros()
returns table (parceiro_id uuid, colecao text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.colecao from public.parceiro p where p.colecao <> ''
$$;

create or replace function public.registrar_pedido_da_loja(
  p_pedido jsonb,
  p_topico text default '',
  p_origem text default 'aviso'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ped      bigint;
  numero   text := coalesce(p_pedido ->> 'nome', '');
  vendido  timestamptz;
  alterado timestamptz;
  it       jsonb;
  n        int := 0;
  soltos   int := 0;
  reler    boolean := false;
  qtd      int;
begin
  if coalesce(p_pedido ->> 'id', '') !~ '^[0-9]+$' then
    insert into public.aviso_da_loja (topico, resultado)
    values (coalesce(p_topico, ''), 'sem pedido: aviso ignorado');
    return jsonb_build_object('ok', true, 'itens', 0, 'reler_produtos', false);
  end if;
  ped := (p_pedido ->> 'id')::bigint;

  if coalesce((p_pedido ->> 'teste')::boolean, false) then
    insert into public.aviso_da_loja (topico, pedido_id, pedido, resultado)
    values (coalesce(p_topico, ''), ped, numero, 'pedido de teste: não gravado');
    return jsonb_build_object('ok', true, 'itens', 0, 'teste', true, 'reler_produtos', false);
  end if;

  vendido  := coalesce((p_pedido ->> 'criado_em')::timestamptz, now());
  alterado := coalesce((p_pedido ->> 'atualizado_em')::timestamptz, vendido);

  for it in select * from jsonb_array_elements(coalesce(p_pedido -> 'itens', '[]'::jsonb)) loop
    continue when coalesce(it ->> 'id', '') !~ '^[0-9]+$';
    qtd := coalesce((it ->> 'quantidade')::int, 0);
    continue when qtd <= 0;
    insert into public.venda_da_loja
      (item_id, pedido_id, pedido, vendido_em, produto_id, variante_id, produto, variante,
       quantidade, devolvida, preco, desconto, situacao, cancelado_em, atualizado_em, origem)
    values
      ((it ->> 'id')::bigint, ped, numero, vendido,
       nullif(it ->> 'produto_id', '')::bigint,
       nullif(it ->> 'variante_id', '')::bigint,
       coalesce(it ->> 'produto', ''),
       coalesce(it ->> 'variante', ''),
       qtd,
       least(greatest(coalesce((it ->> 'devolvida')::int, 0), 0), qtd),
       coalesce((it ->> 'preco')::numeric, 0),
       greatest(coalesce((it ->> 'desconto')::numeric, 0), 0),
       lower(coalesce(p_pedido ->> 'situacao', '')),
       nullif(p_pedido ->> 'cancelado_em', '')::timestamptz,
       alterado,
       case when p_origem = 'carga' then 'carga' else 'aviso' end)
    on conflict (item_id) do update
      set pedido = excluded.pedido,
          produto_id = excluded.produto_id,
          variante_id = excluded.variante_id,
          produto = excluded.produto,
          variante = excluded.variante,
          quantidade = excluded.quantidade,
          devolvida = excluded.devolvida,
          preco = excluded.preco,
          desconto = excluded.desconto,
          situacao = excluded.situacao,
          cancelado_em = excluded.cancelado_em,
          atualizado_em = excluded.atualizado_em,
          recebido_em = now()
      where public.venda_da_loja.atualizado_em <= excluded.atualizado_em;
    n := n + 1;
  end loop;

  select count(distinct v.produto_id) into soltos
    from public.venda_da_loja v
   where v.pedido_id = ped
     and v.produto_id is not null
     and not exists (select 1 from public.produto_do_parceiro pp where pp.produto_id = v.produto_id);
  /* aqui mudou: vale todo parceiro com colecao, com a pagina ligada ou nao */
  reler := soltos > 0 and exists (
    select 1 from public.parceiro p
     where p.colecao <> ''
       and (p.produtos_em is null or p.produtos_em < now() - interval '10 minutes'));

  insert into public.aviso_da_loja (topico, pedido_id, pedido, itens, resultado)
  values (coalesce(p_topico, ''), ped, numero, n,
          lower(coalesce(p_pedido ->> 'situacao', '')));

  return jsonb_build_object('ok', true, 'itens', n, 'reler_produtos', reler);
end $$;

-- ---------- a prova --------------------------------------------------------
do $$
begin
  if has_function_privilege('anon', 'public.registrar_pedido_da_loja(jsonb, text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.registrar_pedido_da_loja(jsonb, text, text)', 'execute')
     or not has_function_privilege('service_role', 'public.registrar_pedido_da_loja(jsonb, text, text)', 'execute') then
    raise exception 'registrar_pedido_da_loja perdeu a tranca ao ser refeita';
  end if;
  if has_function_privilege('anon', 'public.colecoes_dos_parceiros()', 'execute')
     or not has_function_privilege('service_role', 'public.colecoes_dos_parceiros()', 'execute') then
    raise exception 'colecoes_dos_parceiros perdeu a tranca ao ser refeita';
  end if;
  if pg_get_functiondef('public.colecoes_dos_parceiros()'::regprocedure) ~ 'p\.ativo'
     or pg_get_functiondef('public.registrar_pedido_da_loja(jsonb, text, text)'::regprocedure) ~ 'p\.ativo' then
    raise exception 'o porteiro ainda olha se a pagina esta ativa';
  end if;
  raise notice '044 pronta: o porteiro le a colecao de todo parceiro';
end $$;
