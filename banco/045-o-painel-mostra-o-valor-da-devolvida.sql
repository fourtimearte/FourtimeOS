-- ===========================================================================
-- 045: O PAINEL DO PARCEIRO MOSTRA O VALOR DA VENDA DEVOLVIDA
--
-- A pagina do parceiro, na loja, mostra a venda devolvida ou cancelada riscada,
-- com o valor que ela tinha, e "nao conta" no lugar da parte (wireframe
-- aprovado em 03/10/2026). Mas a view zera o valor da linha que nao conta, o
-- que esta certo para a soma e deixava a pagina sem o numero para riscar.
--
-- painel_do_parceiro ganha um campo em cada venda:
--   vendido   o que o cliente pagou pela linha inteira, sem o frete, como foi
--             vendida, antes de qualquer devolucao
-- "valor" continua sendo o que CONTA (zero na devolvida, a parte que ficou na
-- devolucao parcial). As somas nao mudam.
--
-- A funcao parte do corpo que esta no banco hoje (o da 043). A assinatura nao
-- muda, entao os grants ficam.
-- ===========================================================================

create or replace function public.painel_do_parceiro(p_chave text, p_senha text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  p      public.parceiro;
  agora  timestamptz := now();
  hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  inicio date;
begin
  select * into p from public.parceiro
   where chave = btrim(coalesce(p_chave, '')) for update;
  if not found or not p.ativo then
    return jsonb_build_object('ok', false, 'erro', 'indisponivel');
  end if;

  if p.travado_ate is not null and p.travado_ate > agora then
    return jsonb_build_object('ok', false, 'erro', 'travado',
      'minutos', greatest(1, ceil(extract(epoch from p.travado_ate - agora) / 60)::int));
  end if;

  if upper(btrim(coalesce(p_senha, ''))) is distinct from upper(p.senha) then
    if p.erros + 1 >= 5 then
      update public.parceiro set erros = 0, travado_ate = agora + interval '15 minutes' where id = p.id;
      return jsonb_build_object('ok', false, 'erro', 'travado', 'minutos', 15);
    end if;
    update public.parceiro set erros = p.erros + 1, travado_ate = null where id = p.id;
    return jsonb_build_object('ok', false, 'erro', 'senha', 'restam', 5 - (p.erros + 1));
  end if;

  update public.parceiro set erros = 0, travado_ate = null, aberta_em = agora where id = p.id;

  inicio := (date_trunc('month', hoje::timestamp) - interval '23 months')::date;

  return jsonb_build_object(
    'ok', true,
    'parceiro', p.nome,
    'hoje', hoje,
    'acordo', (
      select jsonb_build_object('tipo', x.tipo, 'valor', x.valor, 'base', x.base, 'desde', x.vale_desde)
        from public.acordo_do_parceiro x
       where x.parceiro_id = p.id and x.vale_desde <= hoje
       order by x.vale_desde desc limit 1),
    'meses', coalesce((
      select jsonb_agg(jsonb_build_object('mes', m.mes, 'pecas', m.pecas, 'valor', m.valor, 'parte', m.parte)
                       order by m.mes desc)
        from (select v.mes,
                     sum(v.pecas)::int as pecas,
                     sum(v.valor) as valor,
                     sum(coalesce(v.parte, 0)) as parte
                from public.venda_do_parceiro v
               where v.parceiro_id = p.id and v.conta
                 and (v.vendido_em at time zone 'America/Sao_Paulo')::date >= inicio
               group by v.mes) m), '[]'::jsonb),
    'vendas', coalesce((
      select jsonb_agg(jsonb_build_object(
                 'quando', to_char(v.vendido_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI'),
                 'mes', v.mes,
                 'produto', v.produto,
                 'variante', v.variante,
                 'quantidade', v.quantidade,
                 'pecas', v.pecas,
                 'valor', v.valor,
                 'vendido', round(l.quantidade * l.preco - l.desconto, 2),
                 'parte', v.parte,
                 'conta', v.conta,
                 'motivo', v.motivo)
               order by v.vendido_em desc, v.item_id)
        from public.venda_do_parceiro v
        join public.venda_da_loja l on l.item_id = v.item_id
       where v.parceiro_id = p.id and v.aparece
         and (v.vendido_em at time zone 'America/Sao_Paulo')::date >= inicio), '[]'::jsonb)
  );
end $$;


-- ---------- a prova --------------------------------------------------------
do $$
begin
  if not has_function_privilege('anon', 'public.painel_do_parceiro(text, text)', 'execute') then
    raise exception 'a pagina do parceiro perdeu o acesso a painel_do_parceiro';
  end if;
  if has_function_privilege('anon', 'public.registrar_pedido_da_loja(jsonb, text, text)', 'execute') then
    raise exception 'registrar_pedido_da_loja ficou aberta a quem nao e o porteiro';
  end if;
  if position('vendido' in pg_get_functiondef('public.painel_do_parceiro(text, text)'::regprocedure)) = 0 then
    raise exception 'painel_do_parceiro nao ganhou o campo vendido';
  end if;
  raise notice '045 pronta';
end $$;
