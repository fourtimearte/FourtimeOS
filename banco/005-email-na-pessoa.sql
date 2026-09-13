-- ============================================================
-- Fourtime OS - 005 o e-mail na propria pessoa
-- ============================================================
-- A tela de Pessoas precisa mostrar o e-mail de cada um, e o e-mail mora em
-- auth.users, que nenhuma pessoa comum pode ler.
--
-- O caminho obvio seria uma view que junta as duas e roda com o poder de quem
-- a criou, com um "where sou_admin()" segurando a porta. Funciona, mas troca
-- a regra de acesso da tabela por um unico WHERE escrito na mao: no dia em que
-- alguem editar essa view sem entender, o vazamento e silencioso.
--
-- Guardar o e-mail na propria pessoa e mais bobo e mais seguro: a tabela
-- continua protegida pela regra de acesso que ja existe, sem view privilegiada
-- nenhuma. O preco e uma copia do e-mail, escrita pelo mesmo gatilho que cria
-- a linha.

alter table public.pessoa add column email text not null default '';

update public.pessoa p
   set email = u.email
  from auth.users u
 where u.id = p.id;

create or replace function public.ao_criar_conta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  primeira  boolean;
  endereco  text;
  convidado public.convite%rowtype;
  chamado   text;
begin
  endereco := lower(btrim(new.email));
  chamado  := coalesce(
                nullif(new.raw_user_meta_data ->> 'nome', ''),
                split_part(endereco, '@', 1)
              );
  select not exists (select 1 from public.pessoa) into primeira;

  if primeira then
    insert into public.pessoa (id, nome, email, papel, situacao, aprovado_em)
    values (new.id, chamado, endereco, 'admin', 'aprovado', now())
    on conflict (id) do nothing;
    return new;
  end if;

  select * into convidado from public.convite where email = endereco;

  if not found then
    raise exception 'E-MAIL SEM CONVITE'
      using hint = 'Peça para o administrador liberar este e-mail antes de criar a conta.';
  end if;

  if convidado.usado_em is not null then
    raise exception 'CONVITE JA USADO'
      using hint = 'Já existe uma conta criada com este e-mail.';
  end if;

  insert into public.pessoa (id, nome, email, papel, paineis, situacao)
  values (new.id, chamado, endereco, convidado.papel, convidado.paineis, 'esperando')
  on conflict (id) do nothing;

  update public.convite set usado_em = now() where email = endereco;
  return new;
end $$;

-- A tela de Pessoas ordena pela fila: quem esta esperando aparece primeiro.
create index pessoa_por_situacao on public.pessoa (situacao, criado_em);
