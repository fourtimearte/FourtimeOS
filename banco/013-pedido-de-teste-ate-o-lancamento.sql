-- ============================================================
-- Fourtime OS - 013 o pedido de teste, ate o dia do lancamento
-- ============================================================
-- O contador do pedido esta em 4052, que foi chute. O numero real so vai ser
-- conhecido no dia do lancamento, quando a Fourtime parar de emitir pedido no
-- sistema antigo.
--
-- Ate la, aprovar uma cotacao aqui gera PD004053, que e um numero de pedido de
-- verdade que ainda nao existe. Isso e ruim de duas formas, e as duas doem no
-- mesmo dia:
--
--   1. No dia do lancamento ninguem consegue separar, olhando, o pedido de
--      teste do pedido real. Eles tem a mesma cara.
--   2. Se o numero real for menor que os que os testes ja gastaram, dois
--      pedidos diferentes vao nascer com o mesmo numero.
--
-- Entao ate o lancamento o pedido nasce PD-TESTE-0001. Nao parece pedido, e e
-- esse o ponto: ninguem confunde, e ninguem esquece de ajustar, porque a marca
-- esta na cara do documento.


-- ---------- a regulagem --------------------------------------
-- Uma tabela de chave e valor para o punhado de decisoes que valem para o
-- sistema inteiro e que mudam de vez em quando. Ela nasce com uma linha so.
-- Nota junto do valor de proposito: daqui a seis meses ninguem lembra por que
-- essa chave existe, e a resposta tem que estar ao lado dela.

create table public.regulagem (
  chave         text primary key,
  valor         text not null default '',
  nota          text not null default '',
  atualizado_em timestamptz not null default now()
);

alter table public.regulagem enable row level security;

create policy "quem foi aprovado le a regulagem"
  on public.regulagem for select to authenticated
  using (public.meu_papel() is not null);

create policy "so o admin mexe na regulagem"
  on public.regulagem for all to authenticated
  using (public.sou_admin()) with check (public.sou_admin());

grant select, insert, update, delete on public.regulagem to authenticated;

create trigger regulagem_carimbo
  before update on public.regulagem
  for each row execute function public.carimbar_atualizacao();

insert into public.regulagem (chave, valor, nota) values (
  'pedido',
  'teste',
  'Enquanto valer "teste", todo pedido nasce PD-TESTE-0001 e vem marcado como '
  'teste na tabela. No dia do lancamento, rode '
  'select public.liberar_pedido_real(<ultimo numero de pedido real>) '
  'para virar a chave e acertar o contador de uma vez so.'
) on conflict (chave) do nothing;


-- ---------- o pedido sabe que e teste ------------------------
-- A marca vai TAMBEM na linha, e nao so no texto do numero. Numero e texto, e
-- texto se edita: no dia da limpeza a conta tem que sair de um campo que
-- ninguem digitou.

alter table public.pedido
  add column teste boolean not null default false;

create index pedido_de_teste on public.pedido (teste) where teste;


-- ---------- o numero do pedido -------------------------------
create or replace function public.pedido_em_teste()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select coalesce((select valor from public.regulagem where chave = 'pedido'), 'teste') = 'teste' $$;

create or replace function public.proximo_numero_de_pedido()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  teste boolean := public.pedido_em_teste();
  n     int;
begin
  insert into public.contador (chave, valor)
  values (case when teste then 'pedido-teste' else 'pedido' end, 1)
  on conflict (chave) do update set valor = contador.valor + 1
  returning valor into n;

  if teste then return 'PD-TESTE-' || lpad(n::text, 4, '0'); end if;
  return 'PD' || lpad(n::text, 6, '0');
end $$;


-- ---------- a aprovacao carimba o teste ----------------------
-- Igual a 011, com uma linha a mais: o pedido nasce sabendo se e teste.
create or replace function public.aprovar_cotacao(
  p_cotacao uuid, p_versao int default 1
) returns public.pedido
language plpgsql
security definer
set search_path = public
as $$
declare
  c    public.cotacao;
  pct  numeric(5,2);
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

  select coalesce(k.pct, 0), coalesce(p.nome, '')
    into pct, nome
    from public.pessoa p
    left join public.comissao_do_vendedor k on k.pessoa_id = p.id
   where p.id = c.vendedor_id;

  insert into public.pedido (
    numero, cotacao_id, cliente_id, lead_id, total, pecas,
    vendedor_id, vendedor_nome, comissao_pct, versao_aprovada, aprovado_por, teste
  ) values (
    public.proximo_numero_de_pedido(), c.id, c.cliente_id, c.lead_id, c.total, c.pecas,
    c.vendedor_id, coalesce(nome, ''), coalesce(pct, 0), p_versao, auth.uid(),
    public.pedido_em_teste()
  ) returning * into novo;

  update public.cotacao set estado = 'aprovada' where id = c.id;

  if c.lead_id is not null then
    update public.lead set estagio = 'fechado', valor = c.total where id = c.lead_id;
  end if;

  return novo;
end $$;


-- ---------- o dia do lancamento ------------------------------
-- Uma chamada so, porque as tres coisas tem que acontecer juntas: acertar o
-- contador, virar a chave e dizer quantos pedidos de teste ficaram para tras.
--
-- Ela NAO apaga os pedidos de teste. Apagar dado em nome de arrumacao, dentro
-- da mesma funcao que muda o modo do sistema, e como se perde o que nao devia.
-- Ela conta e devolve o numero, e quem decide o que fazer com eles e uma
-- pessoa, com a lista na frente.

create or replace function public.liberar_pedido_real(p_ultimo int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  quantos int;
  maior   int;
begin
  if not public.sou_admin() then
    raise exception 'Só o administrador libera o pedido real.' using errcode = '42501';
  end if;

  if p_ultimo is null or p_ultimo < 0 then
    raise exception 'Informe o último número de pedido real, sem o PD.'
      using errcode = '22023';
  end if;

  -- Um pedido real que ja exista acima do numero informado e sinal de que o
  -- numero esta errado. Seguir em frente ali repetiria numero de pedido, que e
  -- exatamente o que esta funcao existe para impedir.
  select coalesce(max((regexp_replace(numero, '\D', '', 'g'))::int), 0)
    into maior from public.pedido where not teste;
  if maior > p_ultimo then
    raise exception 'Já existe pedido real com número maior (%). Confira o último número.', maior
      using errcode = '22023';
  end if;

  insert into public.contador (chave, valor) values ('pedido', p_ultimo)
  on conflict (chave) do update set valor = p_ultimo;

  update public.regulagem set valor = 'real' where chave = 'pedido';

  select count(*) into quantos from public.pedido where teste;

  return 'Pronto. O próximo pedido será PD' || lpad((p_ultimo + 1)::text, 6, '0')
      || '. Ficaram ' || quantos || ' pedido(s) de teste na base'
      || case when quantos > 0 then ': veja em select * from public.pedido where teste;' else '.' end;
end $$;

grant execute on function public.pedido_em_teste() to authenticated;
grant execute on function public.liberar_pedido_real(int) to authenticated;
