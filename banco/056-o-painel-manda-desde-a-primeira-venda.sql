-- ===========================================================================
-- 056: O PAINEL DO PARCEIRO MANDA TUDO, DESDE A PRIMEIRA VENDA
--
-- Pedido do Henrique em 06/10/2026: a pagina do parceiro, na loja, precisa do
-- periodo "Desde o inicio", alem de 3, 6 e 12 meses. A funcao so mandava os
-- ultimos 24 meses. Hoje isso nao cortava nada (a primeira venda tem 12
-- meses), mas cortaria sem avisar quando o parceiro passasse de dois anos, e
-- o "desde o inicio" viraria "desde dois anos atras" com cara de total.
--
-- O QUE MUDA em painel_do_parceiro:
--   1. sai o corte de 24 meses: "meses" e "vendas" vem desde a primeira venda
--   2. cada mes ganha "sem_acordo": quantas pecas que contam foram vendidas
--      num dia em que nao havia acordo. A pagina mostrava R$ 0,00 de parte
--      nesses meses, o que parece conta feita e e falta de acordo.
--
-- O resto e a funcao da 046, igual. A assinatura nao muda, entao os grants
-- ficam. A pagina que esta no ar hoje continua funcionando: ela ignora o
-- campo novo e so olha os meses do periodo escolhido.
--
-- Nenhum dado muda. Rodar de novo nao muda nada.
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
      select jsonb_agg(jsonb_build_object('mes', m.mes, 'pecas', m.pecas, 'valor', m.valor, 'parte', m.parte,
                                          'sem_acordo', m.sem_acordo)
                       order by m.mes desc)
        from (select v.mes,
                     sum(v.pecas)::int as pecas,
                     sum(v.valor) as valor,
                     sum(coalesce(v.parte, 0)) as parte,
                     coalesce(sum(v.pecas) filter (where v.parte is null), 0)::int as sem_acordo
                from public.venda_do_parceiro v
               where v.parceiro_id = p.id and v.conta
               group by v.mes) m), '[]'::jsonb),
    'vendas', coalesce((
      select jsonb_agg(jsonb_build_object(
                 'quando', to_char(v.vendido_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI'),
                 'mes', v.mes,
                 'produto', v.produto,
                 'imagem', v.imagem,
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
       where v.parceiro_id = p.id and v.aparece), '[]'::jsonb)
  );
end $$;


-- ---------- a prova --------------------------------------------------------
do $$
declare
  corpo text := pg_get_functiondef('public.painel_do_parceiro(text, text)'::regprocedure);
begin
  if not has_function_privilege('anon', 'public.painel_do_parceiro(text, text)', 'execute') then
    raise exception 'a pagina do parceiro perdeu o acesso a painel_do_parceiro';
  end if;
  if position('23 months' in corpo) > 0 then
    raise exception 'painel_do_parceiro continua cortando em 24 meses';
  end if;
  if position('sem_acordo' in corpo) = 0 then
    raise exception 'painel_do_parceiro nao ganhou o campo sem_acordo';
  end if;
  if position('vendido' in corpo) = 0 or position('imagem' in corpo) = 0 then
    raise exception 'painel_do_parceiro perdeu o campo vendido (045) ou a foto (046)';
  end if;
end $$;
