-- ===========================================================================
-- 057: O QUE A PAGINA DO PARCEIRO MOSTRA: O IMPOSTO NA FRASE E O DIA EM QUE
--      O RELATORIO COMECA
--
-- Dois pedidos do Henrique em 07/10/2026, um atras do outro.
--
-- 1. O IMPOSTO, SO NO TEXTO. A frase "Seu acordo: 17% do valor de cada peca"
--    precisa dizer o que e imposto e o que e a parte do parceiro. Ele quer um
--    campo onde escreve o percentual do imposto, "e isso so vai colocar no
--    texto, nao vai alterar a conta". Com o acordo em 17 e o imposto em 3, a
--    pagina escreve:
--      "Seu acordo: 20% menos 3% de imposto / 17% do valor de cada peca"
--    Os 20 sao a soma dos dois, feita pela pagina. O banco so guarda o 3.
--
-- 2. O DIA EM QUE O RELATORIO COMECA. "Preciso de controle sobre de que dia
--    comeca a mostrar relatorio na pagina. No caso do Goias, vai iniciar em
--    julho desse ano, entao so mostraria vendas de julho para frente, ao inves
--    de tudo desde o inicio." Com a data preenchida, o painel so manda os
--    meses e as vendas dela em diante. Em branco, manda tudo, como hoje.
--
-- A CONTA DE CADA VENDA NAO MUDA. A parte do parceiro continua saindo do
-- acordo, na view venda_do_parceiro, que este arquivo NAO toca. O imposto e um
-- numero que o painel leva ate a pagina. A data so escolhe QUAIS vendas a
-- pagina do parceiro recebe: a pagina Parceiros do Fourtime OS continua lendo
-- todas.
--
-- ONDE OS DOIS MORAM: no parceiro, e nao no acordo. O acordo tem data, e
-- salvar um acordo com data no passado pergunta se e para refazer a conta das
-- vendas. Nenhum dos dois refaz conta, entao nao passam por essa pergunta.
--
-- O QUE ENTRA:
--   1. as colunas parceiro.imposto (percentual, de 0 a 100; zero e "sem
--      imposto") e parceiro.mostrar_desde (data; vazia e "desde a primeira")
--   2. a view parceiro_na_lista ganha as duas, no fim
--   3. salvar_exibicao_do_parceiro, para quem pode editar os parceiros
--   4. painel_do_parceiro manda "imposto" dentro do acordo e "inicio" no topo,
--      e corta os meses e as vendas pela data
--
-- O painel e a funcao da 056, igual, mais isso. Ela vem inteira porque funcao
-- nao se emenda: se troca. A assinatura nao muda, entao os grants ficam. A
-- pagina que esta no ar hoje continua funcionando: ela ignora os campos novos.
--
-- Nenhum dado muda: todo parceiro nasce com imposto zero e sem data. Rodar de
-- novo nao muda nada.
-- ===========================================================================


-- ---------- 1. as colunas --------------------------------------------------
alter table public.parceiro add column if not exists imposto numeric(5,2) not null default 0;
alter table public.parceiro add column if not exists mostrar_desde date;

comment on column public.parceiro.imposto is
  'O percentual de imposto que a pagina do parceiro escreve ao lado do acordo. So texto: nao entra na conta da parte.';
comment on column public.parceiro.mostrar_desde is
  'O dia em que o relatorio da pagina do parceiro comeca. Vazio: desde a primeira venda. Nao muda a conta de venda nenhuma.';

alter table public.parceiro drop constraint if exists parceiro_imposto_de_zero_a_cem;
alter table public.parceiro
  add constraint parceiro_imposto_de_zero_a_cem check (imposto >= 0 and imposto <= 100);


-- ---------- 2. a lista do Fourtime OS, com as duas colunas no fim ----------
/* A view da 043, igual, mais as colunas novas. Coluna nova de view so entra no
   fim: por isso elas vem depois de "produtos". */
create or replace view public.parceiro_na_lista
with (security_invoker = true) as
select p.id,
       p.nome,
       p.colecao,
       p.colecao_nome,
       p.chave,
       p.senha,
       p.ativo,
       p.aberta_em,
       p.travado_ate,
       p.produtos_em,
       p.criado_em,
       h.tipo       as acordo_tipo,
       h.valor      as acordo_valor,
       h.base       as acordo_base,
       h.vale_desde as acordo_desde,
       u.tipo       as ultimo_tipo,
       u.valor      as ultimo_valor,
       u.base       as ultimo_base,
       u.vale_desde as ultimo_desde,
       (select count(*) from public.produto_do_parceiro pp where pp.parceiro_id = p.id) as produtos,
       p.imposto,
       p.mostrar_desde
  from public.parceiro p
  left join lateral (
        select x.tipo, x.valor, x.base, x.vale_desde
          from public.acordo_do_parceiro x
         where x.parceiro_id = p.id
           and x.vale_desde <= (now() at time zone 'America/Sao_Paulo')::date
         order by x.vale_desde desc limit 1
       ) h on true
  left join lateral (
        select x.tipo, x.valor, x.base, x.vale_desde
          from public.acordo_do_parceiro x
         where x.parceiro_id = p.id
         order by x.vale_desde desc limit 1
       ) u on true;

grant select on public.parceiro_na_lista to authenticated;


-- ---------- 3. salvar o que a pagina mostra --------------------------------
/* Imposto vazio vira zero, que e "sem imposto": a pagina volta a escrever a
   frase de antes. Data vazia e "desde a primeira venda". Nao ha pergunta de
   refazer conta, porque conta nenhuma muda. */
create or replace function public.salvar_exibicao_do_parceiro(
  p_parceiro      uuid,
  p_imposto       numeric,
  p_mostrar_desde date
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  novo numeric := round(coalesce(p_imposto, 0), 2);
begin
  if not public.posso('parceiros', 'editar') then
    raise exception 'Seu acesso não permite mexer nos parceiros.' using errcode = '42501';
  end if;
  if novo < 0 or novo > 100 then
    raise exception 'O imposto vai de 0 a 100.' using errcode = '23514';
  end if;
  update public.parceiro
     set imposto = novo,
         mostrar_desde = p_mostrar_desde,
         atualizado_em = now()
   where id = p_parceiro;
  if not found then
    raise exception 'Parceiro não encontrado.' using errcode = 'P0002';
  end if;
  return p_parceiro;
end $$;

revoke all on function public.salvar_exibicao_do_parceiro(uuid, numeric, date) from public, anon;
grant execute on function public.salvar_exibicao_do_parceiro(uuid, numeric, date) to authenticated;


-- ---------- 4. o painel do parceiro ----------------------------------------
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
    'inicio', p.mostrar_desde,
    'acordo', (
      select jsonb_build_object('tipo', x.tipo, 'valor', x.valor, 'base', x.base, 'desde', x.vale_desde,
                                'imposto', p.imposto)
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
                 and (p.mostrar_desde is null
                      or (v.vendido_em at time zone 'America/Sao_Paulo')::date >= p.mostrar_desde)
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
       where v.parceiro_id = p.id and v.aparece
         and (p.mostrar_desde is null
              or (v.vendido_em at time zone 'America/Sao_Paulo')::date >= p.mostrar_desde)), '[]'::jsonb)
  );
end $$;


-- ---------- a prova --------------------------------------------------------
do $$
declare
  corpo text := pg_get_functiondef('public.painel_do_parceiro(text, text)'::regprocedure);
  f     regprocedure := 'public.salvar_exibicao_do_parceiro(uuid, numeric, date)'::regprocedure;
begin
  if not has_function_privilege('anon', 'public.painel_do_parceiro(text, text)', 'execute') then
    raise exception 'a pagina do parceiro perdeu o acesso a painel_do_parceiro';
  end if;
  if position('''imposto'', p.imposto' in corpo) = 0 then
    raise exception 'painel_do_parceiro nao manda o imposto';
  end if;
  if position('''inicio'', p.mostrar_desde' in corpo) = 0 then
    raise exception 'painel_do_parceiro nao manda o dia em que o relatorio comeca';
  end if;
  /* o corte tem de estar nos DOIS lugares: nos meses e nas vendas */
  if (length(corpo) - length(replace(corpo, '>= p.mostrar_desde', ''))) / length('>= p.mostrar_desde') <> 2 then
    raise exception 'painel_do_parceiro nao corta os meses e as vendas pela mesma data';
  end if;
  if position('sem_acordo' in corpo) = 0 or position('vendido' in corpo) = 0 or position('imagem' in corpo) = 0 then
    raise exception 'painel_do_parceiro perdeu o sem_acordo (056), o vendido (045) ou a foto (046)';
  end if;
  if position('23 months' in corpo) > 0 then
    raise exception 'painel_do_parceiro voltou a cortar em 24 meses';
  end if;
  /* a conta: a view que faz a parte do parceiro nao pode nem citar os campos novos */
  if position('imposto' in pg_get_viewdef('public.venda_do_parceiro'::regclass)) > 0
     or position('mostrar_desde' in pg_get_viewdef('public.venda_do_parceiro'::regclass)) > 0 then
    raise exception 'a view venda_do_parceiro passou a olhar o imposto ou a data: a conta nao pode mudar';
  end if;
  if has_function_privilege('anon', f, 'execute') then
    raise exception 'quem nao entrou no sistema consegue chamar salvar_exibicao_do_parceiro';
  end if;
  if not has_function_privilege('authenticated', f, 'execute') then
    raise exception 'quem entrou no sistema nao consegue chamar salvar_exibicao_do_parceiro';
  end if;
  if not has_table_privilege('authenticated', 'public.parceiro_na_lista', 'select') then
    raise exception 'a lista dos parceiros perdeu a leitura';
  end if;
  if not exists (select 1 from pg_class c
                  where c.oid = 'public.parceiro_na_lista'::regclass
                    and c.reloptions @> array['security_invoker=true']) then
    raise exception 'a lista dos parceiros deixou de respeitar o acesso de quem le';
  end if;
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'parceiro_na_lista'
         and column_name in ('imposto', 'mostrar_desde')) <> 2 then
    raise exception 'a lista dos parceiros nao ganhou as duas colunas';
  end if;
end $$;
