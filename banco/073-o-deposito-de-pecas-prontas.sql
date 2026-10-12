-- ===========================================================================
-- 073: O DEPOSITO DE PECAS PRONTAS (Fichas tecnicas, aba Deposito; prancha 63)
--
-- 12/10/2026. A aba existia so com "ainda nao chegou". Agora:
--
--   peca_pronta            um LOTE: a referencia, a cor ou estampa, de onde
--                          veio (pronta entrega, sobra de pedido, mostruario),
--                          a grade (tamanho -> pecas), onde fica e quando
--                          foi guardado. A grade adulta e a infantil moram na
--                          mesma coluna: o lote e de uma ou de outra.
--   movimento_de_peca      o historico: guardou, deu baixa (com o motivo) e
--                          mudou de lugar. Ninguem edita nem apaga.
--
--   guardar_pecas(...)     cria o lote e anota.
--   dar_baixa_de_pecas(..) tira pecas de um lote, tamanho por tamanho, e
--                          recusa tirar mais do que tem.
--   mudar_lugar_do_lote()  troca o "onde fica".
--
-- QUEM MEXE: quem tem "editar" em Fichas tecnicas (posso('produtos','editar'),
-- a mesma regra das fichas). Todo mundo aprovado le.
--
-- O lote zerado nao some: fica com a grade vazia e sai da vista da tela. E o
-- registro de que aquela peca existiu e para onde foi.
-- ===========================================================================

create table if not exists public.peca_pronta (
  id            uuid primary key default gen_random_uuid(),
  referencia_id uuid references public.referencia (id) on delete set null,
  /* o codigo e o nome guardados junto: a referencia pode mudar de nome ou
     sair do catalogo, e o lote continua dizendo o que e */
  cod           text not null default '',
  nome          text not null check (length(btrim(nome)) between 1 and 120),
  cor           text not null default '' check (length(cor) <= 80),
  origem        text not null default 'pronta' check (origem in ('pronta', 'sobra', 'mostruario')),
  pedido        text not null default '' check (length(pedido) <= 40),
  grade         jsonb not null default '{}'::jsonb check (jsonb_typeof(grade) = 'object'),
  onde          text not null default '' check (length(onde) <= 60),
  guardado_em   timestamptz not null default now(),
  guardado_por  uuid references public.pessoa (id) on delete set null default auth.uid(),
  atualizado_em timestamptz not null default now(),
  teste         boolean not null default false
);

create index if not exists peca_pronta_referencia on public.peca_pronta (referencia_id);

create table if not exists public.movimento_de_peca (
  id      uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.peca_pronta (id) on delete cascade,
  tipo    text not null check (tipo in ('guardou', 'baixa', 'lugar')),
  grade   jsonb not null default '{}'::jsonb,
  motivo  text not null default '' check (length(motivo) <= 200),
  quem    uuid references public.pessoa (id) on delete set null default auth.uid(),
  em      timestamptz not null default now()
);

create index if not exists movimento_de_peca_lote on public.movimento_de_peca (lote_id, em desc);

alter table public.peca_pronta enable row level security;
alter table public.movimento_de_peca enable row level security;

drop policy if exists "quem foi aprovado le o deposito de pecas" on public.peca_pronta;
create policy "quem foi aprovado le o deposito de pecas"
  on public.peca_pronta for select to authenticated using (public.meu_papel() is not null);
drop policy if exists "quem foi aprovado le o movimento das pecas" on public.movimento_de_peca;
create policy "quem foi aprovado le o movimento das pecas"
  on public.movimento_de_peca for select to authenticated using (public.meu_papel() is not null);

/* so leitura direta: escrever e pelas funcoes, que conferem a grade e anotam */
grant select on public.peca_pronta to authenticated;
grant select on public.movimento_de_peca to authenticated;

-- a grade limpa: so tamanho com numero inteiro maior que zero
create or replace function public.grade_limpa(p jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_object_agg(k, (v)::int), '{}'::jsonb)
    from jsonb_each_text(coalesce(p, '{}'::jsonb)) as e(k, v)
   where v ~ '^\d+$' and (v)::int > 0 and length(k) between 1 and 6
$$;

create or replace function public.guardar_pecas(
  p_referencia uuid, p_cor text, p_origem text, p_pedido text, p_grade jsonb, p_onde text
) returns public.peca_pronta
language plpgsql
security definer
set search_path = public
as $$
declare
  ref   public.referencia;
  g     jsonb := public.grade_limpa(p_grade);
  lote  public.peca_pronta;
begin
  if not public.posso('produtos', 'editar') then
    raise exception 'Seu acesso não permite guardar peças no depósito.' using errcode = '42501';
  end if;
  select * into ref from public.referencia where id = p_referencia;
  if not found then
    raise exception 'Referência não encontrada.' using errcode = 'P0002';
  end if;
  if g = '{}'::jsonb then
    raise exception 'Escreva quantas peças de cada tamanho.' using errcode = '22023';
  end if;
  insert into public.peca_pronta (referencia_id, cod, nome, cor, origem, pedido, grade, onde)
  values (ref.id, ref.cod, ref.nome, btrim(coalesce(p_cor, '')), coalesce(nullif(p_origem, ''), 'pronta'),
          case when p_origem = 'sobra' then btrim(coalesce(p_pedido, '')) else '' end,
          g, btrim(coalesce(p_onde, '')))
  returning * into lote;
  insert into public.movimento_de_peca (lote_id, tipo, grade) values (lote.id, 'guardou', g);
  return lote;
end $$;

create or replace function public.dar_baixa_de_pecas(
  p_lote uuid, p_grade jsonb, p_motivo text
) returns public.peca_pronta
language plpgsql
security definer
set search_path = public
as $$
declare
  lote  public.peca_pronta;
  g     jsonb := public.grade_limpa(p_grade);
  k     text;
  nova  jsonb;
  resta int;
begin
  if not public.posso('produtos', 'editar') then
    raise exception 'Seu acesso não permite dar baixa no depósito.' using errcode = '42501';
  end if;
  if btrim(coalesce(p_motivo, '')) = '' then
    raise exception 'Diga para onde as peças foram.' using errcode = '22023';
  end if;
  select * into lote from public.peca_pronta where id = p_lote for update;
  if not found then
    raise exception 'Lote não encontrado.' using errcode = 'P0002';
  end if;
  if g = '{}'::jsonb then
    raise exception 'Escreva quantas peças de cada tamanho saem.' using errcode = '22023';
  end if;
  nova := lote.grade;
  for k in select jsonb_object_keys(g) loop
    resta := coalesce((nova ->> k)::int, 0) - (g ->> k)::int;
    if resta < 0 then
      raise exception 'O lote só tem % peça(s) no tamanho %.', coalesce((nova ->> k)::int, 0), k using errcode = '22023';
    end if;
    nova := case when resta = 0 then nova - k else jsonb_set(nova, array[k], to_jsonb(resta)) end;
  end loop;
  update public.peca_pronta set grade = nova, atualizado_em = now() where id = p_lote returning * into lote;
  insert into public.movimento_de_peca (lote_id, tipo, grade, motivo) values (p_lote, 'baixa', g, left(btrim(p_motivo), 200));
  return lote;
end $$;

create or replace function public.mudar_lugar_do_lote(p_lote uuid, p_onde text)
returns public.peca_pronta
language plpgsql
security definer
set search_path = public
as $$
declare lote public.peca_pronta;
begin
  if not public.posso('produtos', 'editar') then
    raise exception 'Seu acesso não permite mexer no depósito.' using errcode = '42501';
  end if;
  update public.peca_pronta set onde = left(btrim(coalesce(p_onde, '')), 60), atualizado_em = now()
   where id = p_lote returning * into lote;
  if not found then
    raise exception 'Lote não encontrado.' using errcode = 'P0002';
  end if;
  insert into public.movimento_de_peca (lote_id, tipo, motivo) values (p_lote, 'lugar', lote.onde);
  return lote;
end $$;

revoke all on function public.guardar_pecas(uuid, text, text, text, jsonb, text) from public;
revoke all on function public.dar_baixa_de_pecas(uuid, jsonb, text) from public;
revoke all on function public.mudar_lugar_do_lote(uuid, text) from public;
grant execute on function public.guardar_pecas(uuid, text, text, text, jsonb, text) to authenticated;
grant execute on function public.dar_baixa_de_pecas(uuid, jsonb, text) to authenticated;
grant execute on function public.mudar_lugar_do_lote(uuid, text) to authenticated;
grant execute on function public.grade_limpa(jsonb) to authenticated;
