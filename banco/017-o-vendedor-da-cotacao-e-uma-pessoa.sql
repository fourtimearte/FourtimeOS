-- ============================================================
-- Fourtime OS - 017 o vendedor da cotacao e uma pessoa
-- ============================================================
-- A corrente da comissao, decidida em DECISAO-DONO-DO-LEAD-E-COMISSAO.md:
--
--   lead.vendedor_id -> cotacao.vendedor_id -> pedido.vendedor_id
--
-- Ela estava rompida no meio. A cotacao guarda o vendedor como TEXTO, porque
-- e assim que a Fourtime trabalha hoje: "Lucas", "Dani", "Kev", nomes de uma
-- lista do banco de dados da fabrica, e nenhum deles tem conta no sistema
-- ainda. So que a comissao nao se paga para um texto: ela se paga para uma
-- pessoa, e o pedido le pedido.vendedor_id.
--
-- Resultado: todo pedido nascia com vendedor_id nulo e comissao zero, e o
-- relatorio de comissao saia vazio para todo mundo. O sistema inteiro
-- funcionava e a unica coisa que ele existia para resolver, nao.
--
-- A COSTURA E POR NOME, E ELA E FEITA AQUI, NO BANCO.
--
-- Aqui e nao no aplicativo por dois motivos. O primeiro e que e regra de dado,
-- e nao de tela: vale para a cotacao digitada, para a semeada e para a que
-- entrar por importacao amanha. O segundo e que no aplicativo ela seria uma
-- consulta a mais em cada gravacao, e uma que da para esquecer.
--
-- O nome e comparado sem acento e sem caixa, com a mesma funcao que o cliente
-- usa. "Fabricio" e "Fabrício" sao a mesma pessoa, e a lista da fabrica nem
-- sempre tem acento.
--
-- E ela SO PREENCHE O QUE ESTA VAZIO. Se alguem escolher a pessoa de propria
-- mao, o palpite por nome nao passa por cima: nome e um bom chute, e chute
-- nao ganha de escolha.

create or replace function public.costurar_vendedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.vendedor_id is null and coalesce(new.vendedor_nome, '') <> '' then
    select p.id into new.vendedor_id
      from public.pessoa p
     where p.situacao = 'aprovado'
       and public.chave_do_nome(p.nome) = public.chave_do_nome(new.vendedor_nome)
     limit 1;
  end if;

  /* O caminho contrario tambem: quem escolheu a pessoa nao precisa digitar o
     nome dela de novo, e o nome gravado passa a ser o da conta. */
  if new.vendedor_id is not null and coalesce(new.vendedor_nome, '') = '' then
    select p.nome into new.vendedor_nome from public.pessoa p where p.id = new.vendedor_id;
  end if;

  return new;
end $$;

create trigger cotacao_costura_o_vendedor
  before insert or update of vendedor_id, vendedor_nome on public.cotacao
  for each row execute function public.costurar_vendedor();

-- Costura o que ja esta gravado. Hoje sao seis cotacoes de ensaio; fica escrito
-- assim mesmo porque a serie inteira vai rodar de novo um dia num banco
-- restaurado, e ai pode nao ser seis.
update public.cotacao set vendedor_nome = vendedor_nome
 where vendedor_id is null and vendedor_nome <> '';


-- ---------- o que esta sem dono --------------------------------------------
-- A tela precisa poder dizer "esta cotacao vai gerar comissao para ninguem"
-- ANTES de alguem aprovar, e nao depois. Aprovada, o percentual congela em
-- zero e nao tem desfazer: o pedido guarda o numero daquele dia de proposito.

create view public.cotacao_sem_vendedor
with (security_invoker = true) as
select c.id, c.numero, c.cliente_nome, c.vendedor_nome, c.total, c.estado
  from public.cotacao c
 where c.vendedor_id is null
   and c.estado not in ('recusada', 'vencida')
   and not exists (select 1 from public.pedido p where p.cotacao_id = c.id);

grant select on public.cotacao_sem_vendedor to authenticated;
