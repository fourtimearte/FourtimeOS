-- ============================================================
-- Fourtime OS - 026 a reserva e o consumo
-- ============================================================
-- O estoque de verdade (025) respondia "quanto tem". Faltava a outra metade da
-- pergunta que o PCP faz todo dia: "quanto disso ja tem dono".
--
-- Ate aqui o sistema nao tinha como saber quanto de malha um pedido come. O
-- mockup inventava: area do molde dividida por um aproveitamento chutado, vezes
-- uma gramatura escrita a mao numa tabela de exemplo. Numero inventado em conta
-- de compra e pior que conta nenhuma, porque ele parece resposta.
--
-- CONSUMO E CADASTRO, E NAO CONTA. Quem sabe quanto uma camiseta G come e a
-- mesa de corte, e nao uma formula. Entao o consumo vira tabela, por referencia
-- e por tamanho, e nasce VAZIA. Onde ele nao estiver cadastrado, a reserva
-- existe assim mesmo, marcada como sem consumo: ela diz "este pedido precisa
-- deste material e eu nao sei quanto", que e informacao, enquanto um zero
-- silencioso seria mentira.
--
-- Decisao do Henrique em 21/09: guardar METROS E PESO, os dois, e deixar para
-- depois qual dos dois a fabrica vai preencher na pratica. E a reserva TIRA do
-- disponivel: o estoque passa a ter saldo (o que esta na prateleira) e livre (o
-- que sobra depois do que os pedidos aprovados ja comprometeram), e o alerta de
-- minimo passa a olhar o livre.


-- ---------- o tecido ganha as duas medidas que faltavam --------------------
-- Com largura e gramatura da para ir de metro para quilo e voltar, que e o que
-- permite cadastrar o consumo na unidade que a fabrica tiver na mao e mesmo
-- assim baixar do saldo, que esta em quilo.
alter table public.tecido add column if not exists gramatura numeric(8,2);
alter table public.tecido add column if not exists largura   numeric(6,3);

comment on column public.tecido.gramatura is 'g/m2, nulo enquanto ninguem cadastrou';
comment on column public.tecido.largura   is 'metros de largura do rolo, nulo enquanto ninguem cadastrou';


-- ---------- o consumo, por referencia e por tamanho ------------------------
-- Por TAMANHO, e nao por referencia so: um PP e um G4 nao comem a mesma malha,
-- e a diferenca entre as pontas da grade passa de 20%. Uma media por referencia
-- erraria para os dois lados ao mesmo tempo, e erraria mais justamente no
-- pedido de escola, que e o que tem a grade inteira.
create table public.consumo_da_referencia (
  id            uuid primary key default gen_random_uuid(),
  referencia_id uuid not null references public.referencia (id) on delete cascade,
  tamanho       text not null,
  /* os dois, e pelo menos um preenchido. Qual deles a fabrica vai usar ainda
     nao esta decidido, e obrigar a escolher agora seria escolher por ela. */
  metros        numeric(10,4),
  quilos        numeric(10,4),
  observacao    text not null default '',
  atualizado_em timestamptz not null default now(),

  constraint consumo_tem_alguma_medida
    check (metros is not null or quilos is not null),
  constraint consumo_nao_e_negativo
    check (coalesce(metros, 0) >= 0 and coalesce(quilos, 0) >= 0)
);

create unique index consumo_por_referencia_e_tamanho
  on public.consumo_da_referencia (referencia_id, tamanho);

alter table public.consumo_da_referencia enable row level security;
create policy "quem foi aprovado le o consumo"
  on public.consumo_da_referencia for select to authenticated
  using (public.meu_papel() is not null);
create policy "quem cuida de producao cadastra o consumo"
  on public.consumo_da_referencia for all to authenticated
  using (public.meu_papel() in ('admin','gerente','producao','estoquista'))
  with check (public.meu_papel() in ('admin','gerente','producao','estoquista'));
grant select, insert, update, delete on public.consumo_da_referencia to authenticated;


-- ---------- metro vira quilo e quilo vira metro ----------------------------
-- Devolve as duas medidas de UMA peca, completando a que faltar quando o tecido
-- tem largura e gramatura. Devolve nulo no que nao der para saber, e nao zero:
-- zero e um numero, e um numero errado aqui vira compra errada.
create or replace function public.consumo_da_peca(
  p_referencia uuid,
  p_tamanho    text,
  p_tecido     uuid
) returns table (metros numeric, quilos numeric)
language sql
stable
as $$
  select
    coalesce(
      c.metros,
      case when c.quilos is not null and t.largura > 0 and t.gramatura > 0
           then c.quilos * 1000 / (t.largura * t.gramatura) end
    ),
    coalesce(
      c.quilos,
      case when c.metros is not null and t.largura > 0 and t.gramatura > 0
           then c.metros * t.largura * t.gramatura / 1000 end
    )
  from public.consumo_da_referencia c
  left join public.tecido t on t.id = p_tecido
  where c.referencia_id = p_referencia and c.tamanho = p_tamanho
$$;
grant execute on function public.consumo_da_peca(uuid, text, uuid) to authenticated;


-- ---------- a reserva ------------------------------------------------------
-- O que um pedido aprovado ja comprometeu. NAO e movimento de estoque: a malha
-- continua na prateleira, e sair da prateleira e a separacao (passo 8). Por
-- isso a reserva e tabela propria e nao linha do razao: o razao conta o que
-- ACONTECEU, e a reserva conta o que vai acontecer.
create table public.reserva (
  id          uuid primary key default gen_random_uuid(),
  pedido_id   uuid not null references public.pedido (id) on delete cascade,
  material_id uuid not null references public.material (id) on delete cascade,
  quantidade  numeric(12,3) not null default 0,
  unidade     text not null default '',
  /* quantas pecas deste pedido dependem deste material, que e o que da para
     dizer mesmo quando o consumo nao esta cadastrado */
  pecas       int not null default 0,
  /* A LINHA EXISTE MESMO SEM CONSUMO CADASTRADO, e e de proposito. Ela diz
     "este pedido precisa deste material e eu nao sei quanto". Sumir com a
     linha faria o PCP achar que o pedido nao usa o material. */
  sem_consumo boolean not null default false,
  /* a separacao deu baixa: a reserva cumpriu o papel e para de segurar saldo */
  baixada     boolean not null default false,
  criada_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint reserva_quantidade_nao_negativa check (quantidade >= 0)
);

create unique index reserva_do_pedido_e_material
  on public.reserva (pedido_id, material_id);
create index reserva_por_material on public.reserva (material_id) where not baixada;
create index reserva_por_pedido   on public.reserva (pedido_id);

alter table public.reserva enable row level security;
create policy "quem foi aprovado le a reserva"
  on public.reserva for select to authenticated using (public.meu_papel() is not null);
create policy "quem cuida de producao mexe na reserva"
  on public.reserva for all to authenticated
  using (public.meu_papel() in ('admin','gerente','producao','estoquista'))
  with check (public.meu_papel() in ('admin','gerente','producao','estoquista'));
grant select, insert, update, delete on public.reserva to authenticated;


-- ---------- quem monta a reserva -------------------------------------------
-- Ela le o documento da cotacao, que e jsonb, e nao uma copia do documento em
-- outro lugar. O layout guarda o tecido pelo NOME, e nao pelo id: e por isso
-- que esta funcao faz o casamento por texto que a 025 disse para nao fazer.
-- A divida esta registrada e tem dono: o bloco precisa passar a guardar
-- tecido_id e cor_id, e ai este join vira ligacao de verdade. Enquanto isso, um
-- nome que nao casa vira uma linha sem material, que a tela mostra.
--
-- O PRIMEIRO TECIDO DO BLOCO E O TECIDO DA PECA. Os outros (ribana, gola,
-- punho) entram como linha sem consumo, porque o consumo cadastrado e da peca,
-- e ninguem sabe ainda quanto de ribana uma gola leva. Chutar uma fracao,
-- que e o que o mockup fazia, seria inventar a conta mais cara da fabrica.
create or replace function public.reservar_o_pedido(p_pedido uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  ped     public.pedido;
  doc     jsonb;
  prod    jsonb;
  bloco   jsonb;
  /* `pano`, e nao `tecido`: variavel com nome de tabela dentro de uma consulta
     aquela tabela e a receita de erro que so aparece em producao */
  pano    jsonb;
  par     record;
  ref_id  uuid;
  id_pano uuid;
  id_cor  uuid;
  mat     public.material;
  medida  record;
  pecas   int;
  soma    numeric;
  falta   boolean;
  i       int;
  linhas  int := 0;
begin
  select * into ped from public.pedido where id = p_pedido;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;

  select corpo into doc from public.cotacao where id = ped.cotacao_id;
  if doc is null then
    return 0;
  end if;

  /* refaz do zero: reservar de novo depois de uma correcao no consumo tem que
     dar o numero novo, e nao o novo somado ao velho */
  delete from public.reserva where pedido_id = p_pedido and not baixada;

  for prod in select * from jsonb_array_elements(coalesce(doc -> 'produtos', '[]'::jsonb)) loop
    bloco := prod -> 'bloco';
    continue when bloco is null;
    /* modulo de informacoes e anexo do pedido: nao tem tecido nem grade */
    continue when coalesce((bloco ->> 'informacoes')::boolean, false);

    /* a referencia, pelo codigo quando ele existe e pelo nome quando nao */
    select r.id into ref_id from public.referencia r
     where (r.cod <> '' and r.cod = coalesce(bloco ->> 'referencia', ''))
        or (coalesce(bloco ->> 'referencia', '') = ''
            and r.nome = coalesce(bloco ->> 'nomeDaReferencia', ''))
     limit 1;

    pecas := coalesce((
      select sum(v::int)::int from jsonb_each_text(coalesce(bloco -> 'grade', '{}'::jsonb)) as g(k, v)
    ), 0);
    continue when pecas = 0;

    i := 0;
    for pano in select * from jsonb_array_elements(coalesce(bloco -> 'tecidos', '[]'::jsonb)) loop
      i := i + 1;

      select t.id into id_pano from public.tecido t
       where t.nome = coalesce(pano ->> 'nome', '') limit 1;
      select c.id into id_cor from public.cor_de_tecido c
       where c.nome = coalesce(pano ->> 'cor', '') limit 1;

      /* `m.cor_id = id_cor` e nao `m.cor_id = cor_id`: uma variavel com o mesmo
         nome de uma coluna da tabela faz o Postgres recusar a consulta inteira
         por ambiguidade, e a mensagem nao ajuda ninguem */
      select * into mat from public.material m
       where m.tecido_id = id_pano and m.cor_id = id_cor limit 1;
      continue when not found;

      soma  := 0;
      falta := false;

      if i > 1 or ref_id is null then
        /* tecido secundario, ou referencia que nao casou: a linha existe para
           dizer que o material entra no pedido, e o quanto fica em aberto */
        falta := true;
      else
        for par in
          select k as tamanho, v::int as quantos
            from jsonb_each_text(coalesce(bloco -> 'grade', '{}'::jsonb)) as g(k, v)
           where v::int > 0
        loop
          select * into medida from public.consumo_da_peca(ref_id, par.tamanho, id_pano);
          if not found
             or (mat.unidade = 'kg' and medida.quilos is null)
             or (mat.unidade = 'm'  and medida.metros is null)
             or mat.unidade not in ('kg', 'm') then
            falta := true;
          else
            soma := soma + par.quantos *
              case when mat.unidade = 'kg' then medida.quilos else medida.metros end;
          end if;
        end loop;
      end if;

      insert into public.reserva
        (pedido_id, material_id, quantidade, unidade, pecas, sem_consumo)
      values (p_pedido, mat.id, case when falta then 0 else soma end,
              mat.unidade, pecas, falta)
      /* `reserva.x` e nao `public.reserva.x`: dentro de ON CONFLICT DO UPDATE o
         Postgres so enxerga a tabela alvo pelo nome, sem o esquema */
      on conflict (pedido_id, material_id) do update
        set quantidade    = reserva.quantidade + excluded.quantidade,
            pecas         = reserva.pecas + excluded.pecas,
            sem_consumo   = reserva.sem_consumo or excluded.sem_consumo,
            atualizado_em = now();

      linhas := linhas + 1;
    end loop;
  end loop;

  return linhas;
end $$;

grant execute on function public.reservar_o_pedido(uuid) to authenticated;


-- ---------- a aprovacao passa a reservar -----------------------------------
-- A reserva nasce no MESMO caminho da aprovacao, e nao num botao separado. O
-- motivo e o mesmo da trava da passagem (022): quem aprova nao deveria precisar
-- lembrar de reservar, e uma tela que precisa lembrar e uma tela que um dia
-- esquece. O ensaio, a tela e um POST cru passam todos por aqui.
create or replace function public.aprovar_cotacao(
  p_cotacao uuid,
  p_versao int default 1,
  p_layouts int default 0,
  p_tecnicas text[] default '{}',
  p_pecas_subli int default 0,
  p_pecas_personalizadas int default 0,
  p_valor_subli numeric default 0,
  p_valor_personalizado numeric default 0
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
    vendedor_id, vendedor_nome, versao_aprovada, aprovado_por, teste,
    departamento, data_de_envio,
    layouts, tecnicas, pecas_subli, pecas_personalizadas,
    valor_subli, valor_personalizado
  ) values (
    public.proximo_numero_de_pedido(), c.id, c.cliente_id, c.lead_id, c.total, c.pecas,
    c.vendedor_id, nome, p_versao, auth.uid(), public.pedido_em_teste(),
    coalesce(c.corpo -> 'producao' ->> 'departamento', ''),
    nullif(c.corpo -> 'producao' ->> 'dataDeEnvio', '')::date,
    coalesce(p_layouts, 0), coalesce(p_tecnicas, '{}'),
    coalesce(p_pecas_subli, 0), coalesce(p_pecas_personalizadas, 0),
    coalesce(p_valor_subli, 0), coalesce(p_valor_personalizado, 0)
  ) returning * into novo;

  update public.cotacao set estado = 'aprovada' where id = c.id;

  if c.lead_id is not null then
    update public.lead set estagio = 'fechado', valor = c.total where id = c.lead_id;
  end if;

  /* A RESERVA NAO DERRUBA A APROVACAO. Um material fora do cadastro, um nome de
     tecido que nao casou, um documento antigo com outra forma: nada disso pode
     impedir o vendedor de fechar a venda. A falta aparece na tela do estoque e
     do PCP, que e onde alguem pode resolver. */
  begin
    perform public.reservar_o_pedido(novo.id);
  exception when others then
    raise warning 'reserva do pedido % falhou: %', novo.numero, sqlerrm;
  end;

  return novo;
end $$;

grant execute on function public.aprovar_cotacao(
  uuid, int, int, text[], int, int, numeric, numeric
) to authenticated;


-- ---------- refazer o que ficou para tras ----------------------------------
-- A reserva nasce no dia da aprovacao, com o consumo que existia NAQUELE dia.
-- Cadastrar o consumo que faltava depois nao conserta sozinho o pedido que ja
-- passou, e um numero que so fica certo para quem chegou na ordem certa nao e
-- um numero em que alguem confia.
--
-- Esta funcao refaz a reserva de todo pedido que ainda nao saiu da fabrica. Ela
-- e barata porque a reserva e derivada: nao existe nada dentro dela que alguem
-- digitou e que possa se perder ao refazer.
create or replace function public.refazer_as_reservas_abertas()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  p      record;
  quanto int := 0;
begin
  if public.meu_papel() not in ('admin','gerente','producao','estoquista') then
    raise exception 'Seu acesso não permite refazer as reservas.' using errcode = '42501';
  end if;

  for p in
    select id from public.pedido
     where estado in ('aprovado', 'separacao', 'pcp', 'producao')
  loop
    perform public.reservar_o_pedido(p.id);
    quanto := quanto + 1;
  end loop;

  return quanto;
end $$;

grant execute on function public.refazer_as_reservas_abertas() to authenticated;


-- ---------- o saldo ganha o livre ------------------------------------------
-- A decisao do Henrique: a reserva TIRA. O que esta na prateleira continua
-- sendo `saldo`, porque e o que a contagem fisica vai achar, e `livre` e o que
-- sobra depois do que ja tem dono. O alerta de minimo passa a olhar o livre,
-- que e a pergunta de compra de verdade: nao adianta ter 42 kg na prateleira se
-- 30 ja sairam em pedido aprovado.
/* `drop` e nao `create or replace`: replace so aceita acrescentar coluna no
   FIM, e `reservado` e `livre` moram ao lado de `saldo`, que e onde quem le a
   view procura por eles. Nada depende desta view alem da tela. */
drop view if exists public.material_na_prateleira;

create view public.material_na_prateleira
with (security_invoker = true) as
select m.id,
       m.categoria,
       m.nome,
       m.unidade,
       m.minimo,
       m.saldo,
       coalesce(r.reservado, 0)           as reservado,
       m.saldo - coalesce(r.reservado, 0) as livre,
       coalesce(r.pedidos, 0)             as pedidos_reservando,
       coalesce(r.em_aberto, false)       as reserva_sem_consumo,
       m.ativo,
       m.tecido_id,
       m.cor_id,
       t.nome as tecido,
       c.nome as cor,
       c.hex  as cor_hex,
       (m.saldo - coalesce(r.reservado, 0) < m.minimo) as abaixo_do_minimo,
       m.atualizado_em,
       (select max(v.quando) from public.movimento_de_estoque v
         where v.material_id = m.id) as ultimo_movimento
  from public.material m
  left join public.tecido t        on t.id = m.tecido_id
  left join public.cor_de_tecido c on c.id = m.cor_id
  left join lateral (
    select sum(x.quantidade)          as reservado,
           count(*)                   as pedidos,
           bool_or(x.sem_consumo)     as em_aberto
      from public.reserva x
     where x.material_id = m.id and not x.baixada
  ) r on true
 where m.ativo;

grant select on public.material_na_prateleira to authenticated;


-- ---------- o que a tela do pedido le --------------------------------------
create view public.reserva_do_pedido
with (security_invoker = true) as
select r.id,
       r.pedido_id,
       p.numero    as pedido,
       r.material_id,
       m.nome      as material,
       m.categoria,
       r.quantidade,
       r.unidade,
       r.pecas,
       r.sem_consumo,
       r.baixada,
       m.saldo,
       (m.saldo >= r.quantidade and not r.sem_consumo) as o_estoque_cobre,
       r.criada_em
  from public.reserva r
  join public.material m on m.id = r.material_id
  join public.pedido   p on p.id = r.pedido_id;

grant select on public.reserva_do_pedido to authenticated;
