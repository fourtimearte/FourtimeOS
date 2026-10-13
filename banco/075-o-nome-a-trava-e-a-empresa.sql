-- ===========================================================================
-- 075: O NOME DO PEDIDO, A TRAVA DAS FATIAS, A EMPRESA E O TECIDO RENOMEADO
--
-- 12/10/2026, itens 7, 9, 10 e 11 da lista "PODE FAZER TODOS". Quatro
-- pedacos pequenos que so o banco resolve direito, numa migracao so.
--
--   1. pedido_na_fabrica ganha, NO FIM (o create or replace so aceita coluna
--      nova no fim): o NOME do pedido, as MARCAS da cotacao (EVENTO, VIP,
--      PRIORIDADE, as mesmas que o cartao do kanban ja mostra) e TEM_FATIAS.
--      E dar_nome_ao_pedido, para quem edita o painel ou o kanban.
--   2. A TRAVA: pedido que tem fatia anda pelas fatias (024). Ate hoje o
--      seletor de etapa e o "Pronto em" do painel gravavam pedido.etapa direto
--      e a proxima fatia que andasse desfazia sem ninguem ver. Agora o banco
--      recusa mudar a etapa de pedido com fatia, a nao ser pelo proprio
--      gatilho das fatias.
--   3. A EMPRESA (CNPJ, endereco) sai do navegador de cada um (localStorage
--      ft.empresa) e vira uma linha so no banco: todo mundo le, quem edita as
--      Configuracoes grava, por salvar_empresa.
--   4. RENOMEAR O TECIDO (ou a cor) leva junto o nome guardado em cada
--      material ("PIQUET · Preto"), na mesma transacao. Antes eram N gravacoes
--      pela tela, e uma queda no meio deixava cor com o nome velho; e renomear
--      em Configuracoes, Banco de dados, nem tentava.
-- ===========================================================================


-- ---------- 1. o nome, as marcas e se tem fatia ------------------------------
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
       public.tag_do_pedido(p.id) as tag,
       (select string_agg(f.tecnica || ':' || f.etapa, ', ' order by f.tecnica)
          from public.fatia f
         where f.pedido_id = p.id and f.fechado_em is null) as fatias_abertas,
       p.cliente_id,
       /* 075: o nome que a fabrica deu ao pedido; vazio quando ninguem deu */
       btrim(p.nome) as nome,
       /* 075: as marcas da cotacao, como a fatia_na_fabrica ja le */
       coalesce(
         case jsonb_typeof(c.corpo -> 'producao' -> 'marcas')
           when 'array' then (select array_agg(x) from jsonb_array_elements_text(c.corpo -> 'producao' -> 'marcas') x)
         end,
         '{}') as marcas,
       /* 075: com fatia, a etapa e das fatias e o painel nao muda */
       exists (select 1 from public.fatia f where f.pedido_id = p.id) as tem_fatias
  from public.pedido p
  left join public.cliente cl on cl.id = p.cliente_id
  left join public.cotacao c  on c.id  = p.cotacao_id
 where p.estado <> 'cancelado';

grant select on public.pedido_na_fabrica to authenticated;

create or replace function public.dar_nome_ao_pedido(p_pedido uuid, p_nome text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare limpo text := left(regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g'), 80);
begin
  if not (public.posso('atividades', 'editar') or public.posso('kanban', 'editar')) then
    raise exception 'Só quem edita o Painel de atividades ou o Kanban dá nome ao pedido.' using errcode = '42501';
  end if;
  update public.pedido set nome = limpo where id = p_pedido;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  return limpo;
end $$;

grant execute on function public.dar_nome_ao_pedido(uuid, text) to authenticated;


-- ---------- 2. a trava: pedido com fatia anda pelas fatias ---------------------
/* pg_trigger_depth() = 1 quer dizer que quem mudou a etapa foi um update
   escrito por alguem (a tela, uma funcao), e nao o gatilho das fatias, que
   roda um nivel abaixo. */
create or replace function public.etapa_do_pedido_e_das_fatias()
returns trigger
language plpgsql
as $$
begin
  if new.etapa is distinct from old.etapa
     and pg_trigger_depth() = 1
     and exists (select 1 from public.fatia where pedido_id = new.id) then
    raise exception 'O pedido % anda pelos cartões do kanban: a etapa dele é a da fatia mais atrasada.', new.numero
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists pedido_etapa_e_das_fatias on public.pedido;
create trigger pedido_etapa_e_das_fatias
  before update on public.pedido
  for each row execute function public.etapa_do_pedido_e_das_fatias();


-- ---------- 3. a empresa ----------------------------------------------------
create table if not exists public.empresa (
  /* uma linha so: a chave so aceita true */
  id             boolean primary key default true check (id),
  dados          jsonb not null default '{}'::jsonb,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references public.pessoa (id) on delete set null
);
insert into public.empresa (id) values (true) on conflict (id) do nothing;

alter table public.empresa enable row level security;
drop policy if exists empresa_le on public.empresa;
create policy empresa_le on public.empresa
  for select to authenticated using (public.meu_papel() is not null);
grant select on public.empresa to authenticated;

/* Grava so os campos conhecidos, e so texto. O que vier a mais e jogado fora:
   o rodape do orcamento nao pode imprimir uma chave que alguem inventou. */
create or replace function public.salvar_empresa(p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare limpo jsonb;
begin
  if not public.posso('config', 'editar') then
    raise exception 'Só quem edita as Configurações muda os dados da empresa.' using errcode = '42501';
  end if;
  select coalesce(jsonb_object_agg(k, left(btrim(v), 300)), '{}'::jsonb) into limpo
    from jsonb_each_text(coalesce(p_dados, '{}'::jsonb)) as e(k, v)
   where k in ('nome', 'razaoSocial', 'descricao', 'cnpj', 'inscricaoEstadual', 'endereco', 'bairro',
               'cidade', 'uf', 'cep', 'telefone', 'whatsapp', 'email', 'site');
  update public.empresa
     set dados = limpo, atualizado_em = now(), atualizado_por = auth.uid()
   where id;
  return limpo;
end $$;

grant execute on function public.salvar_empresa(jsonb) to authenticated;


-- ---------- 4. renomear o tecido ou a cor leva o material junto ----------------
create or replace function public.material_acompanha_o_nome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.nome is not distinct from old.nome then
    return null;
  end if;
  if tg_table_name = 'tecido' then
    update public.material m
       set nome = new.nome || ' · ' || c.nome, atualizado_em = now()
      from public.cor_de_tecido c
     where m.tecido_id = new.id and c.id = m.cor_id
       and m.nome is distinct from new.nome || ' · ' || c.nome;
  else
    update public.material m
       set nome = t.nome || ' · ' || new.nome, atualizado_em = now()
      from public.tecido t
     where m.cor_id = new.id and t.id = m.tecido_id
       and m.nome is distinct from t.nome || ' · ' || new.nome;
  end if;
  return null;
end $$;

drop trigger if exists tecido_leva_o_material on public.tecido;
create trigger tecido_leva_o_material
  after update of nome on public.tecido
  for each row execute function public.material_acompanha_o_nome();

drop trigger if exists cor_leva_o_material on public.cor_de_tecido;
create trigger cor_leva_o_material
  after update of nome on public.cor_de_tecido
  for each row execute function public.material_acompanha_o_nome();
