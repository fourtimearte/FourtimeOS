-- ============================================================
-- Fourtime OS - 025 o estoque de verdade
-- ============================================================
-- O estoque era a ultima tela em dado de exemplo: uma lista de sete materiais
-- escrita em TypeScript, com os numeros do mockup. O cartao "abaixo do minimo"
-- do inicio lia dali, entao a primeira tela que a fabrica abre todo dia
-- mostrava um alerta inventado.
--
-- O SALDO E UM CACHE, E O RAZAO E A VERDADE. Esta e a decisao que manda no
-- resto do arquivo. Um saldo que se edita direto e um numero que ninguem
-- consegue explicar: quando ele estiver errado, e ele vai estar, nao ha como
-- descobrir de onde veio. Com razao da para responder "por que o saldo e 9?"
-- lendo as linhas, e da para achar o dia em que a conta virou.
--
-- A coluna saldo existe assim mesmo, atualizada por gatilho, porque a tela
-- lista duzentos materiais e somar o razao inteiro a cada leitura seria lento
-- sem precisar. Ela e indice, e nao fonte. E existe conferir_o_razao() para
-- provar que os dois concordam, que e o que transforma "cache" em cache e nao
-- em segunda verdade.


-- ---------- o material ----------------------------------------------------
create table public.material (
  id        uuid primary key default gen_random_uuid(),
  categoria text not null,
  nome      text not null,
  unidade   text not null default 'un',
  /* abaixo disto o material aparece no alerta do inicio */
  minimo    numeric(12,3) not null default 0,
  /* cache do razao. Ninguem escreve aqui na mao: o gatilho escreve. */
  saldo     numeric(12,3) not null default 0,
  ativo     boolean not null default true,
  /* marca de ensaio (014): o material semeado sai inteiro no dia do
     lancamento, junto com o resto do conteudo de teste */
  teste     boolean not null default false,

  /* QUANDO O MATERIAL E UM TECIDO DE CATALOGO, ELE APONTA PARA LA POR ID.
     A separacao precisa achar "o tecido deste layout" e o layout guarda o
     tecido do banco de dados do editor. Casar por texto, comparando
     "DRY FIT PET 160" com "Dry fit PET 160", e a maquina de quebrar em
     silencio: funciona no teste e erra no dia em que alguem digitar diferente.
     Aviamento e insumo nao tem catalogo, entao os dois campos ficam nulos e o
     nome basta. */
  tecido_id uuid references public.tecido (id) on delete set null,
  cor_id    uuid references public.cor_de_tecido (id) on delete set null,

  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint material_categoria_conhecida
    check (categoria in ('tecido', 'aviamento', 'insumo')),
  constraint material_minimo_nao_negativo check (minimo >= 0)
);

/* o mesmo tecido na mesma cor e um material so. Sem isto, duas entradas do
   mesmo pano viram dois saldos e a separacao acha metade do que existe. */
create unique index material_do_tecido on public.material (tecido_id, cor_id)
  where tecido_id is not null;
/* e o mesmo nome e um material so, com ou sem catalogo. A trava vale para o
   aviamento e o insumo, que nao tem catalogo nenhum para segurar: sem ela,
   semear duas vezes ou digitar "Linha poliester 120 branca" de novo cria um
   segundo saldo do mesmo carretel, e a partir dai os dois estao errados. */
create unique index material_nome_unico on public.material (lower(nome));
create index material_por_categoria on public.material (categoria, nome);
create index material_abaixo_do_minimo on public.material (id)
  where ativo and saldo < minimo;
create index material_de_teste on public.material (teste) where teste;


-- ---------- o razao -------------------------------------------------------
-- QUANTIDADE COM SINAL, e nao duas colunas de entrada e saida. Duas colunas
-- convidam a linha em que as duas estao preenchidas, e ai nao existe resposta
-- certa: o banco guarda uma contradicao e a tela escolhe uma das duas para
-- mostrar. Com sinal, a linha so pode dizer uma coisa.
create table public.movimento_de_estoque (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.material (id) on delete cascade,
  /* positivo entra, negativo sai */
  quantidade  numeric(12,3) not null,
  motivo      text not null,
  /* de que pedido esta saida veio, quando veio de um */
  pedido_id   uuid references public.pedido (id) on delete set null,
  observacao  text not null default '',
  quem        uuid references public.pessoa (id) on delete set null,
  quando      timestamptz not null default now(),

  constraint movimento_motivo_conhecido
    check (motivo in ('entrada', 'saida', 'ajuste', 'separacao', 'devolucao')),
  constraint movimento_nao_e_zero check (quantidade <> 0)
);

create index movimento_do_material on public.movimento_de_estoque (material_id, quando desc);
create index movimento_do_pedido on public.movimento_de_estoque (pedido_id)
  where pedido_id is not null;


-- ---------- o gatilho que mantem o cache ----------------------------------
create or replace function public.acertar_saldo_do_material()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mat uuid := coalesce(new.material_id, old.material_id);
begin
  update public.material
     set saldo = coalesce((select sum(quantidade) from public.movimento_de_estoque
                            where material_id = mat), 0),
         atualizado_em = now()
   where id = mat;
  return null;
end $$;

create trigger movimento_acerta_o_saldo
  after insert or update or delete on public.movimento_de_estoque
  for each row execute function public.acertar_saldo_do_material();


-- ---------- a prova de que o cache nao virou segunda verdade --------------
-- Devolve as linhas em que o saldo guardado e a soma do razao discordam. O
-- esperado e nenhuma. Qualquer linha aqui quer dizer que alguem escreveu no
-- saldo por fora do razao, e o numero da tela deixou de ter explicacao.
create or replace function public.conferir_o_razao()
returns table (material text, saldo_guardado numeric, soma_do_razao numeric)
language sql
stable
as $$
  select m.nome, m.saldo,
         coalesce((select sum(v.quantidade) from public.movimento_de_estoque v
                    where v.material_id = m.id), 0)
    from public.material m
   where m.saldo is distinct from
         coalesce((select sum(v.quantidade) from public.movimento_de_estoque v
                    where v.material_id = m.id), 0)
$$;
grant execute on function public.conferir_o_razao() to authenticated;


-- ---------- mexer no estoque tem nome -------------------------------------
-- O razao nao se escreve direto da tela: se escrevesse, o "quem" viraria
-- opcional e um dia estaria vazio justo na linha que alguem precisa explicar.
-- A funcao carimba quem e quando, e e por ela que passa qualquer entrada,
-- saida ou ajuste.
create or replace function public.mexer_no_estoque(
  p_material   uuid,
  p_quantidade numeric,
  p_motivo     text,
  p_observacao text default '',
  p_pedido     uuid default null
) returns public.material
language plpgsql
security definer
set search_path = public
as $$
declare
  fim public.material;
begin
  if public.meu_papel() not in ('admin','gerente','producao','estoquista') then
    raise exception 'Seu acesso não permite mexer no estoque.' using errcode = '42501';
  end if;
  if p_quantidade = 0 then
    raise exception 'Movimento de zero não diz nada.' using errcode = '23514';
  end if;

  insert into public.movimento_de_estoque
    (material_id, quantidade, motivo, observacao, pedido_id, quem)
  values (p_material, p_quantidade, p_motivo, coalesce(p_observacao,''), p_pedido, auth.uid());

  select * into fim from public.material where id = p_material;
  if not found then
    raise exception 'Material não encontrado.' using errcode = 'P0002';
  end if;
  return fim;
end $$;

grant execute on function public.mexer_no_estoque(uuid, numeric, text, text, uuid) to authenticated;


-- ---------- regras de acesso ----------------------------------------------
alter table public.material enable row level security;
create policy "quem foi aprovado le o material"
  on public.material for select to authenticated using (public.meu_papel() is not null);
create policy "quem cuida de estoque mexe no material"
  on public.material for all to authenticated
  using (public.meu_papel() in ('admin','gerente','estoquista'))
  with check (public.meu_papel() in ('admin','gerente','estoquista'));
grant select, insert, update, delete on public.material to authenticated;

alter table public.movimento_de_estoque enable row level security;
create policy "quem foi aprovado le o razao"
  on public.movimento_de_estoque for select to authenticated
  using (public.meu_papel() is not null);
/* insert, update e delete NAO tem policy nem grant de proposito: o razao e um
   historico, e historico que se edita nao e historico. Entrada e saida passam
   por mexer_no_estoque; consertar erro e um ajuste novo, que deixa rastro, e
   nao uma linha apagada. */
grant select on public.movimento_de_estoque to authenticated;


-- ---------- o que a tela le -----------------------------------------------
create view public.material_na_prateleira
with (security_invoker = true) as
select m.id,
       m.categoria,
       m.nome,
       m.unidade,
       m.minimo,
       m.saldo,
       m.ativo,
       m.tecido_id,
       m.cor_id,
       t.nome as tecido,
       c.nome as cor,
       c.hex  as cor_hex,
       (m.saldo < m.minimo) as abaixo_do_minimo,
       m.atualizado_em,
       (select max(v.quando) from public.movimento_de_estoque v
         where v.material_id = m.id) as ultimo_movimento
  from public.material m
  left join public.tecido t        on t.id = m.tecido_id
  left join public.cor_de_tecido c on c.id = m.cor_id
 where m.ativo;

grant select on public.material_na_prateleira to authenticated;


-- ---------- o razao com nome, para a tela ---------------------------------
-- A tela mostra "Saida - DRY FIT PET 160 - PRETO - 8 kg - PD-0041", e nao tres
-- uuid. O join mora aqui e nao na tela porque ele e o mesmo para todo mundo
-- que abrir o razao, e porque view com security_invoker respeita a mesma regra
-- de acesso da tabela.
create view public.movimento_do_estoque
with (security_invoker = true) as
select v.id,
       v.material_id,
       m.nome     as material,
       m.unidade,
       m.categoria,
       v.quantidade,
       v.motivo,
       v.observacao,
       v.pedido_id,
       p.numero   as pedido,
       v.quem,
       q.nome     as quem_nome,
       v.quando
  from public.movimento_de_estoque v
  join public.material m on m.id = v.material_id
  left join public.pedido p on p.id = v.pedido_id
  left join public.pessoa q on q.id = v.quem;

grant select on public.movimento_do_estoque to authenticated;


-- ---------- a marca de ensaio entra na conta e na limpeza -----------------
-- O material semeado tem que sair no dia do lancamento pelo mesmo caminho que
-- o resto (014). O movimento nao precisa de coluna propria: ele sai junto pelo
-- on delete cascade do material, e um movimento de material de verdade nunca e
-- de teste.
create or replace view public.dado_de_teste
with (security_invoker = true) as
select 'cliente' as tabela, count(*) as linhas from public.cliente where teste
union all select 'lead',     count(*) from public.lead     where teste
union all select 'cotacao',  count(*) from public.cotacao  where teste
union all select 'pedido',   count(*) from public.pedido   where teste
union all select 'material', count(*) from public.material where teste;

create or replace function public.apagar_dados_de_teste()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare p int; c int; l int; k int; m int;
begin
  if not public.sou_admin() then
    raise exception 'Só o administrador apaga os dados de teste.' using errcode = '42501';
  end if;

  with x as (delete from public.pedido   where teste returning 1) select count(*) into p from x;
  with x as (delete from public.cotacao  where teste returning 1) select count(*) into c from x;
  with x as (delete from public.lead     where teste returning 1) select count(*) into l from x;
  with x as (delete from public.cliente  where teste returning 1) select count(*) into k from x;
  with x as (delete from public.material where teste returning 1) select count(*) into m from x;

  -- O contador do pedido de teste volta a zero, senao a proxima rodada de
  -- ensaio comecaria no PD-TESTE-0043 sem nenhum PD-TESTE-0042 para olhar.
  update public.contador set valor = 0 where chave = 'pedido-teste';

  return 'Apaguei ' || k || ' cliente(s), ' || l || ' lead(s), '
      || c || ' cotação(ões), ' || p || ' pedido(s) e '
      || m || ' material(is) de teste.';
end $$;

grant execute on function public.apagar_dados_de_teste() to authenticated;
