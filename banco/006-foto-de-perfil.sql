-- ============================================================
-- Fourtime OS - 006 foto de perfil
-- ============================================================
-- Ate aqui o sistema nao tinha onde guardar arquivo nenhum: o codigo e as
-- imagens da propria tela moram no GitHub e entram no pacote na hora do build,
-- os dados moram no Postgres, e o .cft da cotacao e baixado direto para a
-- pasta de downloads de quem clicou. Nada de arquivo nosso ficava em lugar
-- nenhum. A foto de perfil e o primeiro, e por isso ela decide o formato dos
-- que vem depois: arte do cliente, layout aprovado, PDF da ficha.
--
-- O caminho e <id da pessoa>/foto.jpg. A pasta com o id no comeco nao e
-- enfeite: e ela que deixa a regra de acesso dizer "voce so mexe no que esta
-- na sua pasta" sem precisar ler o banco.
--
-- O balde e publico, que foi a escolha do Henrique: a foto carrega direto, sem
-- pedido extra, e em tablet com internet de galpao isso se nota. O endereco
-- carrega o id da conta, que ninguem lista de fora, mas quem receber o link ve
-- a foto sem entrar no sistema. E o que quase todo sistema de equipe faz, e
-- esta escrito aqui para ninguem descobrir isso de susto.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatares',
  'avatares',
  true,
  524288,
  array['image/jpeg', 'image/webp', 'image/png']
)
on conflict (id) do nothing;

create policy "avatar: quem entrou enxerga"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatares');

create policy "avatar: cada um manda a sua"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatar: cada um troca a sua"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatar: cada um tira a sua, o admin tira de qualquer um"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatares'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.sou_admin())
  );

-- ---------- quando a foto mudou -----------------------------
-- Guardar a URL da foto seria guardar duas vezes a mesma coisa: o caminho ja
-- e o id da pessoa. O que a tela nao consegue adivinhar e QUANDO a foto mudou,
-- e sem isso o navegador continua mostrando a foto velha por horas, porque o
-- endereco e o mesmo de antes. A data vira o final do endereco e resolve.
-- Nulo significa: esta pessoa nao tem foto, mostre as iniciais.
alter table public.pessoa add column foto_em timestamptz;

create or replace function public.marcar_minha_foto(tem boolean)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  quando timestamptz;
begin
  quando := case when tem then now() else null end;
  update public.pessoa set foto_em = quando where id = auth.uid();
  return quando;
end $$;

grant execute on function public.marcar_minha_foto(boolean) to authenticated;

-- A view volta com a foto junto.
--
-- Precisa de drop antes: o create or replace de view nao aceita mudar a ordem
-- nem o nome das colunas, e o e-mail entrou no meio. O Postgres avisa isso com
-- "cannot change name of view column", que parece erro de digitacao e nao e.
drop view if exists public.meu_perfil;

create view public.meu_perfil
with (security_invoker = true) as
select
  p.id,
  p.nome,
  p.email,
  p.papel::text as papel,
  p.situacao::text as situacao,
  p.foto_em,
  case when p.situacao = 'aprovado'
       then coalesce(p.paineis, public.paineis_do_papel(p.papel))
       else array[]::text[]
  end as paineis
from public.pessoa p
where p.id = auth.uid();
