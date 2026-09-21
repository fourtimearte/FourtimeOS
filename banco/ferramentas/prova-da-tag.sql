-- ============================================================
-- A PROVA DA TAG DO PEDIDO
-- ============================================================
-- Roda no SQL Editor quantas vezes quiser. Ele termina levantando um erro de
-- proposito, e por isso TUDO que ele fez e desfeito: nenhuma linha do banco
-- fica diferente. O relatorio sai dentro da mensagem de erro.
--
-- A regra que ele conferre esta na migracao 024:
--   a tag e a do trabalho MAIS ATRASADO, medido em quantos postos faltam;
--   com mais de uma fatia correndo, a tag e a FAMILIA do posto;
--   com uma fatia so, a tag e o POSTO exato;
--   o pedido so fecha quando a ULTIMA fatia fecha, e fecha na data dela.
--
-- Por que o teste mora em SQL e nao no npm run contas: a regra mora em SQL,
-- porque e um gatilho que precisa valer para o arrastar do kanban, para um
-- PATCH e para o ensaio. Escrever a mesma regra em TypeScript so para poder
-- testa-la seria a mesma regra em duas linguagens, que e exatamente o que o
-- resto deste banco evita.
do $$
declare
  eu   uuid;
  alvo uuid;
  r    text := E'\n';
  n    int;
  tag  text;
  et   text;
  fim  timestamptz;
  marco timestamptz := now() - interval '3 days';

begin
  select id into eu from public.pessoa where papel = 'admin' and situacao = 'aprovado' limit 1;
  if eu is null then raise exception 'PROVA >> nao ha admin aprovado'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', eu)::text, true);

  select id into alvo from public.pedido where estado = 'producao' order by criado_em limit 1;
  if alvo is null then
    select id into alvo from public.pedido order by criado_em limit 1;
    update public.pedido set estado = 'producao' where id = alvo;
  end if;
  if alvo is null then raise exception 'PROVA >> nao ha pedido para testar'; end if;
  delete from public.fatia where pedido_id = alvo;

  /* 1. uma fatia so: a tag e o posto exato, e nao a familia */
  insert into public.fatia (pedido_id, tecnica, etapa, layouts, pecas)
  values (alvo, 'subli', 'subli', '{1}', 10);
  tag := public.tag_do_pedido(alvo);
  r := r || case when tag = 'subli' then 'ok    ' else 'FALHA ' end
         || 'uma fatia so mostra o posto exato [' || coalesce(tag,'null') || ']' || E'\n';

  /* 2. duas correndo na mesma familia: a tag e a familia */
  insert into public.fatia (pedido_id, tecnica, etapa, layouts, pecas)
  values (alvo, 'dtf', 'dtf', '{2}', 8);
  tag := public.tag_do_pedido(alvo);
  r := r || case when tag = 'Impressão' then 'ok    ' else 'FALHA ' end
         || 'duas na mesma familia mostram a familia [' || coalesce(tag,'null') || ']' || E'\n';

  /* 3. o mais atrasado manda, e nao o mais adiantado */
  update public.fatia set etapa = 'costura' where pedido_id = alvo and tecnica = 'subli';
  tag := public.tag_do_pedido(alvo);
  r := r || case when tag = 'Impressão' then 'ok    ' else 'FALHA ' end
         || 'subli na costura e dtf na impressao mostra Impressao ['
         || coalesce(tag,'null') || ']' || E'\n';
  select etapa::text into et from public.pedido where id = alvo;
  r := r || case when et = 'dtf' then 'ok    ' else 'FALHA ' end
         || 'a etapa do pedido segue a fatia mais atrasada [' || et || ']' || E'\n';

  /* 4. quando a mais atrasada nao tem familia, a tag e o proprio posto.
        subli esta em costura (faltam 2: embalagem e finalizado) e dtf em
        cd-costura (faltam 3: costura, embalagem e finalizado), entao a mais
        atrasada e a do dtf. Esta conta ja me pegou uma vez: eu tinha escrito
        'costura' aqui, olhando o nome do posto em vez de contar o que falta,
        e o teste me corrigiu. */
  update public.fatia set etapa = 'cd-costura' where pedido_id = alvo and tecnica = 'dtf';
  tag := public.tag_do_pedido(alvo);
  r := r || case when tag = 'cd-costura' then 'ok    ' else 'FALHA ' end
         || 'posto sem familia aparece com o proprio nome [' || coalesce(tag,'null') || ']' || E'\n';

  /* 5. fatia fechada sai da conta da tag */
  update public.fatia set etapa = 'finalizado' where pedido_id = alvo and tecnica = 'dtf';
  tag := public.tag_do_pedido(alvo);
  r := r || case when tag = 'costura' then 'ok    ' else 'FALHA ' end
         || 'a fatia fechada nao entra mais na tag [' || coalesce(tag,'null') || ']' || E'\n';
  select fechado_em into fim from public.pedido where id = alvo;
  r := r || case when fim is null then 'ok    ' else 'FALHA ' end
         || 'o pedido NAO fecha com uma fatia ainda correndo' || E'\n';

  /* 6. a ultima fatia fecha o pedido, e fecha na DATA DELA.
        As duas fatias sao apontadas com data no passado, uma ha cinco dias e
        outra ha tres. O pedido tem que fechar na de TRES, que e a ultima a
        terminar, e nao em now(), que e a hora em que alguem lembrou de
        apontar. A regra da virada de semana depende disso: o trabalho que
        terminou na sexta pertence a sexta, mesmo apontado na segunda. */
  update public.fatia set etapa = 'finalizado' where pedido_id = alvo and tecnica = 'subli';
  update public.fatia set fechado_em = marco - interval '2 days'
   where pedido_id = alvo and tecnica = 'dtf';
  update public.fatia set fechado_em = marco where pedido_id = alvo and tecnica = 'subli';
  select etapa::text, fechado_em into et, fim from public.pedido where id = alvo;
  r := r || case when et = 'finalizado' then 'ok    ' else 'FALHA ' end
         || 'com todas fechadas o pedido finaliza [' || et || ']' || E'\n';
  r := r || case when fim = marco then 'ok    ' else 'FALHA ' end
         || 'e fecha na data da ULTIMA a terminar [' || coalesce(fim::text,'null') || ']' || E'\n';
  r := r || case when fim < now() - interval '1 day' then 'ok    ' else 'FALHA ' end
         || 'e nao em now(), que e a hora em que alguem apontou' || E'\n';
  tag := public.tag_do_pedido(alvo);
  r := r || case when tag is null then 'ok    ' else 'FALHA ' end
         || 'pedido sem fatia aberta nao tem tag [' || coalesce(tag,'null') || ']' || E'\n';

  /* 7. a rota e uma trava, e nao uma sugestao */
  begin
    update public.fatia set etapa = 'bordado' where pedido_id = alvo and tecnica = 'subli';
    r := r || 'FALHA subli foi parar no bordado' || E'\n';
  exception when others then
    r := r || 'ok    a fatia nao vai para posto fora da rota dela (' || sqlstate || ')' || E'\n';
  end;

  /* 8. o Futurize esta na rota da sublimacao, depois da calandra */
  select posto::text into et from public.rota_da_tecnica where tecnica='subli' and ordem=30;
  r := r || case when et = 'futurize' then 'ok    ' else 'FALHA ' end
         || 'o corte da sublimacao e o Futurize, depois da calandra [' || et || ']' || E'\n';

  select count(*) into n from regexp_matches(r, 'FALHA', 'g');
  raise exception 'PROVA DA TAG >> % %', case when n = 0 then 'tudo passou' else n || ' falha(s)' end, r;
end $$;
