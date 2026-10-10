-- ===========================================================================
-- 060: OS INFORMES DA CASA
--
-- Os textos que toda cotacao nova traz na pagina 1 da folha, em dois grupos:
-- "Sobre a producao" (como a peca e feita) e "Termos" (o combinado do
-- negocio). Wireframe de 11/10/2026, pranchas 123 e 123b, aprovadas pelo
-- Henrique: a pagina "Informes e termos" abre pela engrenagem do editor.
--
-- A COTACAO GUARDA A COPIA. Quando uma cotacao nasce, ela copia esta lista
-- para dentro do proprio corpo. Mudar ou apagar um texto aqui NAO mexe no que
-- ja foi feito nem no que ja foi enviado: o cliente leu aquela frase, e ela
-- tem que continuar la.
--
-- "Nasce marcado" diz se o texto entra ligado na folha. Os desmarcados vao
-- junto, desligados.
--
-- QUEM MEXE: o administrador e o gerente. Quem foi aprovado le (a cotacao
-- nova precisa ler para copiar).
--
-- O QUE ENTRA:
--   1. a tabela, com as regras de leitura e escrita
--   2. o relogio de alterado_em
--   3. os nove textos de hoje, que moravam no codigo
-- ===========================================================================


-- ---------- 1. a tabela --------------------------------------------------------
create table if not exists public.informe_da_casa (
  id            uuid primary key default gen_random_uuid(),
  /* a coluna da folha: producao (nas duas folhas) ou termos (so na com valor) */
  grupo         text not null,
  texto         text not null,
  nasce_marcado boolean not null default true,
  /* a ordem dentro do grupo, que e a ordem da folha */
  ordem         integer not null default 0,
  criado_em     timestamptz not null default now(),
  alterado_em   timestamptz not null default now(),
  constraint informe_grupo_conhecido check (grupo in ('producao', 'termos')),
  constraint informe_tem_texto check (length(btrim(texto)) between 1 and 600)
);
create index if not exists informe_da_casa_na_ordem on public.informe_da_casa (grupo, ordem);

comment on table public.informe_da_casa is
  'Os informes e termos que toda cotacao nova copia. Mudar aqui nao mexe nas cotacoes ja feitas';

alter table public.informe_da_casa enable row level security;

drop policy if exists "quem foi aprovado le os informes da casa" on public.informe_da_casa;
create policy "quem foi aprovado le os informes da casa" on public.informe_da_casa
  for select to authenticated
  using (public.meu_papel() is not null);

drop policy if exists "admin e gerente criam informe da casa" on public.informe_da_casa;
create policy "admin e gerente criam informe da casa" on public.informe_da_casa
  for insert to authenticated
  with check (public.meu_papel() in ('admin', 'gerente'));

drop policy if exists "admin e gerente mudam informe da casa" on public.informe_da_casa;
create policy "admin e gerente mudam informe da casa" on public.informe_da_casa
  for update to authenticated
  using (public.meu_papel() in ('admin', 'gerente'))
  with check (public.meu_papel() in ('admin', 'gerente'));

drop policy if exists "admin e gerente apagam informe da casa" on public.informe_da_casa;
create policy "admin e gerente apagam informe da casa" on public.informe_da_casa
  for delete to authenticated
  using (public.meu_papel() in ('admin', 'gerente'));

grant select, insert, update, delete on public.informe_da_casa to authenticated;


-- ---------- 2. o relogio -------------------------------------------------------
create or replace function public.informe_da_casa_alterado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.alterado_em := now();
  return new;
end;
$$;

drop trigger if exists informe_da_casa_alterado on public.informe_da_casa;
create trigger informe_da_casa_alterado
  before update on public.informe_da_casa
  for each row execute function public.informe_da_casa_alterado();


-- ---------- 3. os nove de hoje -------------------------------------------------
-- So entram com a tabela vazia: rodar de novo nao duplica nada.
insert into public.informe_da_casa (grupo, texto, nasce_marcado, ordem)
select * from (values
  ('producao', 'O prazo de produção começa a contar a partir da aprovação da arte final e da confirmação do pagamento da entrada.', true, 1),
  ('producao', 'Tolerância de até 2 cm nas medidas de cada peça e variação de tonalidade entre lotes de tecido, conforme prática do setor têxtil.', true, 2),
  ('producao', 'Quantidade mínima por modelo: 10 peças. Tamanhos acima de GG têm acréscimo já incluído na tabela de valores.', true, 3),
  ('termos', 'Esta cotação é válida até a data indicada no cabeçalho. Após o prazo, valores e disponibilidade de tecido podem ser revistos.', true, 1),
  ('termos', 'Pagamento: 50% na aprovação e 50% na retirada ou envio. Pedidos abaixo de R$ 500,00 são pagos integralmente na aprovação.', true, 2),
  ('termos', 'A arte aprovada pelo cliente é de sua responsabilidade: nomes, números e textos aprovados com erro não geram refação sem custo.', true, 3),
  ('termos', 'Alterações de grade, cor, tecido ou arte depois da aprovação geram nova cotação e novo prazo de entrega.', true, 4),
  ('termos', 'Frete por conta do cliente, salvo combinação em contrário. Entregas em Goiânia e Aparecida de Goiânia por motoboy.', false, 5),
  ('termos', 'Garantia de 90 dias contra defeitos de fabricação, nos termos do Código de Defesa do Consumidor. Não cobre desgaste de uso ou lavagem inadequada.', true, 6)
) as v (grupo, texto, nasce_marcado, ordem)
where not exists (select 1 from public.informe_da_casa);
