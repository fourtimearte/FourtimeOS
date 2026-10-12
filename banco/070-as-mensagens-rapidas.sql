-- ===========================================================================
-- 070: AS MENSAGENS RAPIDAS
--
-- Pedido do Henrique em 12/10/2026, pranchas 150 a 152 aprovadas ("ok, pode
-- colocar no ar, 150 ate 152"): no modo WhatsApp do Funil, a aba Atendimento
-- tem as mensagens rapidas por grupo; clicar em Enviar escreve no WhatsApp da
-- conversa aberta e envia. Ele quer "poder criar mensagens rapidas tambem,
-- editar e deletar".
--
-- DE QUEM E A MENSAGEM:
--   dono_id null    = da equipe: todo mundo aprovado ve e usa;
--   dono_id = eu    = so minha: so eu vejo.
--   criado_por      = quem escreveu (a da equipe so muda quem escreveu, o
--                     admin ou o gerente).
--
-- O TEXTO PODE TER CAMPOS que a tela preenche na hora de enviar:
--   {nome} o contato, {empresa} o nome do lead, {vendedor} quem envia,
--   {cotacao} o numero da cotacao, {total} o valor dela.
--
-- As quatro respostas que ja existiam no codigo (do v5) entram como da
-- equipe, para a lista nao nascer vazia. Sao do Henrique, e nao de teste.
-- ===========================================================================

create table if not exists public.mensagem_rapida (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null check (length(btrim(titulo)) between 1 and 60),
  texto         text not null check (length(btrim(texto)) between 1 and 2000),
  grupo         text not null default 'Geral' check (length(btrim(grupo)) between 1 and 40),
  dono_id       uuid references public.pessoa (id) on delete cascade,
  criado_por    uuid references public.pessoa (id) on delete set null default auth.uid(),
  ordem         integer not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists mensagem_rapida_dono on public.mensagem_rapida (dono_id);

alter table public.mensagem_rapida enable row level security;

drop policy if exists "ve a da equipe e as suas" on public.mensagem_rapida;
create policy "ve a da equipe e as suas" on public.mensagem_rapida
  for select to authenticated
  using (public.meu_papel() is not null and (dono_id is null or dono_id = auth.uid()));

drop policy if exists "escreve a sua ou a da equipe" on public.mensagem_rapida;
create policy "escreve a sua ou a da equipe" on public.mensagem_rapida
  for insert to authenticated
  with check (
    public.meu_papel() in ('admin', 'gerente', 'vendedor')
    and criado_por = auth.uid()
    and (dono_id is null or dono_id = auth.uid())
  );

drop policy if exists "muda a sua ou a que escreveu" on public.mensagem_rapida;
create policy "muda a sua ou a que escreveu" on public.mensagem_rapida
  for update to authenticated
  using (
    dono_id = auth.uid()
    or (dono_id is null and (criado_por = auth.uid() or public.meu_papel() in ('admin', 'gerente')))
  )
  with check (dono_id is null or dono_id = auth.uid());

drop policy if exists "apaga a sua ou a que escreveu" on public.mensagem_rapida;
create policy "apaga a sua ou a que escreveu" on public.mensagem_rapida
  for delete to authenticated
  using (
    dono_id = auth.uid()
    or (dono_id is null and (criado_por = auth.uid() or public.meu_papel() in ('admin', 'gerente')))
  );

grant select, insert, update, delete on public.mensagem_rapida to authenticated;

create or replace function public.anotar_a_mensagem_rapida()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists anotar_a_mensagem_rapida on public.mensagem_rapida;
create trigger anotar_a_mensagem_rapida
  before update on public.mensagem_rapida
  for each row execute function public.anotar_a_mensagem_rapida();

-- as quatro do v5, so se a tabela estiver vazia (rodar duas vezes nao duplica)
insert into public.mensagem_rapida (titulo, texto, grupo, dono_id, criado_por, ordem)
select v.titulo, v.texto, v.grupo, null, null, v.ordem
from (values
  ('Tabela de preços', 'Oi {nome}! Nossa tabela começa em 10 peças. O valor por peça depende do modelo, do tecido e da técnica de estampa. Me diz o que você precisa que eu fecho o número certinho.', 'Primeiro contato', 1),
  ('Catálogo', 'Oi {nome}! Te mando o catálogo com os modelos e tecidos que a gente trabalha. Qualquer peça de lá sai personalizada com a sua arte.', 'Primeiro contato', 2),
  ('Pedir grade', 'Oi {nome}! Para eu montar o orçamento preciso da grade de tamanhos, tipo 2 P, 6 M, 5 G, 1 GG. Pode mandar por aqui mesmo.', 'Cotação', 3),
  ('Prazo médio', 'O prazo de produção é de 12 dias úteis, contando a partir da aprovação da arte final e da confirmação do pagamento da entrada.', 'Prazo e produção', 4)
) as v (titulo, texto, grupo, ordem)
where not exists (select 1 from public.mensagem_rapida);
