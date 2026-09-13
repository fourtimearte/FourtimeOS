-- ============================================================
-- Fourtime OS - 004 perfil sem painel ate aprovar
-- ============================================================
-- A view do 003 devolvia a lista de paineis do papel mesmo para quem ainda
-- estava esperando aprovacao. Nao abria nada de verdade, porque quem tranca o
-- dado e a regra de acesso das tabelas e ela olha situacao = 'aprovado'. Mas
-- deixava a tela decidir: se um dia alguem montasse o menu direto dessa lista
-- sem conferir a situacao, a pessoa nao aprovada veria um menu inteiro de
-- portas que nao abrem.
--
-- Agora a resposta e sem ambiguidade: quem nao foi aprovado tem lista vazia.

create or replace view public.meu_perfil
with (security_invoker = true) as
select
  p.id,
  p.nome,
  p.papel::text as papel,
  p.situacao::text as situacao,
  case when p.situacao = 'aprovado'
       then coalesce(p.paineis, public.paineis_do_papel(p.papel))
       else array[]::text[]
  end as paineis
from public.pessoa p
where p.id = auth.uid();
