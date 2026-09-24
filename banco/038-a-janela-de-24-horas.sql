-- ===========================================================================
-- 038. A JANELA DE 24 HORAS PASSA A SER MANTIDA
--
-- A coluna `lead.janela_ate` existe desde a 011 e NUNCA foi escrita: nenhum
-- gatilho, nenhuma funcao, nenhuma tela. Ela e lida pelo aplicativo e jogada
-- fora, porque vem nula em todo lead.
--
-- A REGRA DA META: a janela abre quando O CLIENTE fala, e dura 24 horas. Dentro
-- dela da para escrever o que quiser; fora dela, so modelo aprovado.
--
-- POR QUE ISSO NAO PODE SER CALCULADO NA TELA a partir de `ultima_msg_em`:
-- essa coluna guarda a ultima mensagem de QUALQUER UM, inclusive nossa. Uma
-- tela que contasse dali reabriria a janela toda vez que o vendedor
-- respondesse, que e exatamente o que a regra da Meta nao faz. Responder nao
-- estende nada. Por isso a janela tem coluna propria, e ela so anda quando
-- chega fala de cliente.
--
-- E POR QUE MORA NO GATILHO, e nao no codigo que grava a mensagem: no dia em
-- que o webhook do WhatsApp entrar, quem vai inserir na tabela `mensagem` e a
-- Edge Function, e nao a tela. Regra que mora na tela e regra que a segunda
-- porta de entrada nao conhece.
--
-- Roda inteiro. Nao apaga nada.
-- ===========================================================================

-- ---------- 1. o gatilho ---------------------------------------------------
-- GREATEST, e nao atribuicao direta. O webhook pode entregar mensagem fora de
-- ordem, e uma mensagem antiga chegando depois de uma nova nao pode ENCURTAR a
-- janela: a janela e a da fala mais recente do cliente, e nao a da ultima
-- linha que o banco recebeu.
create or replace function public.abrir_a_janela()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.quem = 'cliente' then
    update public.lead
       set janela_ate = greatest(coalesce(janela_ate, new.em), new.em + interval '24 hours')
     where id = new.lead_id;
  end if;
  return new;
end $$;

drop trigger if exists mensagem_abre_a_janela on public.mensagem;
create trigger mensagem_abre_a_janela
  after insert on public.mensagem
  for each row execute function public.abrir_a_janela();


-- ---------- 2. o que ja esta na base ---------------------------------------
-- Sem isto o gatilho so vale para o que chegar daqui para a frente, e todo
-- lead que ja existe ficaria com a janela nula para sempre: o campo continuaria
-- parecendo quebrado, agora por outro motivo.
update public.lead l
   set janela_ate = m.ultima + interval '24 hours'
  from (
    select lead_id, max(em) as ultima
      from public.mensagem
     where quem = 'cliente'
     group by lead_id
  ) m
 where m.lead_id = l.id
   and l.janela_ate is distinct from m.ultima + interval '24 hours';


-- ---------- 3. a conferencia -----------------------------------------------
-- Conta quantos leads tem fala de cliente e quantos ficaram com janela, e
-- reclama se os dois numeros nao baterem. Contar linha e a unica prova de que
-- o update pegou: o painel de resultado do editor de SQL fica velho.
do $$
declare
  com_fala int;
  com_janela int;
begin
  select count(distinct lead_id) into com_fala
    from public.mensagem where quem = 'cliente';

  select count(*) into com_janela
    from public.lead where janela_ate is not null;

  if com_janela < com_fala then
    raise exception 'sobrou lead com fala de cliente e sem janela: % com fala, % com janela',
      com_fala, com_janela;
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgname = 'mensagem_abre_a_janela'
       and tgrelid = 'public.mensagem'::regclass
  ) then
    raise exception 'o gatilho mensagem_abre_a_janela nao ficou de pe';
  end if;

  raise notice 'janela de 24h ligada: % leads com fala de cliente, % com janela',
    com_fala, com_janela;
end $$;
