-- ===========================================================================
-- 080: A CONFIRMACAO DO FRETE E O WHATSAPP DA LOGISTICA (14/10/2026)
--
-- Duas abas novas dentro de Transporte (wireframe aprovado em 14/10/2026,
-- "o wireframe do transporte novo, pode produzir"; e "sao abas dentro de
-- Transporte e nao itens no menu lateral").
--
-- 1. A CONFIRMACAO DO FRETE. Cada pedido que ainda vai sair tem o seu frete:
--    quem paga (o cliente antes do envio, a Fourtime, ou sem frete quando o
--    cliente retira), como vai (o envio), o valor combinado e o valor que o
--    cliente pagou, e o comprovante. A LOGISTICA anda os tres passos: pediu ao
--    cliente, recebeu o comprovante, o financeiro confirmou. Cada passo guarda
--    quem e quando.
--
--    A TRAVA: pedido com frete do cliente REGISTRADO aqui e ainda nao
--    confirmado pelo financeiro nao sai de PRONTO para ENVIADO. Pedido que
--    ninguem registrou nao trava: a lista mostra "falar com o cliente", mas o
--    caminho de hoje continua andando, para a aba nova nao parar a expedicao
--    no dia em que entrar.
--
-- 2. O COMPROVANTE fica num balde PRIVADO do Storage (o repositorio e
--    publico, e comprovante de pagamento de cliente nao pode ter endereco
--    aberto). Le quem ve o Transporte; manda quem edita.
--
-- 3. AS MENSAGENS RAPIDAS DA LOGISTICA: a mesma tabela da 070, com o LUGAR
--    (vendas ou logistica). O funil le as de vendas e a aba WhatsApp do
--    Transporte le as da logistica. Quem edita o Transporte cria e muda as da
--    logistica. Campos: {cliente}, {nome}, {pedido}, {envio}, {frete},
--    {entrega}.
-- ===========================================================================


-- ---------- 1. o frete de cada pedido -----------------------------------------
create table if not exists public.frete_do_pedido (
  pedido_id        uuid primary key references public.pedido (id) on delete cascade,
  quem_paga        text not null default 'cliente',
  envio            text not null default '',
  valor_combinado  numeric(12,2),
  valor_pago       numeric(12,2),
  comprovante      text,
  comprovante_nome text not null default '',
  observacao       text not null default '',
  pedido_em        timestamptz,
  pedido_por       uuid references public.pessoa (id) on delete set null,
  recebido_em      timestamptz,
  recebido_por     uuid references public.pessoa (id) on delete set null,
  confirmado_em    timestamptz,
  confirmado_por   uuid references public.pessoa (id) on delete set null,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),

  constraint frete_quem_paga check (quem_paga in ('cliente', 'fourtime', 'sem_frete')),
  constraint frete_valores check (coalesce(valor_combinado, 0) >= 0 and coalesce(valor_pago, 0) >= 0),
  /* passo de depois nao existe sem o de antes */
  constraint frete_passos_em_ordem check (
    (recebido_em is null or pedido_em is not null)
    and (confirmado_em is null or recebido_em is not null)
  )
);

comment on table public.frete_do_pedido is
  'O frete de cada pedido e a confirmacao dele pela logistica (080). Sem linha, o pedido nao foi tratado ainda.';

drop trigger if exists frete_do_pedido_carimba on public.frete_do_pedido;
create trigger frete_do_pedido_carimba
  before update on public.frete_do_pedido
  for each row execute function public.carimbar_atualizacao();

alter table public.frete_do_pedido enable row level security;
drop policy if exists "quem ve o transporte le o frete" on public.frete_do_pedido;
create policy "quem ve o transporte le o frete"
  on public.frete_do_pedido for select to authenticated
  using (public.posso('transporte', 'ver'));
/* so leitura: quem grava sao as funcoes */
grant select on public.frete_do_pedido to authenticated;


-- ---------- a lista ----------------------------------------------------------
/* Os pedidos que ainda vao sair (aprovado ate pronto), com o frete. A view
   roda como dona (sem security_invoker) porque precisa do telefone do cliente,
   que a producao nao le direto; quem nao ve o Transporte nao ve nenhuma linha.

   passo: 0 falar com o cliente, 1 pedido ao cliente, 2 comprovante recebido,
   3 confirmado pelo financeiro. */
create or replace view public.frete_na_lista as
select p.id               as pedido_id,
       p.numero,
       coalesce(cl.nome, c.cliente_nome, '') as cliente,
       p.cliente_id,
       coalesce(nullif(cl.celular, ''), nullif(cl.telefone, ''), nullif(c.corpo -> 'cliente' ->> 'telefone', ''), '') as telefone,
       p.estado,
       p.data_de_envio    as entrega_em,
       p.fechado_em       as liberado_em,
       coalesce(nullif(f.envio, ''), c.corpo -> 'informe' ->> 'entrega', '') as envio,
       coalesce(f.quem_paga,
                case when upper(coalesce(c.corpo -> 'informe' ->> 'entrega', '')) = 'FABRICA' then 'sem_frete'
                     else 'cliente' end) as quem_paga,
       (f.pedido_id is not null) as registrado,
       f.valor_combinado,
       f.valor_pago,
       f.comprovante,
       coalesce(f.comprovante_nome, '') as comprovante_nome,
       coalesce(f.observacao, '') as observacao,
       case when f.confirmado_em is not null then 3
            when f.recebido_em is not null then 2
            when f.pedido_em is not null then 1
            else 0 end    as passo,
       f.pedido_em,
       coalesce(pp.nome, '') as pedido_por,
       f.recebido_em,
       coalesce(pr.nome, '') as recebido_por,
       f.confirmado_em,
       coalesce(pc.nome, '') as confirmado_por,
       p.teste
  from public.pedido p
  left join public.cotacao c on c.id = p.cotacao_id
  left join public.cliente cl on cl.id = p.cliente_id
  left join public.frete_do_pedido f on f.pedido_id = p.id
  left join public.pessoa pp on pp.id = f.pedido_por
  left join public.pessoa pr on pr.id = f.recebido_por
  left join public.pessoa pc on pc.id = f.confirmado_por
 where p.estado in ('aprovado', 'separacao', 'pcp', 'producao', 'pronto')
   and public.posso('transporte', 'ver');

grant select on public.frete_na_lista to authenticated;


-- ---------- gravar o frete ----------------------------------------------------
/* Quem paga, o envio, os valores e a observacao. Nao mexe nos passos. */
create or replace function public.salvar_frete_do_pedido(
  p_pedido          uuid,
  p_quem_paga       text,
  p_envio           text,
  p_valor_combinado numeric,
  p_valor_pago      numeric,
  p_observacao      text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.posso('transporte', 'editar') then
    raise exception 'Seu acesso não permite mexer no frete.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pedido where id = p_pedido) then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if coalesce(p_quem_paga, '') not in ('cliente', 'fourtime', 'sem_frete') then
    raise exception 'Quem paga o frete: o cliente, a Fourtime ou sem frete.' using errcode = '22023';
  end if;
  if coalesce(p_valor_combinado, 0) < 0 or coalesce(p_valor_pago, 0) < 0 then
    raise exception 'Valor de frete não pode ser negativo.' using errcode = '23514';
  end if;

  insert into public.frete_do_pedido (pedido_id, quem_paga, envio, valor_combinado, valor_pago, observacao)
  values (p_pedido, p_quem_paga, btrim(coalesce(p_envio, '')), p_valor_combinado, p_valor_pago,
          btrim(coalesce(p_observacao, '')))
  on conflict (pedido_id) do update
     set quem_paga = excluded.quem_paga,
         envio = excluded.envio,
         valor_combinado = excluded.valor_combinado,
         valor_pago = excluded.valor_pago,
         observacao = excluded.observacao;
end $$;

grant execute on function public.salvar_frete_do_pedido(uuid, text, text, numeric, numeric, text) to authenticated;

/* ANDAR OS PASSOS: p_passo e onde o frete fica (0 a 3). Andar para frente
   carimba os passos que faltavam com quem e agora; voltar apaga os de cima. */
create or replace function public.passo_do_frete(p_pedido uuid, p_passo int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.posso('transporte', 'editar') then
    raise exception 'Seu acesso não permite mexer no frete.' using errcode = '42501';
  end if;
  if p_passo is null or p_passo < 0 or p_passo > 3 then
    raise exception 'Passo desconhecido.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.pedido where id = p_pedido) then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;

  /* o pedido que ainda nao tinha linha nasce com o que a lista mostrava */
  insert into public.frete_do_pedido (pedido_id, quem_paga, envio)
  select l.pedido_id, l.quem_paga, l.envio
    from public.frete_na_lista l where l.pedido_id = p_pedido
  on conflict (pedido_id) do nothing;

  update public.frete_do_pedido
     set pedido_em      = case when p_passo >= 1 then coalesce(pedido_em, now()) end,
         pedido_por     = case when p_passo >= 1 then case when pedido_em is null then auth.uid() else pedido_por end end,
         recebido_em    = case when p_passo >= 2 then coalesce(recebido_em, now()) end,
         recebido_por   = case when p_passo >= 2 then case when recebido_em is null then auth.uid() else recebido_por end end,
         confirmado_em  = case when p_passo >= 3 then coalesce(confirmado_em, now()) end,
         confirmado_por = case when p_passo >= 3 then case when confirmado_em is null then auth.uid() else confirmado_por end end
   where pedido_id = p_pedido;
end $$;

grant execute on function public.passo_do_frete(uuid, int) to authenticated;

/* O COMPROVANTE: o caminho no balde, depois do arquivo subir. Anexar o
   comprovante ja conta como recebido. Caminho nulo tira. */
create or replace function public.anexar_comprovante_do_frete(p_pedido uuid, p_caminho text, p_nome text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  atual int;
begin
  if not public.posso('transporte', 'editar') then
    raise exception 'Seu acesso não permite mexer no frete.' using errcode = '42501';
  end if;
  if p_caminho is not null and p_caminho !~ ('^' || p_pedido::text || '/') then
    raise exception 'O comprovante tem que estar na pasta do pedido.' using errcode = '22023';
  end if;
  atual := coalesce((select passo from public.frete_na_lista where pedido_id = p_pedido), 0);
  perform public.passo_do_frete(p_pedido, case when p_caminho is null then atual else greatest(2, atual) end);
  update public.frete_do_pedido
     set comprovante = p_caminho,
         comprovante_nome = case when p_caminho is null then '' else btrim(coalesce(p_nome, '')) end
   where pedido_id = p_pedido;
end $$;

grant execute on function public.anexar_comprovante_do_frete(uuid, text, text) to authenticated;


-- ---------- a trava do envio --------------------------------------------------
create or replace function public.pedido_espera_o_frete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.frete_do_pedido;
begin
  if new.estado = 'enviado' and old.estado is distinct from 'enviado' then
    select * into f from public.frete_do_pedido where pedido_id = new.id;
    if found and f.quem_paga = 'cliente' and f.confirmado_em is null then
      raise exception 'O frete do pedido % é do cliente e ainda não foi confirmado pelo financeiro. Confirme em Transporte, Confirmação do frete.', new.numero
        using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists pedido_espera_o_frete on public.pedido;
create trigger pedido_espera_o_frete
  before update of estado on public.pedido
  for each row execute function public.pedido_espera_o_frete();


-- ---------- 2. o balde dos comprovantes ---------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes', 'comprovantes', false, 5242880,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "comprovante: quem ve o transporte le" on storage.objects;
create policy "comprovante: quem ve o transporte le"
  on storage.objects for select to authenticated
  using (bucket_id = 'comprovantes' and public.posso('transporte', 'ver'));

drop policy if exists "comprovante: quem edita o transporte manda" on storage.objects;
create policy "comprovante: quem edita o transporte manda"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'comprovantes' and public.posso('transporte', 'editar'));

drop policy if exists "comprovante: quem edita o transporte troca" on storage.objects;
create policy "comprovante: quem edita o transporte troca"
  on storage.objects for update to authenticated
  using (bucket_id = 'comprovantes' and public.posso('transporte', 'editar'));


-- ---------- 3. as mensagens rapidas da logistica ------------------------------
alter table public.mensagem_rapida
  add column if not exists lugar text not null default 'vendas';
alter table public.mensagem_rapida drop constraint if exists mensagem_rapida_lugar;
alter table public.mensagem_rapida
  add constraint mensagem_rapida_lugar check (lugar in ('vendas', 'logistica'));

drop policy if exists "escreve a sua ou a da equipe" on public.mensagem_rapida;
create policy "escreve a sua ou a da equipe" on public.mensagem_rapida
  for insert to authenticated
  with check (
    criado_por = auth.uid()
    and (dono_id is null or dono_id = auth.uid())
    and case lugar
          when 'logistica' then public.posso('transporte', 'editar')
          else public.meu_papel() in ('admin', 'gerente', 'vendedor')
        end
  );

insert into public.mensagem_rapida (titulo, texto, grupo, lugar, ordem, criado_por)
select x.titulo, x.texto, x.grupo, 'logistica', x.ordem, null
  from (values
    ('Valor do frete', 'Olá, {nome}! O pedido {pedido} está pronto. O frete pelos {envio} fica em {frete}. Pode pagar no Pix e mandar o comprovante aqui?', 'Frete', 0),
    ('Recebi o comprovante', 'Recebi o comprovante, obrigado! Assim que o financeiro confirmar, o pedido {pedido} sai.', 'Frete', 1),
    ('Saiu para entrega', 'O pedido {pedido} saiu hoje pelos {envio}. Assim que tiver o código de rastreio, mando aqui.', 'Envio', 0),
    ('Pronto para retirar', 'O pedido {pedido} está pronto para retirar na Fourtime, de segunda a sexta, das 8h às 18h.', 'Retirada', 0)
  ) as x(titulo, texto, grupo, ordem)
 where not exists (select 1 from public.mensagem_rapida where lugar = 'logistica');


-- ---------- a prova -----------------------------------------------------------
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'comprovantes' and not public) then
    raise exception 'o balde de comprovantes nao nasceu privado';
  end if;
  raise notice '080 pronta: % mensagem(ns) rapida(s) da logistica',
    (select count(*) from public.mensagem_rapida where lugar = 'logistica');
end $$;
