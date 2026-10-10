-- ===========================================================================
-- 059: OS PRESETS DE IMPRESSAO DA FOLHA A4
--
-- A barra da direita da pagina de impressao (wireframe de 11/10/2026,
-- pranchas 121 a 121c, segunda versao, aprovada pelo Henrique): um preset diz
-- o que sai na folha. Com valor ou sem valor, quais campos o cabecalho mostra
-- e quais modulos ficam de fora, na pagina 1 e nas paginas de layout.
--
-- OS DOIS DA FABRICA NAO MORAM AQUI. Cliente e Producao vivem no codigo
-- (src/dominio/cotacao/presets.ts): eles sao o template padrao do
-- FOURTIME OS - 14, nao mudam, e mudanca neles vira preset novo. Esta tabela
-- guarda so os que alguem salvou.
--
-- QUEM VE O QUE. O preset nasce de quem salvou (dono). "So eu" fica so para
-- ele; "Toda a equipe" aparece para quem foi aprovado. So o dono muda ou
-- apaga; o admin tambem, nos de equipe, para o dia em que quem salvou sair.
--
-- 2 POR PAGINA E PAGINA INTEIRA NAO SAO DO PRESET, por pedido dele: decide-se
-- na hora de imprimir. Por isso nao ha coluna para isso.
--
-- O QUE ENTRA:
--   1. a tabela, com as regras de leitura e escrita
--   2. o relogio de alterado_em
-- ===========================================================================


-- ---------- 1. a tabela --------------------------------------------------------
create table if not exists public.preset_de_impressao (
  id          uuid primary key default gen_random_uuid(),
  dono        uuid not null default auth.uid() references public.pessoa (id) on delete cascade,
  nome        text not null,
  /* true: toda a equipe ve e usa; false: so o dono */
  equipe      boolean not null default false,
  /* com valor (precos, totais e aceite) ou sem valor (a folha da fabrica) */
  valor       boolean not null default true,
  /* os campos do cabecalho, na ordem do catalogo: ["cliente", "cnpj", ...] */
  campos      jsonb not null default '[]'::jsonb,
  /* os modulos que ficam de fora: ["cond", "obs", ...] */
  fora        jsonb not null default '[]'::jsonb,
  /* '' escolhe-se na hora; cliente ou producao: abre sozinho naquela folha */
  abre        text not null default '',
  criado_em   timestamptz not null default now(),
  alterado_em timestamptz not null default now(),
  constraint preset_tem_nome check (length(btrim(nome)) between 1 and 60),
  constraint preset_campos_e_lista check (jsonb_typeof(campos) = 'array'),
  constraint preset_fora_e_lista check (jsonb_typeof(fora) = 'array'),
  constraint preset_abre_conhecido check (abre in ('', 'cliente', 'producao'))
);
create index if not exists preset_de_impressao_por_dono on public.preset_de_impressao (dono);

comment on table public.preset_de_impressao is
  'Os presets de impressao da folha A4 que alguem salvou. Os dois da fabrica (Cliente e Producao) moram no codigo';

alter table public.preset_de_impressao enable row level security;

drop policy if exists "quem foi aprovado le os presets" on public.preset_de_impressao;
create policy "quem foi aprovado le os presets" on public.preset_de_impressao
  for select to authenticated
  using (public.meu_papel() is not null and (equipe or dono = auth.uid()));

drop policy if exists "quem foi aprovado cria o proprio preset" on public.preset_de_impressao;
create policy "quem foi aprovado cria o proprio preset" on public.preset_de_impressao
  for insert to authenticated
  with check (public.meu_papel() is not null and dono = auth.uid());

drop policy if exists "o dono muda o preset" on public.preset_de_impressao;
create policy "o dono muda o preset" on public.preset_de_impressao
  for update to authenticated
  using (public.meu_papel() is not null and (dono = auth.uid() or (equipe and public.meu_papel() = 'admin')))
  with check (public.meu_papel() is not null and (dono = auth.uid() or (equipe and public.meu_papel() = 'admin')));

drop policy if exists "o dono apaga o preset" on public.preset_de_impressao;
create policy "o dono apaga o preset" on public.preset_de_impressao
  for delete to authenticated
  using (public.meu_papel() is not null and (dono = auth.uid() or (equipe and public.meu_papel() = 'admin')));

grant select, insert, update, delete on public.preset_de_impressao to authenticated;


-- ---------- 2. o relogio -------------------------------------------------------
create or replace function public.preset_de_impressao_alterado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.alterado_em := now();
  /* o dono nao muda de mao numa edicao */
  new.dono := old.dono;
  return new;
end;
$$;

drop trigger if exists preset_de_impressao_alterado on public.preset_de_impressao;
create trigger preset_de_impressao_alterado
  before update on public.preset_de_impressao
  for each row execute function public.preset_de_impressao_alterado();
