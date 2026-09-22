-- ============================================================
-- Fourtime OS - 035 o portao na ordem certa
-- ============================================================
-- UM CONSERTO DE REGRESSAO, e vale a pena escrever de onde ela veio.
--
-- A 023 criou liberar_para_producao criando as fatias primeiro e passando o
-- estado depois. A 024 descobriu que essa ordem nao funciona: o gatilho
-- fatia_acerta_o_pedido mexe na etapa do pedido no instante em que a primeira
-- fatia entra, e a trava da 022 proibe a etapa de andar enquanto o pedido esta
-- em 'pcp'. A 024 entao inverteu a ordem: o estado passa primeiro, e a fatia
-- nasce num pedido que ja esta em producao.
--
-- A 032 reescreveu a funcao inteira para pendurar nela a segunda aprovacao, e
-- reescreveu a partir do texto da 023, que e a versao com a ordem errada. A
-- trava voltou a bater. No ensaio grande de hoje isso apareceu como 22 pedidos
-- recusados e 24 parados no PCP, marcados, com a mensagem:
--
--   Este pedido ainda esta no pcp, e a fabrica so recebe depois que o PCP libera.
--
-- ou seja: o portao acusando o proprio porteiro.
--
-- O QUE ISSO ENSINA, e esta escrito aqui porque e a parte que nao esta no
-- codigo: reescrever uma funcao a partir de uma migracao ANTIGA apaga em
-- silencio tudo que as migracoes do meio consertaram nela. Quando uma funcao
-- precisa mudar, o texto de partida e o que esta no banco HOJE, e nao o
-- arquivo em que ela nasceu.
--
-- Esta versao e a da 032 (a acao pedido.a_producao e a marca do PCP) com a
-- ordem da 024 (o estado primeiro, as fatias depois).

create or replace function public.liberar_para_producao(
  p_pedido uuid,
  p_fatias jsonb
) returns public.pedido
language plpgsql
security definer
set search_path = public
as $$
declare
  ped public.pedido;
  f   jsonb;
  tec text;
  primeiro public.etapa_da_producao;
begin
  /* a segunda aprovacao: quem libera e quem tem a acao, e nao quem marcou */
  if not public.posso_a_acao('pedido.a_producao') then
    raise exception 'Seu acesso não permite liberar pedido para produção.'
      using errcode = '42501';
  end if;

  select * into ped from public.pedido where id = p_pedido for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if ped.estado <> 'pcp' then
    raise exception 'Só o pedido que está no PCP pode ser liberado, e este está em %.',
      ped.estado using errcode = '23514';
  end if;

  /* a primeira aprovacao: a marca do PCP tem que existir */
  if ped.marcado_em is null then
    raise exception 'Este pedido ainda não foi marcado pelo PCP para aprovação.'
      using errcode = '23514';
  end if;

  if jsonb_array_length(coalesce(p_fatias, '[]'::jsonb)) = 0 then
    raise exception 'Um pedido sem nenhuma técnica de produção não tem o que liberar.'
      using errcode = '23514';
  end if;

  if exists (select 1 from public.fatia where pedido_id = p_pedido) then
    raise exception 'Este pedido já foi liberado e já tem fatias no kanban.'
      using errcode = '23505';
  end if;

  /* O PORTAO PRIMEIRO, AS FATIAS DEPOIS. Esta linha e a 024 inteira, e e a
     unica diferenca entre este arquivo e a 032. Tudo na mesma transacao: se um
     insert de fatia falhar, o estado volta junto. */
  update public.pedido set estado = 'producao' where id = p_pedido returning * into ped;

  for f in select * from jsonb_array_elements(p_fatias) loop
    tec := f ->> 'tecnica';
    select posto into primeiro from public.rota_da_tecnica
     where tecnica = tec order by ordem limit 1;
    if primeiro is null then
      raise exception 'Não existe rota para a técnica %.', tec using errcode = '23514';
    end if;

    insert into public.fatia (pedido_id, tecnica, etapa, layouts, pecas)
    values (
      p_pedido, tec, primeiro,
      coalesce((select array_agg(x::int) from jsonb_array_elements_text(f -> 'layouts') x), '{}'),
      coalesce((f ->> 'pecas')::int, 0)
    );
  end loop;

  /* o pedido volta com a etapa que o gatilho das fatias acabou de escrever */
  select * into ped from public.pedido where id = p_pedido;
  return ped;
end $$;

grant execute on function public.liberar_para_producao(uuid, jsonb) to authenticated;


-- ---------- a conferencia ---------------------------------------------------
-- Ela NAO pergunta se a funcao existe: existir ela sempre existiu. Ela lê o
-- corpo da funcao que esta no banco e confere a ORDEM das duas linhas, que e o
-- que quebrou. Assim, se um dia outra migracao reescrever a funcao a partir do
-- arquivo velho de novo, esta prova acusa no mesmo dia.
do $$
declare
  corpo text;
  pos_estado int;
  pos_fatia  int;
begin
  select pg_get_functiondef(p.oid) into corpo
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'liberar_para_producao';

  if corpo is null then
    raise exception 'liberar_para_producao nao existe no banco';
  end if;

  pos_estado := position('set estado = ''producao''' in corpo);
  pos_fatia  := position('insert into public.fatia' in corpo);

  if pos_estado = 0 or pos_fatia = 0 then
    raise exception 'nao achei as duas linhas dentro de liberar_para_producao';
  end if;
  if pos_estado > pos_fatia then
    raise exception 'A ORDEM VOLTOU A ESTAR ERRADA: a fatia nasce antes do estado passar';
  end if;

  if not exists (select 1 from public.acao where chave = 'pedido.a_producao') then
    raise exception 'a acao pedido.a_producao sumiu';
  end if;
  if position('posso_a_acao(''pedido.a_producao'')' in corpo) = 0 then
    raise exception 'a funcao voltou a perguntar o papel escrito a mao';
  end if;
  if position('marcado_em is null' in corpo) = 0 then
    raise exception 'a funcao perdeu a primeira aprovacao';
  end if;

  raise notice 'tudo passou: o portao passa o estado antes de criar a fatia';
end $$;
