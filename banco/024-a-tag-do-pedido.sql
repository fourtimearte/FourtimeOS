-- ============================================================
-- Fourtime OS - 024 a tag do pedido
-- ============================================================
-- Tres coisas que andam juntas: o corte da sublimacao tem nome, o painel
-- passa a saber ler as fatias, e o pedido so fecha quando a ultima fatia
-- fecha.


-- ---------- o corte da sublimacao e o Futurize ----------------------------
-- Na 023 a rota da sublimacao dizia "corte" depois da calandra, e estava
-- errado pela metade: existe um corte ali, mas nao e o mesmo corte. O corte
-- do DTF e do silk e manual e vem ANTES da impressao; o da sublimacao e
-- automatico, por maquina, e vem DEPOIS da calandra. A maquina se chama
-- Futurize, e e por isso que o posto existia no enum sem rota nenhuma: ele
-- estava esperando alguem dizer o que ele fazia.
--
-- Isto e dado, entao e um update. Foi por isso que a rota nasceu em tabela.
update public.rota_da_tecnica
   set posto = 'futurize'
 where tecnica = 'subli' and ordem = 30 and posto = 'corte';


-- ---------- a familia: uma regra de LEITURA, e nao um estado novo ---------
-- O painel nao fala a lingua dos 13 postos, fala a lingua de "em que parte da
-- fabrica isso esta". Mas o kanban continua com os 13 postos de verdade: o
-- painel agrupa para ler. Mesma fonte, duas leituras, como a regra da virada
-- de semana.
--
-- Decisao do Henrique em 21/09: existe UMA familia so, e e Impressao. Todos os
-- outros postos sao eles mesmos. A tabela existe para que acrescentar uma
-- familia amanha seja uma linha, e nao uma migracao com um case dentro.
create table public.familia_do_posto (
  posto   public.etapa_da_producao primary key,
  familia text not null
);

insert into public.familia_do_posto (posto, familia) values
  ('subli', 'Impressão'),
  ('dtf',   'Impressão'),
  ('silk',  'Impressão');

alter table public.familia_do_posto enable row level security;
create policy "quem foi aprovado le a familia"
  on public.familia_do_posto for select to authenticated using (public.meu_papel() is not null);
create policy "so o admin mexe na familia"
  on public.familia_do_posto for all to authenticated
  using (public.sou_admin()) with check (public.sou_admin());
grant select on public.familia_do_posto to authenticated;

create or replace function public.familia_ou_posto(p public.etapa_da_producao)
returns text
language sql
stable
as $$
  select coalesce(
    (select familia from public.familia_do_posto where posto = p),
    p::text
  )
$$;
grant execute on function public.familia_ou_posto(public.etapa_da_producao) to authenticated;


-- ---------- quanto falta para o fim da rota -------------------------------
-- "Mais atrasado" nao e a ordem crua: a ordem 30 da sublimacao e o Futurize e
-- a ordem 30 do DTF e a prensa, e comparar as duas nao quer dizer nada, porque
-- as rotas tem comprimentos diferentes. O que se compara e QUANTOS POSTOS
-- FALTAM, que e a mesma pergunta em qualquer rota.
create or replace function public.falta_na_rota(
  p_tecnica text,
  p_posto   public.etapa_da_producao
) returns int
language sql
stable
as $$
  select count(*)::int from public.rota_da_tecnica r
   where r.tecnica = p_tecnica
     and r.ordem > coalesce(public.ordem_na_rota(p_tecnica, p_posto), 999)
$$;
grant execute on function public.falta_na_rota(text, public.etapa_da_producao) to authenticated;


-- ---------- a tag do pedido -----------------------------------------------
-- A tag e a do trabalho MAIS ATRASADO, quer dizer, o que esta mais longe do
-- fim da rota. Um pedido com subli em Costura e DTF em Impressao mostra
-- Impressao, porque e isso que esta segurando a entrega.
--
-- Mostrar o mais adiantado seria uma mentira: a linha diria "Embalagem" com
-- metade do pedido no corte, e a pergunta que o painel existe para responder,
-- se a semana cabe, passaria a ser respondida em cima disso.
--
-- COM UMA FATIA SO, A TAG E O POSTO EXATO. Agrupar existe para caber; com um
-- trabalho so nao ha o que caber, e o posto e mais preciso de graca.
create or replace function public.tag_do_pedido(p_pedido uuid)
returns text
language sql
stable
as $$
  with abertas as (
    select f.etapa, public.falta_na_rota(f.tecnica, f.etapa) as faltam
      from public.fatia f
     where f.pedido_id = p_pedido and f.fechado_em is null
  )
  select case
    when not exists (select 1 from abertas) then null
    when (select count(*) from abertas) = 1 then (select etapa::text from abertas)
    else (select public.familia_ou_posto(etapa) from abertas
           order by faltam desc, etapa limit 1)
  end
$$;
grant execute on function public.tag_do_pedido(uuid) to authenticated;


-- ---------- o pedido segue as fatias --------------------------------------
-- O PEDIDO SO FECHA QUANDO A ULTIMA FATIA FECHA, e e isso que carimba o
-- fechado_em, que por sua vez e o que ancora o pedido na semana em que o
-- trabalho aconteceu (ver src/dominio/producao/semana.ts). Fechar no primeiro
-- cartao arrastado poria o pedido na semana errada e ele sumiria do painel com
-- trabalho ainda correndo.
--
-- O fechado_em do pedido e o da ULTIMA fatia, e nao now(): se alguem apontar a
-- ultima fatia na segunda-feira, o trabalho que terminou na sexta pertence a
-- sexta. A regra da virada de semana ja depende disso.
--
-- Enquanto houver fatia aberta, a etapa do pedido e a da fatia mais atrasada.
-- Pedido sem fatia nenhuma, que e todo pedido anterior a 023, continua andando
-- pela etapa dele como antes: este gatilho so fala de quem tem fatia.
create or replace function public.acertar_pedido_pelas_fatias()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ped     uuid := coalesce(new.pedido_id, old.pedido_id);
  abertas int;
  proximo public.etapa_da_producao;
  ultima  timestamptz;
begin
  select count(*) into abertas
    from public.fatia where pedido_id = ped and fechado_em is null;

  if abertas = 0 then
    if exists (select 1 from public.fatia where pedido_id = ped) then
      select max(fechado_em) into ultima from public.fatia where pedido_id = ped;
      update public.pedido
         set etapa = 'finalizado', fechado_em = ultima
       where id = ped;
    end if;
  else
    select f.etapa into proximo
      from public.fatia f
     where f.pedido_id = ped and f.fechado_em is null
     order by public.falta_na_rota(f.tecnica, f.etapa) desc, f.etapa
     limit 1;
    update public.pedido set etapa = proximo
     where id = ped and etapa is distinct from proximo;
  end if;

  return null;
end $$;

create trigger fatia_acerta_o_pedido
  after insert or update or delete on public.fatia
  for each row execute function public.acertar_pedido_pelas_fatias();


-- ---------- o portao passa o estado ANTES de criar as fatias --------------
-- Mudanca de ordem dentro da funcao da 023, e ela nao e capricho: o gatilho
-- que acabou de nascer mexe na etapa do pedido assim que a primeira fatia
-- entra, e a trava da 022 proibe a etapa de andar enquanto o pedido esta em
-- pcp. Com o estado passando primeiro, a fatia nasce num pedido que ja esta em
-- producao e as duas regras deixam de brigar.
--
-- Na mesma transacao: se um insert de fatia falhar, o estado volta junto.
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
  if public.meu_papel() not in ('admin','gerente','producao') then
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
  if jsonb_array_length(coalesce(p_fatias, '[]'::jsonb)) = 0 then
    raise exception 'Um pedido sem nenhuma técnica de produção não tem o que liberar.'
      using errcode = '23514';
  end if;
  if exists (select 1 from public.fatia where pedido_id = p_pedido) then
    raise exception 'Este pedido já foi liberado e já tem fatias no kanban.'
      using errcode = '23505';
  end if;

  /* o portao primeiro, as fatias depois */
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

  select * into ped from public.pedido where id = p_pedido;
  return ped;
end $$;


-- ---------- a tag entra na view que o painel le ---------------------------
-- create or replace, e nao drop: drop levaria o grant junto, que e a classe de
-- erro escrita no banco/LEIA.md. Coluna nova entra no fim, que e o unico lugar
-- onde o replace aceita.
create or replace view public.pedido_na_fabrica
with (security_invoker = true) as
select p.id,
       p.numero,
       coalesce(cl.nome, c.cliente_nome, '') as cliente,
       p.vendedor_nome as vendedor,
       p.departamento,
       p.etapa,
       p.etapa_em,
       p.estado,
       p.data_de_envio as entrega_em,
       p.planejado_em,
       p.planejamento_manual,
       p.aviso,
       p.pecas,
       p.layouts,
       p.tecnicas,
       p.total,
       p.pecas_subli,
       p.pecas_personalizadas,
       p.valor_subli,
       p.valor_personalizado,
       p.fechado_em,
       p.aprovado_em,
       p.teste,
       c.numero as cotacao_numero,
       c.id     as cotacao_id,
       /* a tag: o trabalho mais atrasado, agrupado em familia quando ha mais
          de um correndo. Nula enquanto o pedido nao tem fatia. */
       public.tag_do_pedido(p.id) as tag,
       /* o que a tag esconde, para o passar o mouse e para o modal da
          timeline: cada fatia aberta com o posto exato dela */
       (select string_agg(f.tecnica || ':' || f.etapa, ', ' order by f.tecnica)
          from public.fatia f
         where f.pedido_id = p.id and f.fechado_em is null) as fatias_abertas
  from public.pedido p
  left join public.cliente cl on cl.id = p.cliente_id
  left join public.cotacao c  on c.id  = p.cotacao_id
 where p.estado <> 'cancelado';

grant select on public.pedido_na_fabrica to authenticated;
