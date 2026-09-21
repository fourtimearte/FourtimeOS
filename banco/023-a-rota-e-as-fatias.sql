-- ============================================================
-- Fourtime OS - 023 a rota e as fatias
-- ============================================================
-- O cartao do kanban NAO e o pedido, e uma FATIA: pedido mais tecnica. Um
-- pedido com layouts em sublimacao e DTF vira duas fatias, cada uma com sua
-- etapa e seu ritmo, porque sao duas maquinas andando em velocidades
-- diferentes. O painel de atividades continua com uma linha por pedido; quem
-- se divide e o chao de fabrica.
--
-- A ROTA MORA EM TABELA, e nao dentro de uma funcao. Trocar a ordem de dois
-- postos, ou mandar o bordado passar pela conferencia antes da costura, e uma
-- decisao de fabrica que muda sozinha com o tempo. Em tabela isso e um update;
-- dentro de um case do SQL e uma migracao e um deploy.


-- ---------- a rota de cada tecnica ----------------------------------------
-- As sequencias abaixo vem do MARK42, que esta no projeto em
-- RESUMO-paginas-crm-erp-editor.md, traduzidas para os 13 postos que o V7 tem
-- hoje. O MARK42 era mais fino (montagem, impressao, recorte separados); aqui
-- cada faixa dele virou o posto correspondente.
--
-- A SUBLIMACAO NAO COMECA NO CORTE, e essa e a diferenca que mais importa
-- entre as tres. Ela vem direto do estoque com o tecido cru, imprime, calandra
-- e SO ENTAO corta, no corte a laser. DTF e silk cortam antes, porque
-- imprimem sobre a peca ja pronta. Inverter isso poe o corte no lugar errado
-- para um terco da fabrica.
create table public.rota_da_tecnica (
  tecnica text not null,
  ordem   int  not null,
  posto   public.etapa_da_producao not null,
  primary key (tecnica, ordem)
);

insert into public.rota_da_tecnica (tecnica, ordem, posto) values
  /* vem do estoque com tecido cru: imprime, calandra, e o corte e depois */
  ('subli',   10, 'subli'),
  ('subli',   20, 'calandra'),
  ('subli',   30, 'corte'),
  ('subli',   40, 'conferencia'),
  ('subli',   50, 'cd-costura'),
  ('subli',   60, 'costura'),
  ('subli',   70, 'embalagem'),
  ('subli',   80, 'finalizado'),

  /* imprime sobre a peca ja cortada, entao o corte vem antes */
  ('dtf',     10, 'corte'),
  ('dtf',     20, 'dtf'),
  ('dtf',     30, 'prensa'),
  ('dtf',     40, 'conferencia'),
  ('dtf',     50, 'cd-costura'),
  ('dtf',     60, 'costura'),
  ('dtf',     70, 'embalagem'),
  ('dtf',     80, 'finalizado'),

  ('silk',    10, 'corte'),
  ('silk',    20, 'silk'),
  ('silk',    30, 'conferencia'),
  ('silk',    40, 'cd-costura'),
  ('silk',    50, 'costura'),
  ('silk',    60, 'embalagem'),
  ('silk',    70, 'finalizado'),

  /* faccao externa: sai, volta e entra na remonta */
  ('bordado', 10, 'bordado'),
  ('bordado', 20, 'cd-costura'),
  ('bordado', 30, 'costura'),
  ('bordado', 40, 'embalagem'),
  ('bordado', 50, 'finalizado'),

  ('patch',   10, 'prensa'),
  ('patch',   20, 'cd-costura'),
  ('patch',   30, 'costura'),
  ('patch',   40, 'embalagem'),
  ('patch',   50, 'finalizado');

-- FALTA CONFERIR COM A FABRICA, e esta escrito aqui para nao virar verdade por
-- esquecimento: o posto "futurize" nao entrou em rota nenhuma, porque ninguem
-- me disse o que ele faz nem onde ele entra. Quando alguem disser, e uma linha.

alter table public.rota_da_tecnica enable row level security;
create policy "quem foi aprovado le a rota"
  on public.rota_da_tecnica for select to authenticated using (public.meu_papel() is not null);
/* O grant so da SELECT, entao hoje a rota muda por migracao. A policy de
   escrita entra junto assim mesmo: no dia em que a tela de rota existir e
   alguem der o grant, o teto ja esta posto, e nao vai depender de lembrar. */
create policy "so o admin mexe na rota"
  on public.rota_da_tecnica for all to authenticated
  using (public.sou_admin()) with check (public.sou_admin());
grant select on public.rota_da_tecnica to authenticated;

-- a ordem tambem responde "quem esta mais longe do fim", que e a regra da tag
-- do pedido no passo 5: quanto menor a ordem, mais atrasado o trabalho
create or replace function public.ordem_na_rota(p_tecnica text, p_posto public.etapa_da_producao)
returns int
language sql
stable
as $$
  select ordem from public.rota_da_tecnica
   where tecnica = p_tecnica and posto = p_posto
$$;
grant execute on function public.ordem_na_rota(text, public.etapa_da_producao) to authenticated;


-- ---------- a fatia --------------------------------------------------------
-- UM LAYOUT PODE ESTAR EM DUAS FATIAS, e isso nao e erro de conta. Uma
-- camiseta sublimada com bordado no peito passa pela sublimadora E pelo
-- bordado: sao dois trabalhos na mesma peca. Por isso a soma de pecas das
-- fatias nao bate com as pecas do pedido, e nao deveria bater. Peca e o que o
-- cliente recebe; fatia e trabalho que alguem faz.
--
-- E NAO EXISTE UNICO (pedido, tecnica), de proposito. Quando um layout precisa
-- sair do grupo, numa reimpressao por exemplo, o operador usa o botao Separar
-- e nasce um cartao sozinho com a mesma tecnica. Um unico ali proibiria
-- exatamente a coisa que o botao existe para fazer.
create table public.fatia (
  id         uuid primary key default gen_random_uuid(),
  pedido_id  uuid not null references public.pedido (id) on delete cascade,
  tecnica    text not null,
  etapa      public.etapa_da_producao not null,
  etapa_em   timestamptz not null default now(),
  /* quando esta fatia chegou ao fim da rota dela. O pedido so fecha quando a
     ULTIMA fatia fecha, e e isso que carimba o fechado_em do pedido (passo 5). */
  fechado_em timestamptz,
  /* o numero do bloco na folha, que e como a fabrica chama o layout */
  layouts    int[] not null default '{}',
  pecas      int not null default 0,
  criado_em  timestamptz not null default now()
);

create index fatia_do_pedido on public.fatia (pedido_id);
create index fatia_por_etapa on public.fatia (etapa, etapa_em desc);
create index fatia_aberta on public.fatia (pedido_id) where fechado_em is null;

-- a etapa da fatia tem que existir na rota dela, senao um arrastar errado
-- coloca o cartao num posto por onde aquele trabalho nunca passa
create or replace function public.fatia_no_lugar()
returns trigger
language plpgsql
as $$
begin
  if public.ordem_na_rota(new.tecnica, new.etapa) is null then
    raise exception 'A rota de % nao passa por %.', new.tecnica, new.etapa
      using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.etapa is distinct from old.etapa then
    new.etapa_em := now();
  end if;
  if new.etapa = 'finalizado' then
    if new.fechado_em is null then new.fechado_em := now(); end if;
  else
    new.fechado_em := null;
  end if;
  return new;
end $$;

create trigger fatia_confere_a_rota
  before insert or update on public.fatia
  for each row execute function public.fatia_no_lugar();

alter table public.fatia enable row level security;
create policy "quem foi aprovado le a fatia"
  on public.fatia for select to authenticated using (public.meu_papel() is not null);
create policy "quem cuida de producao anda com a fatia"
  on public.fatia for update to authenticated
  using (public.meu_papel() in ('admin','gerente','producao'))
  with check (public.meu_papel() in ('admin','gerente','producao'));
create policy "so o admin apaga fatia"
  on public.fatia for delete to authenticated using (public.sou_admin());
grant select, update, delete on public.fatia to authenticated;
-- insert NAO entra no grant: fatia nasce pela funcao abaixo, e nao na mao.


-- ---------- as fatias nascem quando o PCP libera ---------------------------
-- As fatias vem PRONTAS do aplicativo, como os numeros da fabrica na 020, e
-- pelo mesmo motivo: quem sabe ler um bloco de layout, o que e uma tag de
-- design e como uma grade vira peca e o dominio em TypeScript, onde isso ja
-- esta escrito e conferido. Ensinar a mesma coisa ao SQL seria a mesma regra
-- em duas linguagens, e no dia em que uma mudasse a outra ficaria mentindo em
-- silencio.
--
-- O que o banco faz e o que so ele pode fazer: conferir o papel, conferir que
-- o pedido esta mesmo no PCP, achar o primeiro posto de cada rota e escrever
-- tudo de uma vez.
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

  /* liberar duas vezes nao duplica o quadro: o que ja nasceu fica */
  if exists (select 1 from public.fatia where pedido_id = p_pedido) then
    raise exception 'Este pedido já foi liberado e já tem fatias no kanban.'
      using errcode = '23505';
  end if;

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

  /* o portao. A passagem pcp -> producao passa pelo gatilho da 022, que
     confere o papel de novo: aqui e o verbo, la e a trava. */
  update public.pedido set estado = 'producao' where id = p_pedido returning * into ped;
  return ped;
end $$;

grant execute on function public.liberar_para_producao(uuid, jsonb) to authenticated;


-- ---------- o que o kanban le ---------------------------------------------
create view public.fatia_na_fabrica
with (security_invoker = true) as
select f.id,
       f.pedido_id,
       p.numero,
       coalesce(cl.nome, c.cliente_nome, '') as cliente,
       p.vendedor_nome as vendedor,
       f.tecnica,
       f.etapa,
       f.etapa_em,
       f.fechado_em,
       f.layouts,
       f.pecas,
       public.ordem_na_rota(f.tecnica, f.etapa) as ordem_na_rota,
       p.data_de_envio as entrega_em,
       p.planejado_em,
       p.aviso,
       p.estado,
       p.teste
  from public.fatia f
  join public.pedido p  on p.id = f.pedido_id
  left join public.cliente cl on cl.id = p.cliente_id
  left join public.cotacao c  on c.id  = p.cotacao_id
 where p.estado <> 'cancelado';

grant select on public.fatia_na_fabrica to authenticated;
